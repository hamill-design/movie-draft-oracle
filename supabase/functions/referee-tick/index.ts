// referee-tick: the server-side "referee" for drafts that have it switched on.
//
// When a turn's clock has run out (or it is a bot's turn), this function:
//   1. claims the overdue turn   (database function referee_claim_turn)
//   2. chooses a movie           (_shared/refereePick.ts, same logic as the bots)
//   3. records the pick          (database function referee_apply_pick)
//
// It is safe to call as often and from as many places as you like: the database
// makes sure each turn is resolved exactly once, and does nothing if the turn
// isn't overdue.
//
// Who may call it:
//   - A signed-in player who is in the draft:  { "draftId": "<uuid>" }
//   - The scheduled sweep (cron), using the shared secret header
//     `x-referee-secret` (env REFEREE_SECRET):  { "sweep": true }  or  { "draftId": ... }
//
// Setup steps are in docs/referee-setup.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { selectAutoPick } from '../_shared/refereePick.ts';
import type { PoolMovie, PoolSource, SpecDraftMovieRow } from '../_shared/refereePick.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-referee-secret',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SWEEP_DRAFTS = 10;
const MAX_PICK_ATTEMPTS = 3;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Compare secrets without leaking how many leading characters matched. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// deno-lint-ignore no-explicit-any
type AdminClient = any;

/** Reads the data the picker needs, using the service-role client. Mirrors what the browser bots read. */
function makePoolSource(admin: AdminClient): PoolSource {
  return {
    async specDraftMovies(specDraftId: string): Promise<SpecDraftMovieRow[]> {
      const { data, error } = await admin
        .from('spec_draft_movies')
        .select('id, movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres, is_sequel')
        .eq('spec_draft_id', specDraftId)
        .order('movie_title', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },

    async specDraftMovieIdsForCategory(categoryName: string): Promise<string[]> {
      const { data, error } = await admin
        .from('spec_draft_movie_categories')
        .select('spec_draft_movie_id')
        .eq('category_name', categoryName);
      if (error || !data) return []; // the browser ignores this error too: no narrowing
      return data.map((r: { spec_draft_movie_id: string }) => r.spec_draft_movie_id);
    },

    async specDraftMoviesWithCategories(specDraftId: string) {
      const { data, error } = await admin
        .from('spec_draft_movies')
        .select('movie_tmdb_id, spec_draft_movie_categories(category_name)')
        .eq('spec_draft_id', specDraftId);
      if (error || !data) return [];
      return data.map(
        (row: { movie_tmdb_id: number; spec_draft_movie_categories: { category_name: string }[] | null }) => ({
          movie_tmdb_id: row.movie_tmdb_id,
          categories: (row.spec_draft_movie_categories ?? []).map((c) => c.category_name),
        }),
      );
    },

    async actorSpecCategories(actorName: string) {
      let { data, error } = await admin
        .from('actor_spec_categories')
        .select('category_name, movie_tmdb_ids')
        .eq('actor_name', actorName);
      if (error || !data || data.length === 0) {
        ({ data, error } = await admin
          .from('actor_spec_categories')
          .select('category_name, movie_tmdb_ids')
          .ilike('actor_name', actorName));
      }
      return !error && data ? data : [];
    },

    async fetchMovies(body: Record<string, unknown>) {
      const { data, error } = await admin.functions.invoke('fetch-movies', { body });
      if (error) throw error;
      return data as { results?: PoolMovie[]; movies?: PoolMovie[] } | null;
    },
  };
}

/** Remembers answers for the duration of one turn, so a retry never repeats a movie-API lookup. */
function memoized(source: PoolSource): PoolSource {
  const cache = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) cache.set(key, load());
    return cache.get(key) as Promise<T>;
  };
  return {
    specDraftMovies: (id) => once(`sdm:${id}`, () => source.specDraftMovies(id)),
    specDraftMovieIdsForCategory: (c) => once(`sdc:${c}`, () => source.specDraftMovieIdsForCategory(c)),
    specDraftMoviesWithCategories: (id) => once(`sdmc:${id}`, () => source.specDraftMoviesWithCategories(id)),
    actorSpecCategories: (n) => once(`asc:${n}`, () => source.actorSpecCategories(n)),
    fetchMovies: (b) => once(`fm:${JSON.stringify(b)}`, () => source.fetchMovies(b)),
  };
}

