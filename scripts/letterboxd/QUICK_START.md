# Letterboxd Rating Integration - Quick Start

## ✅ What's Been Done

1. **Database Migration Created**: `supabase/migrations/20250108000000_add_letterboxd_rating.sql`
   - Adds `letterboxd_rating` column to `draft_picks` table
   - Updates `calculate_new_movie_score` function to include Letterboxd

2. **Score Calculation Updated**: Letterboxd ratings are now included in final scores
   - Letterboxd (0-5 scale) → converted to 0-100 scale
   - Averaged with: Box Office, RT Critics, Metacritic, IMDB
   - Plus Oscar bonus

3. **Python Scripts Ready**: 
   - `fetch_movie_rating.py` - Fetch single movie rating
   - `batch_fetch_ratings.py` - Batch process movies

## 🚀 Next Steps

### 1. Apply Database Migration

**Option A: Via Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/20250108000000_add_letterboxd_rating.sql`
4. Run the migration

**Option B: Via CLI (if local Supabase is running)**
```bash
npx supabase migration up
```

### 2. Test Fetching a Rating

```bash
# Test with a known movie slug
python3.11 scripts/letterboxd/fetch_movie_rating.py "v-for-vendetta" 2005

# Test with a movie title (will try to generate slug)
python3.11 scripts/letterboxd/fetch_movie_rating.py "The Matrix" 1999
```

### 3. Batch Fetch Ratings for Existing Movies

```bash
# Preview what would be updated (dry run)
python3.11 scripts/letterboxd/batch_fetch_ratings.py --limit 10 --dry-run

# Actually fetch ratings (start with a small limit)
python3.11 scripts/letterboxd/batch_fetch_ratings.py --limit 10
```

### 4. Verify Integration

After fetching some ratings:
1. Check the database: `SELECT movie_title, letterboxd_rating FROM draft_picks WHERE letterboxd_rating IS NOT NULL LIMIT 10;`
2. Scores should automatically recalculate to include Letterboxd
3. View final scores in your app - Letterboxd will be included in the average

## 📝 Notes

- **Slug Format**: Letterboxd uses slugs like "v-for-vendetta", "the-matrix"
- **Rating Scale**: Letterboxd uses 0-5 stars, stored as DECIMAL(3,2)
- **Score Conversion**: (rating / 5) * 100 for 0-100 scale
- **Rate Limiting**: Batch script includes 2-second delays between requests

## 🔧 Troubleshooting

**"No rating found"**
- Try using the Letterboxd slug directly (e.g., "v-for-vendetta")
- Check if the movie exists on letterboxd.com
- Some movies may not have ratings yet

**"Search failed"**
- The search function in letterboxdpy may have issues with some queries
- Try using the slug directly instead of title search

**Database errors**
- Make sure the migration has been applied
- Check Supabase credentials in `.env`

## 📚 Full Documentation

See `LETTERBOXD_RATING_INTEGRATION.md` for complete details.
