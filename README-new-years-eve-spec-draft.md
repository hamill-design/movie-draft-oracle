# New Year's Eve Spec Draft Creation Script

This script creates a new spec draft called "New Year's Eve" with all the movies you specified, organized by their categories.

## Prerequisites

1. Node.js installed
2. Access to the Supabase project (you need to be authenticated as an admin user)

## Setup

### Quick Setup (Recommended)

Run the setup script to configure authentication:

```bash
./setup-auth.sh
```

This will guide you through getting your Supabase Service Role Key and setting it up.

### Manual Setup

1. Get your Supabase Service Role Key:
   - Go to: https://supabase.com/dashboard/project/zduruulowyopdstihfwk/settings/api
   - Scroll to "Project API keys"
   - Copy the `service_role` key (⚠️ **Keep this secret!**)

2. Set the environment variable:

   **Option A: Export in terminal (temporary)**
   ```bash
   export SUPABASE_SERVICE_KEY=your_service_role_key_here
   ```

   **Option B: Add to .env file (persistent)**
   ```bash
   echo "SUPABASE_SERVICE_KEY=your_service_role_key_here" >> .env
   source .env
   ```

   **Option C: Use inline (one-time)**
   ```bash
   SUPABASE_SERVICE_KEY=your_service_role_key_here node create-new-years-eve-spec-draft.js
   ```

## Running the Script

After setting up authentication, run:

```bash
node create-new-years-eve-spec-draft.js
```

If you set the key in `.env`, make sure to source it first:
```bash
source .env && node create-new-years-eve-spec-draft.js
```

## What the Script Does

1. Creates a spec draft named "New Year's Eve"
2. Searches for each movie in TMDB using the title and year
3. Adds each found movie to the spec draft
4. Assigns categories to each movie based on your provided list
5. Creates custom categories (like "Musical") if they don't exist as standard categories
6. Handles movies that appear in multiple categories by assigning all relevant categories

## Categories

The script maps your categories to standard system categories:
- Action/Adventure → Action/Adventure
- Comedy → Comedy
- Comedy-drama → Drama/Romance
- Crime/caper/heist → Horror/Thriller
- Disaster → Sci-Fi/Fantasy
- Drama → Drama/Romance
- Film noir → Horror/Thriller
- Horror → Horror/Thriller
- Romance/romantic comedy → Drama/Romance
- Science fiction → Sci-Fi/Fantasy
- Thriller → Horror/Thriller
- Musical → (created as custom category)

## Notes

- The script includes a 200ms delay between movie searches to avoid rate limiting
- Movies that can't be found in TMDB will be skipped and reported in the summary
- If the spec draft already exists, the script will use the existing one and add movies to it
- Movies appearing in multiple categories will have all their categories assigned

## Troubleshooting

### Authentication Errors

If you get RLS (Row Level Security) policy errors:
1. **Make sure you're using the service role key**, not the anon key
   - Service role key starts with `eyJ...` and is much longer
   - It bypasses RLS policies for admin operations
2. **Check your environment variable is set:**
   ```bash
   echo $SUPABASE_SERVICE_KEY
   ```
   If empty, set it using one of the methods above
3. **Verify the key is correct:**
   - Go to Supabase Dashboard → Settings → API
   - Make sure you copied the `service_role` key, not `anon` key

### Other Issues

If movies aren't being found:
- Some movies might have slightly different titles in TMDB
- The script will report which movies couldn't be found
- You can manually add these movies later through the admin interface

If movies aren't being found:
- Some movies might have slightly different titles in TMDB
- The script will report which movies couldn't be found
- You can manually add these movies later through the admin interface