const MAX_ENRICH_PER_SWEEP = 20;
const ENRICH_CONCURRENCY = 4;

interface ScoringSummary {
  drafts: number;
  enriched: number;
  enrichErrors: number;
  finalized: number;
  voided: number;
  waiting: number;
}

/**
 * Ranked games: when a rated public draft finishes, its picks need scores (the same scores the Final
 * Scores page shows, written by the existing `enrich-movie-data` function). This fetches any that are
 * missing, then asks the database to finalize the results. A few drafts and movies per run, so it never
 * runs long; the next scheduled run carries on.
 */
async function scoreFinishedDrafts(admin: AdminClient): Promise<ScoringSummary> {
  const out: ScoringSummary = { drafts: 0, enriched: 0, enrichErrors: 0, finalized: 0, voided: 0, waiting: 0 };
  const list = await admin.rpc('referee_list_unscored_drafts', { p_limit: 5 });
  if (list.error) {
    console.error('referee-tick: scoring list failed', list.error);
    return out;
  }

  let budget = MAX_ENRICH_PER_SWEEP;
  for (const row of (list.data ?? []) as { draft_id: string }[]) {
    out.drafts += 1;
    const pending = await admin.rpc('referee_pending_scores', { p_draft: row.draft_id });
    const movies = ((pending.data ?? []) as { movie_id: number; movie_title: string; movie_year: number | null }[]).slice(0, Math.max(budget, 0));
    budget -= movies.length;

    for (let i = 0; i < movies.length; i += ENRICH_CONCURRENCY) {
      const settled = await Promise.allSettled(
        movies.slice(i, i + ENRICH_CONCURRENCY).map((m) =>
          admin.functions.invoke('enrich-movie-data', {
            body: { movieId: m.movie_id, movieTitle: m.movie_title, movieYear: m.movie_year },
          })
        ),
      );
      for (const s of settled) {
        if (s.status === 'fulfilled' && !s.value.error) out.enriched += 1;
        else out.enrichErrors += 1;
      }
    }

    const fin = await admin.rpc('finalize_draft_results', { p_draft: row.draft_id });
    if (fin.error) {
      console.error('referee-tick: finalize failed', row.draft_id, fin.error);
      continue;
    }
    const status = fin.data?.status;
    if (status === 'final') out.finalized += 1;
    else if (status === 'void') out.voided += 1;
    else if (status === 'waiting') out.waiting += 1;
    if (budget <= 0) break;
  }
  return out;
}

interface DraftResult {
  draftId: string;
  status: 'applied' | 'skipped' | 'no_movie' | 'error';
  reason?: string;
  source?: string;
  isComplete?: boolean;
}

