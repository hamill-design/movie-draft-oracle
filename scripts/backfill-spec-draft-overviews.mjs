#!/usr/bin/env node
/**
 * Backfill spec_draft_movies.movie_overview (and movie_genres when empty) from TMDB for films
 * that have no stored synopsis, so /special-draft/:slug pages show real copy instead of nothing.
 * Films that already have movie_overview or a curated seo_blurb are never touched.
 *
 * Dry run by default (prints what it would change). Pass --write to save.
 *
 * Usage (from repo root):
 *   export SUPABASE_URL=...                      (or VITE_SUPABASE_URL)
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   export TMDB_API_KEY=...                      (v3 API key, or a v4 read-access token starting with "eyJ")
 *   node scripts/backfill-spec-draft-overviews.mjs            # dry run
 *   node scripts/backfill-spec-draft-overviews.mjs --write    # save
 * Optional: SPEC_DRAFT_ID=<uuid> to scope to one spec draft
 */

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const tmdbKey = process.env.TMDB_API_KEY;
const specDraftId = process.env.SPEC_DRAFT_ID || null;
const write = process.argv.includes('--write');

if (!url || !key || !tmdbKey) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and TMDB_API_KEY');
  process.exit(1);
}

const sbHeaders = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const tmdbIsToken = tmdbKey.startsWith('eyJ');

async function tmdbMovie(id) {
  const u = new URL(`https://api.themoviedb.org/3/movie/${id}`);
  u.searchParams.set('language', 'en-US');
  if (!tmdbIsToken) u.searchParams.set('api_key', tmdbKey);
  const res = await fetch(u, tmdbIsToken ? { headers: { Authorization: `Bearer ${tmdbKey}` } } : undefined);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB ${res.status} for movie ${id}`);
  return res.json();
}

async function fetchRows() {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = `${url}/rest/v1/spec_draft_movies?select=id,movie_tmdb_id,movie_title,movie_overview,seo_blurb,movie_genres` +
      `&or=(movie_overview.is.null,movie_overview.eq.)&order=created_at.asc`;
    if (specDraftId) q += `&spec_draft_id=eq.${specDraftId}`;
    const res = await fetch(q, { headers: { ...sbHeaders, Range: `${from}-${from + pageSize - 1}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const rows = (await fetchRows()).filter((r) => !r.seo_blurb?.trim());
  console.log(`${rows.length} films without a synopsis or curated blurb. ${write ? 'WRITING' : 'DRY RUN (add --write to save)'}`);

  let updated = 0, noOverview = 0, notFound = 0;
  for (const row of rows) {
    const movie = await tmdbMovie(row.movie_tmdb_id);
    if (!movie) { notFound++; console.log(`  not on TMDB: ${row.movie_title} (${row.movie_tmdb_id})`); continue; }
    const overview = (movie.overview || '').trim();
    const patch = {};
    if (overview) patch.movie_overview = overview;
    if ((!row.movie_genres || row.movie_genres.length === 0) && movie.genres?.length) {
      patch.movie_genres = movie.genres.map((g) => g.id);
    }
    if (!overview) noOverview++;
    if (Object.keys(patch).length === 0) continue;

    console.log(`  ${row.movie_title}: ${Object.keys(patch).join(', ')}`);
    if (write) {
      const res = await fetch(`${url}/rest/v1/spec_draft_movies?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`Update failed for ${row.movie_title}: ${res.status} ${await res.text()}`);
    }
    updated++;
    await new Promise((r) => setTimeout(r, 60)); // stay well under TMDB rate limits
  }
  console.log(`Done. ${write ? 'Updated' : 'Would update'}: ${updated}. TMDB has no overview: ${noOverview}. Not on TMDB: ${notFound}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
