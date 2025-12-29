#!/bin/bash

# Setup script for New Year's Eve Spec Draft creation
# This script helps you set up authentication

echo "🔐 Setting up authentication for Spec Draft creation script"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    touch .env
fi

# Check if service key is already set
if grep -q "SUPABASE_SERVICE_KEY" .env 2>/dev/null; then
    echo "✓ SUPABASE_SERVICE_KEY already found in .env"
    echo ""
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing key."
        exit 0
    fi
fi

echo "📋 To get your Supabase Service Role Key:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/zduruulowyopdstihfwk/settings/api"
echo "2. Scroll down to 'Project API keys'"
echo "3. Find the 'service_role' key (⚠️  Keep this secret!)"
echo "4. Copy the key"
echo ""
read -p "Paste your service_role key here: " SERVICE_KEY

if [ -z "$SERVICE_KEY" ]; then
    echo "❌ No key provided. Exiting."
    exit 1
fi

# Add or update the key in .env
if grep -q "SUPABASE_SERVICE_KEY" .env 2>/dev/null; then
    # Update existing key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SERVICE_KEY|" .env
    else
        # Linux
        sed -i "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SERVICE_KEY|" .env
    fi
    echo "✓ Updated SUPABASE_SERVICE_KEY in .env"
else
    # Add new key
    echo "" >> .env
    echo "# Supabase Service Role Key (for admin operations)" >> .env
    echo "SUPABASE_SERVICE_KEY=$SERVICE_KEY" >> .env
    echo "✓ Added SUPABASE_SERVICE_KEY to .env"
fi

echo ""
echo "✅ Authentication setup complete!"
echo ""
echo "Now you can run the script with:"
echo "  source .env && node create-new-years-eve-spec-draft.js"
echo ""
echo "Or export the variable manually:"
echo "  export SUPABASE_SERVICE_KEY=$SERVICE_KEY"
echo "  node create-new-years-eve-spec-draft.js"

