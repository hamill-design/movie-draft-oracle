# academy-awards.json

The **authoritative allow-list** of Academy Award winners and nominees, keyed by TMDB id.
First and authoritative source for Oscar status in the `fetch-movies` edge function: it is
checked before `oscar_cache` and OMDb, and (after the allow-list cutover) **absence from this
list means the film has no Oscar**.

The function loads this data from a **URL** at runtime (env var `ACADEMY_AWARDS_JSON_URL`).
**Required in production:** upload this file to Supabase Storage (or another host) and set that
env var in the Edge Function secrets. `oscar_cache` is kept in sync with this file via migration
(see `*_populate_oscar_cache_allowlist.sql`).

## Format

Flat format (current):

```json
{ "movies": [ { "tmdb_id": 14, "status": "winner", "title": "American Beauty", "year": 1999 }, ... ] }
```

- `status` is `"winner"` (won ≥1 Academy Award) or `"nominee"` (nominated, no win).
- `title` / `year` are for human readability; lookups use `tmdb_id` + `status` only.

The loader also still accepts the legacy array format
`[{ "category", "year", "won": boolean, "movies": [{ "tmdb_id", "title" }] }, ...]`.

## Provenance

Built from **Wikidata** (films with `P166` award-received / `P1411` nominated-for an Academy
Award category `P31 = Q19020`, following the `P1686` "for work" qualifier so craft/acting wins
credited to individuals still mark the film), **unioned** with the app's existing `oscar_cache`
+ draft history and the 98th-ceremony seed. When sources disagree, the **strongest** status wins
(winner > nominee), matching `mergeOscarStatusFromSources`.

Known gap: films nominated/won **only** for Best Original Song (or some Sound categories) whose
Oscar Wikidata attaches to the songwriter/person, not the film — these are recovered via the
app's existing data and a targeted Wikipedia pass before the strict "absent = none" cutover.
