"""
Fetch movie data from Letterboxd
"""
# Import compatibility shim for Python 3.9
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from letterboxdpy.movie import Movie
from letterboxdpy.search import Search
import json
import sys
import os
from typing import Optional, List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scripts.letterboxd.utils import extract_tmdb_id_from_url

def fetch_movie_by_slug(slug: str) -> Dict[str, Any]:
    """
    Fetch movie data by Letterboxd slug
    
    Args:
        slug: Letterboxd movie slug (e.g., "v-for-vendetta")
    
    Returns:
        Dictionary containing movie data
    """
    try:
        movie = Movie(slug)
        
        movie_data = {
            'slug': slug,
            'title': str(movie),
            'tmdb_link': getattr(movie, 'tmdb_link', None),
            'tmdb_id': None,
            'year': getattr(movie, 'year', None),
            'director': getattr(movie, 'director', None),
            'runtime': getattr(movie, 'runtime', None),
            'rating': getattr(movie, 'rating', None),
            'description': getattr(movie, 'description', None),
            'genres': getattr(movie, 'genres', None),
            'poster': getattr(movie, 'poster', None)
        }
        
        # Extract TMDB ID from link
        if movie_data['tmdb_link']:
            movie_data['tmdb_id'] = extract_tmdb_id_from_url(movie_data['tmdb_link'])
        
        print(f"✅ Fetched movie: {movie_data['title']} (TMDB ID: {movie_data['tmdb_id']})")
        return movie_data
        
    except Exception as e:
        print(f"❌ Error fetching movie: {e}")
        raise

def search_movies(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search for movies on Letterboxd
    
    Args:
        query: Search query
        max_results: Maximum number of results
    
    Returns:
        List of movie search results
    """
    try:
        search = Search(query, 'films')
        results = search.get_results(max=max_results)
        
        formatted_results = []
        for result in results:
            result_data = {
                'title': str(result) if hasattr(result, '__str__') else result,
                'slug': getattr(result, 'slug', None),
                'tmdb_link': getattr(result, 'tmdb_link', None),
                'tmdb_id': None,
                'year': getattr(result, 'year', None)
            }
            
            # Extract TMDB ID from link
            if result_data['tmdb_link']:
                result_data['tmdb_id'] = extract_tmdb_id_from_url(result_data['tmdb_link'])
            
            formatted_results.append(result_data)
        
        print(f"✅ Found {len(formatted_results)} results for: {query}")
        return formatted_results
        
    except Exception as e:
        print(f"❌ Error searching movies: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fetch_movie_data.py <slug|search> <query> [max_results]")
        sys.exit(1)
    
    mode = sys.argv[1]
    
    if mode == "slug":
        slug = sys.argv[2] if len(sys.argv) > 2 else "v-for-vendetta"
        data = fetch_movie_by_slug(slug)
        print(json.dumps(data, indent=2, default=str))
    elif mode == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else "V for Vendetta"
        max_results = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        results = search_movies(query, max_results)
        print(json.dumps(results, indent=2, default=str))
    else:
        print("Invalid mode. Use 'slug' or 'search'")
        sys.exit(1)

