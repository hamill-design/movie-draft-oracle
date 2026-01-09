# Letterboxd Rating Integration

## Overview

Letterboxd average ratings have been integrated into the movie scoring system. The final score now includes Letterboxd ratings as one of the component scores.

## What Was Added

### 1. Database Changes
- **Migration**: `supabase/migrations/20250108000000_add_letterboxd_rating.sql`
  - Added `letterboxd_rating` column to `draft_picks` table (DECIMAL(3,2) - stores 0-5 scale)
  - Updated `calculate_new_movie_score` function to include Letterboxd rating
  - Letterboxd ratings are converted from 0-5 scale to 0-100 scale for averaging

### 2. Python Scripts
- **`fetch_movie_rating.py`**: Fetches Letterboxd rating for a single movie
- **`batch_fetch_ratings.py`**: Batch processes movies to fetch Letterboxd ratings

### 3. Score Calculation Updates
- **TypeScript**: `src/utils/scoreCalculator.ts` - Updated to include Letterboxd
- **Edge Function**: `supabase/functions/enrich-movie-data/index.ts` - Updated to handle Letterboxd
- **Frontend**: `src/pages/FinalScores.tsx` - Updated to include Letterboxd in calculations
- **Database Function**: Updated `calculate_new_movie_score` SQL function

### 4. How It Works

The scoring system now averages these components:
1. **Box Office Score** (0-100) - ROI-based formula
2. **RT Critics Score** (0-100) - Direct percentage
3. **Metacritic Score** (0-100) - Direct score
4. **IMDB Score** (0-100) - Converted from 0-10 scale
5. **Letterboxd Score** (0-100) - Converted from 0-5 scale ⭐ NEW

Then adds:
- **Oscar Bonus** (+3 for nominee, +6 for winner)

## Usage

### Fetch Ratings for Existing Movies

```bash
# Dry run to see what would be updated
python3.11 scripts/letterboxd/batch_fetch_ratings.py --limit 50 --dry-run

# Actually fetch ratings
python3.11 scripts/letterboxd/batch_fetch_ratings.py --limit 50
```

### Fetch Rating for a Single Movie

```bash
python3.11 scripts/letterboxd/fetch_movie_rating.py "The Matrix" 1999
```

### Apply Database Migration

```bash
# Apply the migration to add the column and update the function
npx supabase migration up
```

Or manually run:
```sql
-- Run the migration file
\i supabase/migrations/20250108000000_add_letterboxd_rating.sql
```

## Integration Status

### ✅ Completed
- Database schema updated
- Score calculation functions updated
- TypeScript interfaces updated
- Python scripts created
- Frontend components updated

### ⚠️ Pending
- **Automatic fetching**: The `enrich-movie-data` function has a placeholder for Letterboxd fetching. Currently, ratings need to be fetched manually using the Python scripts.

### Future Enhancements
1. **Automatic Integration**: Set up a service/API endpoint to call the Python script from the Edge Function
2. **Background Jobs**: Set up scheduled jobs to batch-fetch ratings for new movies
3. **Real-time Fetching**: Integrate Letterboxd API calls directly into the enrichment function

## Testing

After applying the migration and fetching some ratings:

```bash
# Test fetching a rating
python3.11 scripts/letterboxd/fetch_movie_rating.py "V for Vendetta" 2005

# Test batch processing (dry run first)
python3.11 scripts/letterboxd/batch_fetch_ratings.py --limit 10 --dry-run
```

## Notes

- Letterboxd uses a 0-5 star rating system
- Ratings are stored in the database as DECIMAL(3,2) (e.g., 4.25)
- In score calculations, they're converted to 0-100 scale: `(rating / 5) * 100`
- If a movie doesn't have a Letterboxd rating, it's simply excluded from the average (no penalty)
- Rate limiting: The batch script includes 2-second delays between requests to be respectful

## Troubleshooting

**"Python 3.11 not found"**
- Make sure Python 3.11+ is installed
- Use `python3.11` explicitly or set up a virtual environment

**"No rating found"**
- Some movies may not be on Letterboxd
- Try variations of the movie title
- Check if the movie exists on letterboxd.com

**"Database update failed"**
- Check Supabase credentials in `.env`
- Ensure the migration has been applied
- Verify you have write permissions
