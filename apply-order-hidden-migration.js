import { readFileSync } from 'fs';

// Script to help apply the spec_drafts order and hidden migration
// This script will display the SQL that needs to be run

const MIGRATION_FILE = 'supabase/migrations/20251116000000_add_order_and_hidden_to_spec_drafts.sql';

try {
  console.log('📄 Reading migration file...\n');
  const migrationSQL = readFileSync(MIGRATION_FILE, 'utf8');
  
  console.log('='.repeat(80));
  console.log('SQL MIGRATION TO APPLY:');
  console.log('='.repeat(80));
  console.log('\n');
  console.log(migrationSQL);
  console.log('\n');
  console.log('='.repeat(80));
  console.log('\n');
  console.log('📋 INSTRUCTIONS:');
  console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Select your project: zduruulowyopdstihfwk');
  console.log('3. Go to SQL Editor (left sidebar)');
  console.log('4. Click "New query"');
  console.log('5. Copy and paste the SQL above');
  console.log('6. Click "Run" to execute');
  console.log('\n');
  console.log('✅ After applying, the display_order and is_hidden columns will be added to spec_drafts!');
  console.log('   This will enable reordering and hiding functionality in the admin panel.');
  console.log('\n');
} catch (error) {
  console.error('❌ Error reading migration file:', error);
  process.exit(1);
}

