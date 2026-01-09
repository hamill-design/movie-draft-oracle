"""
Fetch Letterboxd average rating for a movie
"""
import sys
import os
import json
from typing import Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from letterboxdpy.movie import Movie
from letterboxdpy.search import Search
from utils import extract_tmdb_id_from_url

def get_letterboxd_rating(movie_title: str, movie_year: Optional[int] = None, tmdb_id: Optional[int] = None) -> Optional[float]:
    """
    Get Letterboxd average rating for a movie
    
    Args:
        movie_title: Movie title
        movie_year: Optional release year
        tmdb_id: Optional TMDB ID (can be used to find Letterboxd slug)
    
    Returns:
        Letterboxd average rating (0-5 scale) or None if not found
    """
    try:
        # Try to construct a slug from the title first (common pattern)
        # Letterboxd slugs are typically: title-lowercase-with-hyphens
        potential_slug = movie_title.lower().replace(' ', '-').replace("'", '').replace(':', '').replace('.', '').replace(',', '')
        
        # Try direct slug access first
        movie = None
        movie_slug = None
        
        try:
            movie = Movie(potential_slug)
            # If this works, we found it
            movie_slug = potential_slug
            print(f"✅ Found movie by slug: {potential_slug}")
        except:
            # Slug didn't work, try search
            try:
                search_query = movie_title
                if movie_year:
                    search_query += f" {movie_year}"
                
                search = Search(search_query, 'films')
                results = search.get_results(max=5)
                
                if not results or len(results) == 0:
                    print(f"⚠️  No Letterboxd results found for: {movie_title}")
                    return None
                
                # Try to find the best match
                best_match = None
                for result in results:
                    result_title = str(result) if hasattr(result, '__str__') else str(result)
                    result_year = getattr(result, 'year', None)
                    
                    # Check if title matches (case-insensitive)
                    if result_title.lower() == movie_title.lower():
                        # If year matches or no year specified, this is likely the right one
                        if not movie_year or result_year == movie_year:
                            best_match = result
                            break
                
                # If no exact match, use first result
                if not best_match:
                    best_match = results[0]
                    print(f"⚠️  Using first search result for: {movie_title} (may not be exact match)")
                
                # Get the movie slug
                movie_slug = getattr(best_match, 'slug', None)
                if not movie_slug:
                    print(f"⚠️  No slug found for: {movie_title}")
                    return None
                
                # Fetch the full movie data
                movie = Movie(movie_slug)
            except Exception as search_error:
                print(f"⚠️  Search failed: {search_error}")
                return None
        
        if not movie:
            print(f"⚠️  Could not fetch movie data for: {movie_title}")
            return None
        
        # Get the rating
        # Letterboxd ratings are typically in the rating attribute
        rating = getattr(movie, 'rating', None)
        
        if rating is None:
            # Try alternative attribute names
            rating = getattr(movie, 'average_rating', None)
            if rating is None:
                rating = getattr(movie, 'avg_rating', None)
        
        if rating is not None:
            # Ensure rating is a float
            try:
                rating_float = float(rating)
                # Letterboxd uses 0-5 scale
                if 0 <= rating_float <= 5:
                    print(f"✅ Found Letterboxd rating for {movie_title}: {rating_float}/5")
                    return rating_float
                else:
                    print(f"⚠️  Invalid rating value for {movie_title}: {rating_float}")
            except (ValueError, TypeError):
                print(f"⚠️  Could not convert rating to float for {movie_title}: {rating}")
        
        print(f"⚠️  No rating found for: {movie_title}")
        return None
        
    except Exception as e:
        print(f"❌ Error fetching Letterboxd rating for {movie_title}: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fetch_movie_rating.py <movie_title> [year] [tmdb_id]")
        sys.exit(1)
    
    movie_title = sys.argv[1]
    movie_year = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else None
    tmdb_id = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else None
    
    rating = get_letterboxd_rating(movie_title, movie_year, tmdb_id)
    
    if rating is not None:
        print(json.dumps({"rating": rating, "scale": "0-5"}))
        sys.exit(0)
    else:
        print(json.dumps({"rating": None, "error": "Rating not found"}))
        sys.exit(1)
