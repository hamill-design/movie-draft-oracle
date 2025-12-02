import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('Error: VITE_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTable() {
  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('actor_spec_categories')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does NOT exist. You need to apply the migration.');
        console.log('\nTo apply it, go to: https://supabase.com/dashboard/project/zduruulowyopdstihfwk/sql/new');
        console.log('And run the SQL from: supabase/migrations/20251113120422_create_actor_spec_categories.sql');
      } else {
        console.error('Error checking table:', error);
      }
    } else {
      console.log('✅ Table exists! Found', data?.length || 0, 'rows');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTable();

