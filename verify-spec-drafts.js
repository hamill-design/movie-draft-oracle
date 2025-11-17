import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_78b7513fdb1dc525f1be7577c75e88cdc658cf91';

const supabase = createClient(SUPABASE_URL, SUPABASE_ACCESS_TOKEN);

async function verifyTables() {
  try {
    console.log('🔍 Verifying spec_drafts tables...\n');
    
    // Try to query each table
    const tables = ['spec_drafts', 'spec_draft_movies', 'spec_draft_movie_categories'];
    
    for (const tableName of tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Table exists and is accessible`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying tables:', error);
  }
}

verifyTables();

