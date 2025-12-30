import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const MIGRATION_FILE = 'supabase/migrations/20250115000000_create_support_emails_table.sql';

async function applyMigration() {
  try {
    if (!SUPABASE_ACCESS_TOKEN) {
      console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
      console.log('\n📋 Please apply manually via Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/zduruulowyopdstihfwk/sql/new\n');
      return;
    }

    console.log('📄 Reading migration file...');
    const migrationSQL = readFileSync(MIGRATION_FILE, 'utf8');
    
    const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) {
      throw new Error('Could not extract project ref from URL');
    }

    console.log('\n📤 Applying migration via Supabase Management API...\n');
    
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const response = await fetch(managementApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error from Management API:', response.status, errorText);
      console.log('\n📋 Please apply manually via Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/' + projectRef + '/sql/new\n');
      console.log('SQL:');
      console.log(migrationSQL);
      return;
    }

    const result = await response.json();
    console.log('✅ Migration applied successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    console.log('\n📋 Please apply manually via Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/zduruulowyopdstihfwk/sql/new\n');
  }
}

applyMigration();

