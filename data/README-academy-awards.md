# academy-awards.json

First source for Oscar status in the `fetch-movies` edge function. The function loads this data from a **URL** at runtime (env var `ACADEMY_AWARDS_JSON_URL`). **Required for correct Academy Award category counts:** set this env var in production (e.g. Supabase Edge Function secrets). Upload this file to Supabase Storage (or another host) and set that URL.

This JSON is the **first and authoritative** source for Oscar status: it is checked before `oscar_cache` and OMDb; if a movie is in the map, that status is used even when the cache has `'none'`.

**Schema (array format):** `[{ "category", "year", "movies": [{ "tmdb_id", "title", "imdb_id" }], "won": boolean }, ...]`.  
**Legacy format:** `{ "movies": [{ "tmdb_id": number, "status": "winner" | "nominee" }, ...] }`.
