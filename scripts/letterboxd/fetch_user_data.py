"""
Fetch user data from Letterboxd
"""
# Import compatibility shim for Python 3.9
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from letterboxdpy.user import User
import json
import sys
from typing import Optional, Dict, Any

def fetch_user_data(username: str) -> Dict[str, Any]:
    """
    Fetch a user's data from Letterboxd
    
    Args:
        username: Letterboxd username
    
    Returns:
        Dictionary containing user data
    """
    try:
        user = User(username)
        
        user_data = {
            'username': username,
            'display_name': str(user),
            'profile': {}
        }
        
        # Try to get additional user attributes
        if hasattr(user, 'watched_count'):
            user_data['watched_count'] = user.watched_count
        if hasattr(user, 'watchlist_count'):
            user_data['watchlist_count'] = user.watchlist_count
        if hasattr(user, 'likes_count'):
            user_data['likes_count'] = user.likes_count
        if hasattr(user, 'lists_count'):
            user_data['lists_count'] = user.lists_count
        
        # Get user profile data
        if hasattr(user, 'profile'):
            user_data['profile'] = user.profile
        
        print(f"✅ Fetched data for user: {username}")
        return user_data
        
    except Exception as e:
        print(f"❌ Error fetching user data: {e}")
        raise

def fetch_user_watchlist(username: str, max_films: Optional[int] = None) -> Dict[str, Any]:
    """
    Fetch a user's watchlist from Letterboxd
    
    Args:
        username: Letterboxd username
        max_films: Maximum number of films to fetch (None for all)
    
    Returns:
        Dictionary containing watchlist data
    """
    try:
        user = User(username)
        
        watchlist_data = {
            'username': username,
            'watchlist': []
        }
        
        # Get watchlist
        if hasattr(user, 'watchlist'):
            watchlist = user.watchlist
            
            if isinstance(watchlist, list):
                films = watchlist[:max_films] if max_films else watchlist
            elif hasattr(watchlist, '__iter__'):
                films = list(watchlist)[:max_films] if max_films else list(watchlist)
            else:
                films = []
            
            for film in films:
                film_data = {
                    'title': str(film) if hasattr(film, '__str__') else film,
                    'slug': getattr(film, 'slug', None),
                    'tmdb_link': getattr(film, 'tmdb_link', None),
                    'year': getattr(film, 'year', None)
                }
                watchlist_data['watchlist'].append(film_data)
        
        print(f"✅ Fetched watchlist for user: {username} ({len(watchlist_data['watchlist'])} films)")
        return watchlist_data
        
    except Exception as e:
        print(f"❌ Error fetching watchlist: {e}")
        raise

def fetch_user_diary(username: str, max_entries: Optional[int] = None) -> Dict[str, Any]:
    """
    Fetch a user's diary (watched films) from Letterboxd
    
    Args:
        username: Letterboxd username
        max_entries: Maximum number of entries to fetch (None for all)
    
    Returns:
        Dictionary containing diary data
    """
    try:
        user = User(username)
        
        diary_data = {
            'username': username,
            'diary': []
        }
        
        # Get diary
        if hasattr(user, 'diary'):
            diary = user.diary
            
            if isinstance(diary, list):
                entries = diary[:max_entries] if max_entries else diary
            elif hasattr(diary, '__iter__'):
                entries = list(diary)[:max_entries] if max_entries else list(diary)
            else:
                entries = []
            
            for entry in entries:
                entry_data = {
                    'title': str(entry) if hasattr(entry, '__str__') else entry,
                    'slug': getattr(entry, 'slug', None),
                    'tmdb_link': getattr(entry, 'tmdb_link', None),
                    'year': getattr(entry, 'year', None),
                    'watched_date': getattr(entry, 'watched_date', None),
                    'rating': getattr(entry, 'rating', None)
                }
                diary_data['diary'].append(entry_data)
        
        print(f"✅ Fetched diary for user: {username} ({len(diary_data['diary'])} entries)")
        return diary_data
        
    except Exception as e:
        print(f"❌ Error fetching diary: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fetch_user_data.py <username> [watchlist|diary|profile] [max_count]")
        sys.exit(1)
    
    username = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "profile"
    max_count = int(sys.argv[3]) if len(sys.argv) > 3 else None
    
    try:
        if mode == "watchlist":
            data = fetch_user_watchlist(username, max_count)
        elif mode == "diary":
            data = fetch_user_diary(username, max_count)
        else:
            data = fetch_user_data(username)
        
        print(json.dumps(data, indent=2, default=str))
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

