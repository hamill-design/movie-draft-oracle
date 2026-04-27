"""
Sync Letterboxd data to Supabase database
"""
# Import compatibility shim for Python 3.9
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from letterboxdpy.list import List
from letterboxdpy.user import User
import json
import sys
import os
import urllib.request
import urllib.error
from typing import List as TypingList, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scripts.letterboxd.utils import get_supabase_client, extract_tmdb_id_from_url, match_letterboxd_to_tmdb


def _invoke_enrich_sequel_for_spec_draft_movie(supabase_url: str, service_key: str, spec_draft_movie_id: str) -> None:
    """
    Call Edge Function enrich-spec-draft-sequels (TMDB is_sequel + Sequel category row).
    Uses service role; requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
    """
    url = f"{supabase_url.rstrip('/')}/functions/v1/enrich-spec-draft-sequels"
    body = json.dumps({"spec_draft_movie_id": spec_draft_movie_id}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        resp.read()


def sync_list_to_spec_draft(username: str, list_slug: str, spec_draft_id: str, dry_run: bool = False):
    """
    Sync a Letterboxd list to a spec draft in Supabase
    
    Args:
        username: Letterboxd username
        list_slug: Letterboxd list slug
        spec_draft_id: UUID of the spec draft in Supabase
        dry_run: If True, only print what would be synced without making changes
    """
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Cannot connect to Supabase")
        return

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    try:
        # Fetch list from Letterboxd
        print(f"📥 Fetching list from Letterboxd: {username}/{list_slug}")
        list_instance = List(username, list_slug)
        list_title = str(list_instance)
        print(f"✅ Fetched list: {list_title}")
        
        # Get films from list
        films = []
        if hasattr(list_instance, 'films'):
            list_films = list_instance.films
            if isinstance(list_films, list):
                films = list_films
            elif hasattr(list_films, '__iter__'):
                films = list(list_films)
        
        print(f"📊 Found {len(films)} films in list")
        
        if dry_run:
            print("\n🔍 DRY RUN - Would sync the following movies:")
        
        synced_count = 0
        skipped_count = 0
        error_count = 0
        
        for film in films:
            try:
                # Get film data
                film_slug = getattr(film, 'slug', None)
                film_title = str(film) if hasattr(film, '__str__') else "Unknown"
                film_year = getattr(film, 'year', None)
                tmdb_link = getattr(film, 'tmdb_link', None)
                
                # Extract TMDB ID
                tmdb_id = None
                if tmdb_link:
                    tmdb_id = extract_tmdb_id_from_url(tmdb_link)
                elif film_slug:
                    # Try to get TMDB ID from movie slug
                    tmdb_id = match_letterboxd_to_tmdb(film_slug)
                
                if not tmdb_id:
                    print(f"⚠️  Skipping {film_title} ({film_year}): No TMDB ID found")
                    skipped_count += 1
                    continue
                
                # Get genres if available
                genres = getattr(film, 'genres', None)
                genre_ids = None
                if genres:
                    # Convert genre names to TMDB genre IDs if needed
                    # This is a simplified version - you may need to map Letterboxd genres to TMDB
                    pass
                
                if dry_run:
                    print(f"  - {film_title} ({film_year}) - TMDB ID: {tmdb_id}")
                    synced_count += 1
                    continue
                
                # Check if movie already exists in spec_draft_movies
                existing = supabase.table('spec_draft_movies')\
                    .select('id')\
                    .eq('spec_draft_id', spec_draft_id)\
                    .eq('movie_tmdb_id', tmdb_id)\
                    .execute()
                
                if existing.data and len(existing.data) > 0:
                    print(f"⏭️  Skipping {film_title}: Already in spec draft")
                    skipped_count += 1
                    continue
                
                # Insert movie into spec_draft_movies
                movie_data = {
                    'spec_draft_id': spec_draft_id,
                    'movie_tmdb_id': tmdb_id,
                    'movie_title': film_title,
                    'movie_year': film_year,
                    'movie_genres': genre_ids
                }
                
                # Try to get poster path from TMDB (would need additional API call)
                # For now, we'll leave it null and it can be populated later
                
                result = supabase.table('spec_draft_movies')\
                    .insert(movie_data)\
                    .execute()
                
                if result.data:
                    print(f"✅ Added {film_title} ({film_year}) to spec draft")
                    synced_count += 1
                    row = result.data[0] if isinstance(result.data, list) else result.data
                    movie_row_id = row.get("id") if isinstance(row, dict) else None
                    if movie_row_id and supabase_url and service_key and not dry_run:
                        try:
                            _invoke_enrich_sequel_for_spec_draft_movie(
                                supabase_url, str(service_key), str(movie_row_id)
                            )
                        except urllib.error.HTTPError as he:
                            print(
                                f"⚠️  enrich-spec-draft-sequels HTTP {he.code} for {film_title} (id={movie_row_id})"
                            )
                        except Exception as ex:
                            print(
                                f"⚠️  enrich-spec-draft-sequels failed for {film_title}: {ex}"
                            )
                else:
                    print(f"⚠️  Failed to add {film_title}")
                    error_count += 1
                    
            except Exception as e:
                print(f"❌ Error processing film: {e}")
                error_count += 1
        
        print(f"\n📊 Summary:")
        print(f"  ✅ Synced: {synced_count}")
        print(f"  ⏭️  Skipped: {skipped_count}")
        print(f"  ❌ Errors: {error_count}")
        
        if dry_run:
            print("\n💡 Run without --dry-run to actually sync the data")
        
    except Exception as e:
        print(f"❌ Error syncing list: {e}")
        raise

def sync_user_watchlist_to_spec_draft(username: str, spec_draft_id: str, max_films: Optional[int] = None, dry_run: bool = False):
    """
    Sync a user's watchlist to a spec draft
    
    Args:
        username: Letterboxd username
        spec_draft_id: UUID of the spec draft in Supabase
        max_films: Maximum number of films to sync (None for all)
        dry_run: If True, only print what would be synced
    """
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Cannot connect to Supabase")
        return
    
    try:
        print(f"📥 Fetching watchlist from Letterboxd: {username}")
        user = User(username)
        
        watchlist = []
        if hasattr(user, 'watchlist'):
            list_watchlist = user.watchlist
            if isinstance(list_watchlist, list):
                watchlist = list_watchlist[:max_films] if max_films else list_watchlist
            elif hasattr(list_watchlist, '__iter__'):
                watchlist = list(list_watchlist)[:max_films] if max_films else list(list_watchlist)
        
        print(f"📊 Found {len(watchlist)} films in watchlist")
        
        # Process similar to list sync
        # (Implementation would be similar to sync_list_to_spec_draft)
        print("⚠️  Watchlist sync not fully implemented yet")
        
    except Exception as e:
        print(f"❌ Error syncing watchlist: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python sync_to_supabase.py <list|watchlist> <username> <list_slug_or_spec_draft_id> [spec_draft_id] [--dry-run]")
        print("\nExamples:")
        print("  python sync_to_supabase.py list hepburnluv classic-movies-for-beginners <spec_draft_uuid>")
        print("  python sync_to_supabase.py list hepburnluv classic-movies-for-beginners <spec_draft_uuid> --dry-run")
        sys.exit(1)
    
    mode = sys.argv[1]
    username = sys.argv[2]
    list_slug_or_spec_draft_id = sys.argv[3]
    spec_draft_id = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4] == '--dry-run' else list_slug_or_spec_draft_id
    dry_run = '--dry-run' in sys.argv
    
    try:
        if mode == "list":
            if len(sys.argv) < 5 or sys.argv[4] == '--dry-run':
                print("❌ Error: List mode requires spec_draft_id")
                sys.exit(1)
            list_slug = list_slug_or_spec_draft_id
            sync_list_to_spec_draft(username, list_slug, spec_draft_id, dry_run)
        elif mode == "watchlist":
            sync_user_watchlist_to_spec_draft(username, spec_draft_id, dry_run=dry_run)
        else:
            print(f"❌ Invalid mode: {mode}. Use 'list' or 'watchlist'")
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

