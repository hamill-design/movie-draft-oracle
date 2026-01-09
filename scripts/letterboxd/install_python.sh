#!/bin/bash
# Script to install Python 3.11+ on macOS
# Run this script in your terminal: bash scripts/letterboxd/install_python.sh

set -e

echo "🐍 Python Installation Script for Letterboxd Integration"
echo "=================================================="
echo ""

# Check current Python version
CURRENT_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Current Python version: $CURRENT_VERSION"

# Check if Python 3.10+ is already available
if command -v python3.11 &> /dev/null; then
    PYTHON311_VERSION=$(python3.11 --version 2>&1 | awk '{print $2}')
    echo "✅ Python 3.11 found: $PYTHON311_VERSION"
    echo "You can use: python3.11 scripts/letterboxd/test_connection.py"
    exit 0
fi

if command -v python3.10 &> /dev/null; then
    PYTHON310_VERSION=$(python3.10 --version 2>&1 | awk '{print $2}')
    echo "✅ Python 3.10 found: $PYTHON310_VERSION"
    echo "You can use: python3.10 scripts/letterboxd/test_connection.py"
    exit 0
fi

echo ""
echo "Python 3.10+ not found. Installing via Homebrew..."
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "📦 Homebrew not found. Installing Homebrew..."
    echo "   This will require your password and may take a few minutes."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH (for Apple Silicon Macs)
    if [ -f "/opt/homebrew/bin/brew" ]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    # Add Homebrew to PATH (for Intel Macs)
    if [ -f "/usr/local/bin/brew" ]; then
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zshrc
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew is already installed"
    brew --version
fi

echo ""
echo "📦 Installing Python 3.11 via Homebrew..."
brew install python@3.11

echo ""
echo "✅ Python 3.11 installed!"
python3.11 --version

echo ""
echo "📦 Installing Python dependencies..."
cd "$(dirname "$0")/../.."
python3.11 -m pip install -r requirements.txt

echo ""
echo "✅ Installation complete!"
echo ""
echo "You can now run:"
echo "  python3.11 scripts/letterboxd/test_connection.py"
echo "  python3.11 scripts/letterboxd/fetch_movie_data.py slug v-for-vendetta"


