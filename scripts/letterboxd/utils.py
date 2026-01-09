"""
Utility functions for Letterboxd integration
"""
import os
import re
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def get_supabase_client() -> Optional[Client]:
    """
    Create Supabase client from environment variables
    
    Returns:
        Supabase client instance or None if credentials are missing
    """
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("⚠️  Supabase credentials not found in environment")
        print("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)")
        return None
    
    return create_client(supabase_url, supabase_key)

def extract_tmdb_id_from_url(tmdb_url: str) -> Optional[int]:
    """
    Extract TMDB ID from a TMDB URL
    
    Args:
        tmdb_url: URL like "https://www.themoviedb.org/movie/12345"
    
    Returns:
        TMDB ID as integer or None if not found
    """
    if not tmdb_url:
        return None
    
    # Extract ID from URL
    match = re.search(r'/movie/(\d+)', tmdb_url)
    if match:
        return int(match.group(1))
    
    return None

def match_letterboxd_to_tmdb(letterboxd_slug: str) -> Optional[int]:
    """
    Get TMDB ID from a Letterboxd movie slug
    
    Args:
        letterboxd_slug: Letterboxd movie slug (e.g., "v-for-vendetta")
    
    Returns:
        TMDB ID or None if not found
    """
    try:
        from letterboxdpy.movie import Movie
        movie = Movie(letterboxd_slug)
        
        if hasattr(movie, 'tmdb_link') and movie.tmdb_link:
            return extract_tmdb_id_from_url(movie.tmdb_link)
        
        return None
    except Exception as e:
        print(f"⚠️  Error matching Letterboxd movie {letterboxd_slug} to TMDB: {e}")
        return None

def search_tmdb_via_supabase(title: str, year: Optional[int] = None) -> Optional[int]:
    """
    Search for a movie in TMDB via Supabase function
    
    Args:
        title: Movie title
        year: Optional release year
    
    Returns:
        TMDB ID or None if not found
    """
    supabase = get_supabase_client()
    if not supabase:
        return None
    
    try:
        # Use the existing fetch-movies function
        search_query = f"{title}"
        if year:
            search_query += f" {year}"
        
        response = supabase.functions.invoke('fetch-movies', {
            'body': {
                'category': 'search',
                'movieSearchQuery': search_query,
                'page': 1
            }
        })
        
        if response and response.get('results') and len(response['results']) > 0:
            # Return the first result's TMDB ID
            return response['results'][0].get('id')
        
        return None
    except Exception as e:
        print(f"⚠️  Error searching TMDB via Supabase: {e}")
        return None


