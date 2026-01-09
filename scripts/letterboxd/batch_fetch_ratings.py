"""
Batch fetch Letterboxd ratings for movies in the database
"""
import sys
import os
from typing import List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from scripts.letterboxd.utils import get_supabase_client
from scripts.letterboxd.fetch_movie_rating import get_letterboxd_rating
import time

def batch_fetch_ratings(limit: int = 100, dry_run: bool = False):
    """
    Fetch Letterboxd ratings for movies missing them in the database
    
    Args:
        limit: Maximum number of movies to process
        dry_run: If True, only show what would be updated without making changes
    """
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Cannot connect to Supabase")
        return
    
    try:
        # Get movies that need Letterboxd ratings
        print(f"📊 Fetching movies missing Letterboxd ratings (limit: {limit})...")
        
        result = supabase.table('draft_picks')\
            .select('id, movie_id, movie_title, movie_year, letterboxd_rating')\
            .is_('letterboxd_rating', 'null')\
            .not_.is_('movie_title', 'null')\
            .limit(limit)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            print("✅ No movies need Letterboxd ratings")
            return
        
        movies = result.data
        print(f"📽️  Found {len(movies)} movies to process")
        
        if dry_run:
            print("\n🔍 DRY RUN - Would fetch ratings for:")
            for movie in movies[:10]:  # Show first 10
                print(f"  - {movie['movie_title']} ({movie['movie_year']})")
            if len(movies) > 10:
                print(f"  ... and {len(movies) - 10} more")
            return
        
        updated_count = 0
        error_count = 0
        
        for i, movie in enumerate(movies, 1):
            try:
                print(f"\n[{i}/{len(movies)}] Processing: {movie['movie_title']} ({movie['movie_year']})")
                
                rating = get_letterboxd_rating(
                    movie['movie_title'],
                    movie['movie_year'],
                    movie['movie_id']
                )
                
                if rating is not None:
                    # Update database
                    update_result = supabase.table('draft_picks')\
                        .update({'letterboxd_rating': rating})\
                        .eq('id', movie['id'])\
                        .execute()
                    
                    if update_result.data:
                        print(f"✅ Updated: {rating}/5")
                        updated_count += 1
                    else:
                        print(f"⚠️  Failed to update database")
                        error_count += 1
                else:
                    print(f"⚠️  Rating not found")
                    error_count += 1
                
                # Rate limiting - wait between requests
                if i < len(movies):
                    time.sleep(2)  # 2 second delay between requests
                    
            except Exception as e:
                print(f"❌ Error processing {movie['movie_title']}: {e}")
                error_count += 1
                continue
        
        print(f"\n📊 Summary:")
        print(f"  ✅ Updated: {updated_count}")
        print(f"  ❌ Errors: {error_count}")
        print(f"  📝 Total processed: {len(movies)}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Batch fetch Letterboxd ratings')
    parser.add_argument('--limit', type=int, default=100, help='Maximum number of movies to process')
    parser.add_argument('--dry-run', action='store_true', help='Preview what would be updated')
    
    args = parser.parse_args()
    
    batch_fetch_ratings(limit=args.limit, dry_run=args.dry_run)
