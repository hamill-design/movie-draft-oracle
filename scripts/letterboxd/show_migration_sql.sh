#!/bin/bash
# Display the migration SQL for easy copying

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Letterboxd Rating Migration SQL                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Copy the SQL below and run it in Supabase Dashboard → SQL Editor"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

cat "$(dirname "$0")/../../supabase/migrations/20250108000000_add_letterboxd_rating.sql"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 Steps to apply:"
echo "   1. Go to https://supabase.com/dashboard"
echo "   2. Select your project (zduruulowyopdstihfwk)"
echo "   3. Navigate to SQL Editor"
echo "   4. Paste the SQL above"
echo "   5. Click 'Run' to execute"
echo ""
