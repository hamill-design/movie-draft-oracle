"""
Fetch Letterboxd list data
"""
# Import compatibility shim for Python 3.9
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from letterboxdpy.list import List
import json
import sys
import os
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from scripts.letterboxd.utils import extract_tmdb_id_from_url

def fetch_list(username: str, list_slug: str) -> Dict[str, Any]:
    """
    Fetch a Letterboxd list
    
    Args:
        username: Letterboxd username
        list_slug: List slug (e.g., "classic-movies-for-beginners")
    
    Returns:
        Dictionary containing list data
    """
    try:
        list_instance = List(username, list_slug)
        
        list_data = {
            'username': username,
            'list_slug': list_slug,
            'title': str(list_instance),
            'description': getattr(list_instance, 'description', None),
            'films': []
        }
        
        # Get films from list
        if hasattr(list_instance, 'films'):
            films = list_instance.films
            
            if isinstance(films, list):
                films_list = films
            elif hasattr(films, '__iter__'):
                films_list = list(films)
            else:
                films_list = []
            
            for film in films_list:
                film_data = {
                    'title': str(film) if hasattr(film, '__str__') else film,
                    'slug': getattr(film, 'slug', None),
                    'tmdb_link': getattr(film, 'tmdb_link', None),
                    'tmdb_id': None,
                    'year': getattr(film, 'year', None),
                    'director': getattr(film, 'director', None),
                    'rating': getattr(film, 'rating', None)
                }
                
                # Extract TMDB ID from link
                if film_data['tmdb_link']:
                    film_data['tmdb_id'] = extract_tmdb_id_from_url(film_data['tmdb_link'])
                
                list_data['films'].append(film_data)
        
        print(f"✅ Fetched list: {list_data['title']} ({len(list_data['films'])} films)")
        return list_data
        
    except Exception as e:
        print(f"❌ Error fetching list: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python fetch_list_data.py <username> <list_slug>")
        sys.exit(1)
    
    username = sys.argv[1]
    list_slug = sys.argv[2]
    
    try:
        data = fetch_list(username, list_slug)
        print(json.dumps(data, indent=2, default=str))
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