async function resolveDraft(admin: AdminClient, draftId: string): Promise<DraftResult> {
  const claimRes = await admin.rpc('referee_claim_turn', { p_draft_id: draftId });
  if (claimRes.error) {
    console.error('referee-tick: claim failed', draftId, claimRes.error);
    return { draftId, status: 'error', reason: claimRes.error.message };
  }
  const claim = claimRes.data;
  if (!claim?.claimed) {
    return { draftId, status: 'skipped', reason: claim?.reason ?? 'not_claimed' };
  }

  const source = memoized(makePoolSource(admin));
  const excluded: number[] = [];

  for (let attempt = 1; attempt <= MAX_PICK_ATTEMPTS; attempt++) {
    let choice;
    try {
      choice = await selectAutoPick(source, {
        theme: claim.draft.theme ?? '',
        option: claim.draft.option ?? '',
        categories: claim.draft.categories ?? [],
        openCategories: claim.open_categories ?? [],
        pickedMovieIds: [...(claim.picked_movie_ids ?? []), ...excluded],
      });
    } catch (err) {
      // Movie data unavailable right now. The claim expires on its own and a later tick retries.
      console.error('referee-tick: could not load movies', draftId, err);
      return { draftId, status: 'error', reason: 'movie_data_unavailable' };
    }

    if (!choice) {
      console.warn('referee-tick: no movie available', draftId);
      return { draftId, status: 'no_movie' };
    }

    const { movie, category } = choice;
    const applyRes = await admin.rpc('referee_apply_pick', {
      p_draft_id: draftId,
      p_expected_pick_number: claim.pick_number,
      p_movie_id: movie.id,
      p_movie_title: movie.title,
      p_movie_year: movie.year,
      p_movie_genre: movie.genre,
      p_category: category,
      p_poster_path: movie.posterPath,
    });
    if (applyRes.error) {
      console.error('referee-tick: apply failed', draftId, applyRes.error);
      return { draftId, status: 'error', reason: applyRes.error.message };
    }

    const applied = applyRes.data;
    if (applied?.applied) {
      console.log(`referee-tick: ${applied.source} pick #${applied.pick_number} in ${draftId}: ${movie.title} (${category})`);
      return { draftId, status: 'applied', source: applied.source, isComplete: applied.is_complete === true };
    }
    if (applied?.reason === 'duplicate_movie') {
      excluded.push(movie.id); // someone has it already: choose again
      continue;
    }
    // e.g. the player picked just in time ('turn_already_resolved'): nothing more to do.
    return { draftId, status: 'skipped', reason: applied?.reason ?? 'not_applied' };
  }

  return { draftId, status: 'no_movie', reason: 'duplicate_movie_retries_exhausted' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const refereeSecret = Deno.env.get('REFEREE_SECRET');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server is not configured' }, 500);
  }

  let body: { draftId?: unknown; sweep?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const draftId = typeof body.draftId === 'string' ? body.draftId : null;
  const wantsSweep = body.sweep === true;
  if (draftId !== null && !UUID_RE.test(draftId)) return json({ error: 'Invalid draftId' }, 400);
  if (draftId === null && !wantsSweep) return json({ error: 'Send { "draftId": "..." } or { "sweep": true }' }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Who is calling?
  const providedSecret = req.headers.get('x-referee-secret') ?? '';
  const isScheduler = !!refereeSecret && providedSecret.length > 0 && safeEqual(providedSecret, refereeSecret);

  if (!isScheduler) {
    if (wantsSweep) return json({ error: 'Sweeps are for the scheduler only' }, 403);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Sign in required' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Sign in required' }, 401);

    const { data: membership, error: memberError } = await admin
      .from('draft_participants')
      .select('id')
      .eq('draft_id', draftId)
      .eq('user_id', userData.user.id)
      .limit(1);
    if (memberError) return json({ error: 'Could not check membership' }, 500);
    if (!membership || membership.length === 0) return json({ error: 'Not a player in this draft' }, 403);
  }

  // The scheduled sweep also looks after public tables: reminders, "time to start" nudges,
  // finishing expired ready checks, and hosts who didn't show (hand over the role, or cancel).
  let tables: unknown = null;
  let quick: unknown = null;
  let scoring: unknown = null;
  if (wantsSweep) {
    const swept = await admin.rpc('referee_sweep_tables');
    if (swept.error) console.error('referee-tick: table sweep failed', swept.error);
    else tables = swept.data;

    // Quick Match: fill timers (bots join), ready checks that ran out, and abandoned lobbies.
    const sweptQuick = await admin.rpc('referee_sweep_quick_match');
    if (sweptQuick.error) console.error('referee-tick: quick match sweep failed', sweptQuick.error);
    else quick = sweptQuick.data;

    // Finished rated games: fetch missing scores, then finalize results and points.
    try {
      scoring = await scoreFinishedDrafts(admin);
    } catch (err) {
      console.error('referee-tick: scoring failed', err);
    }
  }

  let draftIds: string[];
  if (wantsSweep) {
    const { data, error } = await admin.rpc('referee_list_overdue_drafts', { p_limit: MAX_SWEEP_DRAFTS });
    if (error) {
      console.error('referee-tick: sweep list failed', error);
      return json({ error: 'Sweep failed' }, 500);
    }
    draftIds = (data ?? []).map((r: { draft_id: string }) => r.draft_id);
  } else {
    draftIds = [draftId as string];
  }

  const settled = await Promise.allSettled(draftIds.map((id) => resolveDraft(admin, id)));
  const results: DraftResult[] = settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : { draftId: draftIds[i], status: 'error' as const, reason: String(s.reason) }
  );

  return json({ results, tables, quick, scoring });
});
