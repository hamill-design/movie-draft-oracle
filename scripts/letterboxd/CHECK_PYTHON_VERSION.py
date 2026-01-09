#!/usr/bin/env python3
"""
Check if Python version is compatible with letterboxdpy
"""
import sys

def check_python_version():
    """Check if Python version meets requirements"""
    version = sys.version_info
    min_version = (3, 10)
    
    print(f"Python version: {version.major}.{version.minor}.{version.micro}")
    
    if version >= min_version:
        print("✅ Python version is compatible with letterboxdpy")
        return True
    else:
        print(f"❌ Python version {version.major}.{version.minor}.{version.micro} is too old")
        print(f"   letterboxdpy requires Python {min_version[0]}.{min_version[1]}+")
        print("\nOptions:")
        print("  1. Upgrade Python using pyenv or Homebrew")
        print("  2. Use a virtual environment with Python 3.10+")
        print("  3. Install Python 3.10+ and use it explicitly:")
        print("     python3.10 -m pip install -r requirements.txt")
        return False

if __name__ == "__main__":
    compatible = check_python_version()
    sys.exit(0 if compatible else 1)


