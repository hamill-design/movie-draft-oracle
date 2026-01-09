# Installing Python 3.10+ on macOS

Your current Python version (3.9.6) is too old for `letterboxdpy`. Here are the best options to upgrade:

## Option 1: Install Homebrew (Recommended)

Homebrew is the easiest way to manage Python on macOS.

### Step 1: Install Homebrew
Open Terminal and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions. You may need to enter your password.

### Step 2: Install Python 3.11
```bash
brew install python@3.11
```

### Step 3: Verify Installation
```bash
python3.11 --version
# Should show: Python 3.11.x
```

### Step 4: Install Dependencies
```bash
python3.11 -m pip install -r requirements.txt
```

### Step 5: Use Python 3.11 for Scripts
```bash
python3.11 scripts/letterboxd/test_connection.py
```

## Option 2: Official Python Installer

1. Visit: https://www.python.org/downloads/
2. Download Python 3.11 or 3.12 for macOS
3. Run the installer
4. After installation, verify:
   ```bash
   python3.11 --version
   ```

## Option 3: pyenv (For Multiple Python Versions)

If you want to manage multiple Python versions:

### Step 1: Install pyenv
```bash
curl https://pyenv.run | bash
```

### Step 2: Add to Shell Profile
Add these lines to `~/.zshrc` (or `~/.bash_profile` if using bash):
```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
```

Then reload:
```bash
source ~/.zshrc
```

### Step 3: Install Python 3.11
```bash
pyenv install 3.11.7
pyenv local 3.11.7
```

### Step 4: Verify
```bash
python --version
# Should show: Python 3.11.7
```

## Quick Test After Installation

Once you have Python 3.10+ installed:

```bash
# Check version
python3.11 scripts/letterboxd/CHECK_PYTHON_VERSION.py

# Test connections
python3.11 scripts/letterboxd/test_connection.py

# Try fetching a movie
python3.11 scripts/letterboxd/fetch_movie_data.py slug v-for-vendetta
```

## Troubleshooting

**If `python3.11` command not found:**
- Make sure the installation completed successfully
- Check your PATH: `echo $PATH`
- Try the full path: `/usr/local/bin/python3.11` or `/opt/homebrew/bin/python3.11`

**If pip install fails:**
- Use the specific Python version: `python3.11 -m pip install -r requirements.txt`
- Make sure you're in the project directory

**Need help?**
- Check the main README: `scripts/letterboxd/README.md`
- Check setup status: `scripts/letterboxd/SETUP_STATUS.md`


