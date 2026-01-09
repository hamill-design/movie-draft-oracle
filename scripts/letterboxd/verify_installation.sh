#!/bin/bash
# Quick verification script after Python installation
# Run: bash scripts/letterboxd/verify_installation.sh

echo "🔍 Verifying Python Installation..."
echo ""

# Check for Python 3.10+
for version in python3.12 python3.11 python3.10; do
    if command -v $version &> /dev/null; then
        INSTALLED_VERSION=$($version --version 2>&1)
        echo "✅ Found: $INSTALLED_VERSION"
        
        # Check if it's compatible
        echo ""
        echo "Running compatibility check..."
        $version scripts/letterboxd/CHECK_PYTHON_VERSION.py
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "📦 Installing/updating dependencies..."
            $version -m pip install -r requirements.txt --quiet
            
            echo ""
            echo "🧪 Testing connections..."
            $version scripts/letterboxd/test_connection.py
            
            echo ""
            echo "✅ Setup complete! You can now use:"
            echo "   $version scripts/letterboxd/fetch_movie_data.py slug v-for-vendetta"
            exit 0
        fi
    fi
done

echo "❌ Python 3.10+ not found"
echo ""
echo "Please install Python 3.10+ using one of these methods:"
echo "  1. Double-click /tmp/python311.pkg (if downloaded)"
echo "  2. Visit https://www.python.org/downloads/"
echo "  3. Install Homebrew and run: brew install python@3.11"
exit 1

