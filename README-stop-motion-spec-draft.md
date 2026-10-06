# Stop Motion Movies Spec Draft

Creates a spec draft called **"Stop Motion Movies"** (slug `stop-motion-movies`) with 227 stop-motion
features pulled from Wikipedia's "List of stop-motion films" (1917–2025).

## What it does

1. Creates the spec draft (or reuses it if the slug already exists).
2. Creates one custom category per animation technique: **Clay, Cutout, Mixed, Puppet, Puppet & Pixilation**.
3. Searches TMDB (via the `fetch-movies` edge function) for each title/year and adds the match to the draft.
4. Tags each movie with its technique category, an `Animated` tag (every title here qualifies), any
   genre-derived category TMDB's data supports (Action/Adventure, Comedy, Drama/Romance, Sci-Fi/Fantasy,
   Horror/Thriller), and a decade category (`30's`...`2020's`) when the year falls in a bucket the app
   already supports. Movies before 1930 (e.g. *El Apóstol*, 1917) only get the technique + Animated tags.
5. Populates `movie_genres` from TMDB's genre string (converted to TMDB genre IDs) — this is what feeds
   the genre-based categories above.
6. Leaves Oscar, blockbuster, and sequel categories alone — those come from `oscar_status`/`revenue`/
   `is_sequel` already stored per movie, but this script doesn't re-derive the categories from them, so
   double check those in the admin UI.

Not included: the two unreleased titles from the list (*Wildwood*, *Shaun the Sheep: The Beast of Mossy
Bottom* — both 2026) since they won't resolve in TMDB search yet. Add them manually once they're out.

## Running it

Same auth setup as the other spec-draft scripts in this repo — see `README-new-years-eve-spec-draft.md`
for the full walkthrough, or the short version:

```bash
./setup-auth.sh
```

then:

```bash
node create-stop-motion-spec-draft.js
```

You need `SUPABASE_SERVICE_KEY` (the Supabase service role key) set in your environment or `.env` — the
anon key can't write past RLS. The script logs each search result and prints a summary at the end,
including any titles TMDB couldn't match so you can add them by hand.

## After running

Open the admin spec draft manager and review:
- Any "not found" titles from the summary.
- TMDB mismatches — several of these are obscure/foreign titles where the first search result may not be
  the right one (the script logs `using first result for ...` when it couldn't find an exact title+year
  match).
- Genre/Oscar/Blockbuster/Sequel categories, which this script doesn't set.
