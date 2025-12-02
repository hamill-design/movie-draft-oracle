#!/bin/bash

# Script to apply the actor_spec_categories migration
# Usage: ./apply-migration.sh

echo "Applying actor_spec_categories migration..."

# Check if Supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js/npm first."
    exit 1
fi

# Read the migration file
MIGRATION_FILE="supabase/migrations/20251113120422_create_actor_spec_categories.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "Migration file found. Please choose an option:"
echo "1. Apply via Supabase Dashboard SQL Editor (recommended)"
echo "2. Apply via CLI (requires login)"
echo ""
echo "For option 1, copy the contents of $MIGRATION_FILE and paste into SQL Editor"
echo "For option 2, run: npx supabase login --token YOUR_TOKEN"
echo "                  npx supabase link --project-ref zduruulowyopdstihfwk"
echo "                  npx supabase db push"

