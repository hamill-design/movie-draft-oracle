import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_78b7513fdb1dc525f1be7577c75e88cdc658cf91';

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_ACCESS_TOKEN);

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSQL = readFileSync('apply-helpers-direct.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    // Remove comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.includes('Copy everything'))
      .map(s => s.replace(/--.*$/gm, '').trim())
      .filter(s => s.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0 && !statement.startsWith('--')) {
        console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
        console.log(`Preview: ${statement.substring(0, 100)}...`);
        
        // Use RPC to execute SQL (if available) or direct query
        // Note: Supabase JS client doesn't support arbitrary SQL execution
        // We'll need to use the Management API or SQL Editor
        console.log('⚠️  Supabase JS client cannot execute arbitrary SQL.');
        console.log('Please apply this migration via Supabase SQL Editor instead.');
        break;
      }
    }
    
    console.log('\n✅ Migration file prepared.');
    console.log('📝 Please apply it via Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/zduruulowyopdstihfwk/sql/new');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

applyMigration();


