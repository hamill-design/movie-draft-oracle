# Letterboxd Integration Scripts

Python scripts for fetching and syncing Letterboxd data to the Movie Draft Oracle database.

## Setup

### 0. Python Version Requirement

**⚠️ Important:** The `letterboxdpy` library requires **Python 3.10 or higher** due to its use of modern Python syntax (union types with `|` operator).

**Current Python version:** Check with `python3 --version`

**If you're on Python 3.9 or earlier:**
- **Option 1 (Recommended):** Upgrade to Python 3.10+ using [pyenv](https://github.com/pyenv/pyenv) or [Homebrew](https://brew.sh/)
  ```bash
  # Using Homebrew on macOS
  brew install python@3.11
  python3.11 -m pip install -r requirements.txt
  ```
- **Option 2:** Use a virtual environment with Python 3.10+
  ```bash
  python3.10 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Note:** If you have multiple Python versions, use the specific version:
```bash
python3.10 -m pip install -r requirements.txt
# or
python3.11 -m pip install -r requirements.txt
```

Or if you prefer using a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the `.env.example` file and add your Supabase credentials:

```bash
cp env.example .env
```

Edit `.env` and add:

```bash
# Supabase Configuration (for Python scripts)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note:** For read-only operations, you can use `SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`. However, for syncing data to spec drafts, you'll need the service role key.

## Usage

### Fetch User Data

Get basic user profile information:

```bash
python scripts/letterboxd/fetch_user_data.py <username>
```

Get user's watchlist:

```bash
python scripts/letterboxd/fetch_user_data.py <username> watchlist [max_count]
```

Get user's diary (watched films):

```bash
python scripts/letterboxd/fetch_user_data.py <username> diary [max_count]
```

**Example:**
```bash
python scripts/letterboxd/fetch_user_data.py nmcassa
python scripts/letterboxd/fetch_user_data.py nmcassa watchlist 10
```

### Fetch Movie Data

Fetch a movie by its Letterboxd slug:

```bash
python scripts/letterboxd/fetch_movie_data.py slug <movie_slug>
```

Search for movies:

```bash
python scripts/letterboxd/fetch_movie_data.py search "<query>" [max_results]
```

**Examples:**
```bash
python scripts/letterboxd/fetch_movie_data.py slug v-for-vendetta
python scripts/letterboxd/fetch_movie_data.py search "V for Vendetta" 5
```

### Fetch List Data

Get a Letterboxd list:

```bash
python scripts/letterboxd/fetch_list_data.py <username> <list_slug>
```

**Example:**
```bash
python scripts/letterboxd/fetch_list_data.py hepburnluv classic-movies-for-beginners
```

### Sync List to Spec Draft

Sync a Letterboxd list to a spec draft in your Supabase database:

```bash
python scripts/letterboxd/sync_to_supabase.py list <username> <list_slug> <spec_draft_id>
```

**Dry run** (preview what would be synced without making changes):

```bash
python scripts/letterboxd/sync_to_supabase.py list <username> <list_slug> <spec_draft_id> --dry-run
```

**Example:**
```bash
# First, do a dry run to see what would be synced
python scripts/letterboxd/sync_to_supabase.py list hepburnluv classic-movies-for-beginners <your-spec-draft-uuid> --dry-run

# Then actually sync it
python scripts/letterboxd/sync_to_supabase.py list hepburnluv classic-movies-for-beginners <your-spec-draft-uuid>
```

## How It Works

### TMDB ID Matching

Letterboxd uses TMDB (The Movie Database) for film metadata. The scripts automatically extract TMDB IDs from Letterboxd movie data, which allows seamless integration with your existing database that uses TMDB IDs.

### Data Flow

1. **Fetch from Letterboxd**: Scripts use `letterboxdpy` to fetch data from Letterboxd
2. **Extract TMDB IDs**: TMDB IDs are extracted from Letterboxd movie links
3. **Sync to Supabase**: Movies are added to `spec_draft_movies` table with their TMDB IDs

### Spec Draft Integration

When syncing a list to a spec draft:
- Movies are matched by TMDB ID
- Duplicate movies (already in the spec draft) are skipped
- Movie titles, years, and genres are preserved
- Poster paths can be populated later via TMDB API calls

## Troubleshooting

### "Supabase credentials not found"

Make sure you've:
1. Created a `.env` file in the project root
2. Added `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`)
3. The script is being run from the project root directory

### "No TMDB ID found"

Some movies on Letterboxd may not have TMDB links. In this case:
- The movie will be skipped during sync
- You can manually add it later or use the TMDB search function

### Rate Limiting

Letterboxd may rate limit requests. If you encounter errors:
- Add delays between requests
- Process lists in smaller batches
- Use the `max_count` parameter to limit results

## Future Enhancements

- [ ] Sync user watchlists to spec drafts
- [ ] Batch processing for large lists
- [ ] Automatic poster path fetching from TMDB
- [ ] Genre mapping from Letterboxd to TMDB genre IDs
- [ ] Progress bars for long-running syncs
- [ ] Resume capability for interrupted syncs

## Notes

- Letterboxd data is publicly available, but be respectful of rate limits
- The `letterboxdpy` library may have limitations - check the [GitHub repository](https://github.com/nmcassa/letterboxdpy) for the latest API
- Some Letterboxd features may require authentication (not currently supported)

