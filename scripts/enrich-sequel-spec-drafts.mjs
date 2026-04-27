#!/usr/bin/env node
/**
 * Backfill spec_draft_movies.is_sequel + sequel_enriched_at + Sequel category rows
 * by calling the enrich-spec-draft-sequels Edge Function until no rows remain with
 * sequel_enriched_at IS NULL.
 *
 * Usage (from repo root, with env set):
 *   export SUPABASE_URL=...   (or VITE_SUPABASE_URL from .env)
 *   export SUPABASE_SERVICE_ROLE_KEY=...   (or VITE_SUPABASE_SERVICE_ROLE_KEY)
 *   node scripts/enrich-sequel-spec-drafts.mjs
 * Optional: SPEC_DRAFT_ID=<uuid> to scope to one spec draft
 */

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const specDraftId = process.env.SPEC_DRAFT_ID || null;
const limit = Math.min(100, Math.max(1, parseInt(process.env.BATCH_LIMIT || '40', 10) || 40));

if (!url || !key) {
  console.error(
    'Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)'
  );
  process.exit(1);
}

const endpoint = `${url.replace(/\/$/, '')}/functions/v1/enrich-spec-draft-sequels`;

async function runBatch() {
  const body = { limit };
  if (specDraftId) body.spec_draft_id = specDraftId;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  let total = 0;
  for (;;) {
    const out = await runBatch();
    const n = (out.processed ?? out.results?.length) ?? 0;
    total += n;
    console.log('Batch result:', { processed: n, totalSoFar: total });
    if (n === 0) break;
  }
  console.log('Done. Total processed this run:', total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
