"""
Apply the Letterboxd rating migration directly to the database
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import scripts.letterboxd.compat

from scripts.letterboxd.utils import get_supabase_client

def apply_migration():
    """Apply the Letterboxd rating migration"""
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Cannot connect to Supabase")
        return False
    
    # Read the migration SQL file
    migration_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'supabase',
        'migrations',
        '20250108000000_add_letterboxd_rating.sql'
    )
    
    if not os.path.exists(migration_file):
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    print("📝 Applying Letterboxd rating migration...")
    print("=" * 60)
    
    # Split the SQL into individual statements
    # PostgreSQL functions need to be executed as a single statement
    statements = []
    current_statement = []
    
    for line in migration_sql.split('\n'):
        # Skip comments and empty lines for splitting
        stripped = line.strip()
        if stripped.startswith('--') or not stripped:
            continue
        
        current_statement.append(line)
        
        # Check if this line ends a statement (semicolon not in a string)
        if ';' in line and not (line.count("'") % 2 == 1):
            statements.append('\n'.join(current_statement))
            current_statement = []
    
    # Add any remaining statement
    if current_statement:
        statements.append('\n'.join(current_statement))
    
    try:
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            if not statement.strip():
                continue
            
            print(f"\n📋 Executing statement {i}/{len(statements)}...")
            print(f"   {statement[:100]}..." if len(statement) > 100 else f"   {statement}")
            
            # Use Supabase RPC or direct SQL execution
            # Note: Supabase Python client doesn't have direct SQL execution
            # We'll need to use the REST API or psycopg2
            
            # For now, let's use psycopg2 if available
            try:
                import psycopg2
                from urllib.parse import urlparse
                
                # Get database connection string from environment
                supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
                supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
                
                if not supabase_url:
                    print("❌ SUPABASE_URL not found in environment")
                    return False
                
                # Extract database connection info from Supabase URL
                # Supabase URL format: https://[project-ref].supabase.co
                # We need to construct the direct database connection
                # This requires the database password which we don't have
                
                print("⚠️  Direct SQL execution requires database password")
                print("   Please apply the migration via Supabase Dashboard instead")
                print("\n📋 Migration SQL:")
                print("=" * 60)
                print(migration_sql)
                print("=" * 60)
                print("\n💡 To apply:")
                print("   1. Go to https://supabase.com/dashboard")
                print("   2. Select your project")
                print("   3. Go to SQL Editor")
                print("   4. Paste the SQL above and run it")
                
                return False
                
            except ImportError:
                print("⚠️  psycopg2 not available for direct SQL execution")
                print("   Please apply the migration via Supabase Dashboard")
                return False
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n✅ Migration applied successfully!")
    return True

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)
