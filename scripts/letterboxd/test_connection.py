"""
Simple test script to verify Letterboxd and Supabase connections
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Import compatibility shim for Python 3.9
import scripts.letterboxd.compat

def test_letterboxd():
    """Test Letterboxd connection"""
    try:
        from letterboxdpy.movie import Movie
        from letterboxdpy.user import User
        from letterboxdpy.search import Search
        
        print("✅ Letterboxd imports successful")
        
        # Test fetching a movie
        print("\n📽️  Testing movie fetch...")
        movie = Movie("v-for-vendetta")
        print(f"   Movie: {movie}")
        
        # Test user fetch
        print("\n👤 Testing user fetch...")
        user = User("nmcassa")
        print(f"   User: {user}")
        
        # Test search
        print("\n🔍 Testing search...")
        search = Search("V for Vendetta", 'films')
        results = search.get_results(max=3)
        print(f"   Found {len(results)} results")
        
        return True
    except Exception as e:
        print(f"❌ Letterboxd test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_supabase():
    """Test Supabase connection"""
    try:
        from scripts.letterboxd.utils import get_supabase_client
        
        print("\n✅ Supabase imports successful")
        
        supabase = get_supabase_client()
        if supabase:
            print("✅ Supabase client created successfully")
            
            # Test a simple query
            print("\n📊 Testing database connection...")
            result = supabase.table('spec_drafts').select('id, name').limit(1).execute()
            if result.data:
                print(f"   ✅ Database connection successful (found {len(result.data)} spec draft(s))")
            else:
                print("   ⚠️  Database connection successful but no data found")
            return True
        else:
            print("❌ Failed to create Supabase client (check environment variables)")
            return False
    except Exception as e:
        print(f"❌ Supabase test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 Testing Letterboxd Integration Setup\n")
    print("=" * 50)
    
    letterboxd_ok = test_letterboxd()
    supabase_ok = test_supabase()
    
    print("\n" + "=" * 50)
    if letterboxd_ok and supabase_ok:
        print("✅ All tests passed! Setup is complete.")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Please check the errors above.")
        sys.exit(1)

