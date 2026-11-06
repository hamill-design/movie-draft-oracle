// Runs the REAL referee-tick edge function code in Node.
//
//  - supabase-js is replaced by a fake whose database calls go to the same in-memory
//    Postgres (PGlite) the SQL tests use. Referee RPCs run as the `service_role`
//    database role, so the test also proves the function only calls things the
//    service role is allowed to call.
//  - Deno.serve / Deno.env are shimmed.
//  - The `fetch-movies` function is replaced by a fake you control per test.

import { register } from 'node:module';
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDb, makeDraft, startDraft, getDraft, getPicks, getParticipant, expireClock, humanPick, uuid,
  makePlayer, actAs, setMode, rpcJson, inHours,
} from './helpers.mjs';
import { gameKit } from './gameKit.mjs';

register('./support/loader.mjs', import.meta.url);

// ── Deno shim ──────────────────────────────────────────────
const ENV = {
  SUPABASE_URL: 'http://fake.supabase.test',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  REFEREE_SECRET: 'cron-secret',
};
let handler;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (fn) => { handler = fn; } };
await import('../functions/referee-tick/index.ts');
assert.equal(typeof handler, 'function', 'the function registered a request handler');

// ── Fake supabase-js backed by PGlite ──────────────────────
let db;
let fetchMoviesImpl;
let fetchMoviesCalls;
let enrichImpl;   // stands in for the existing enrich-movie-data function (it writes scores onto the picks)
let enrichCalls;
let validUsers; // token -> user id

const rows = (r) => r.rows;

async function asServiceRole(fn) {
  await db.exec('SET ROLE service_role');
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}

function queryBuilder(table) {
  const q = { cols: '*', filters: [], limit: null };
  const run = async () => {
    try {
      if (table === 'draft_participants') {
        const where = q.filters.map(([c, v], i) => `${c} = $${i + 1}`).join(' AND ');
        const sql = `SELECT ${q.cols} FROM public.draft_participants ${where ? 'WHERE ' + where : ''} ${q.limit ? 'LIMIT ' + q.limit : ''}`;
        return { data: rows(await db.query(sql, q.filters.map(([, v]) => v))), error: null };
      }
      return { data: [], error: null }; // spec_draft_* / actor_spec_categories: empty in these tests
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  };
  const b = {
    select(cols) { q.cols = cols; return b; },
    eq(c, v) { q.filters.push([c, v]); return b; },
    ilike(c, v) { q.filters.push([c, v]); return b; },
    order() { return b; },
    limit(n) { q.limit = n; return b; },
    then(res, rej) { return run().then(res, rej); },
  };
  return b;
}

function fakeClient({ key, options }) {
  const authHeader = options?.global?.headers?.Authorization;
  const token = authHeader?.replace('Bearer ', '');
  return {
    auth: {
      getUser: async () => {
        const id = validUsers.get(token);
        return id
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: { message: 'invalid JWT' } };
      },
    },
    from: (table) => queryBuilder(table),
    functions: {
      invoke: async (name, { body }) => {
        if (name === 'enrich-movie-data') {
          enrichCalls.push(body);
          try { return { data: await enrichImpl(body), error: null }; }
          catch (e) { return { data: null, error: { message: e.message } }; }
        }
        assert.equal(name, 'fetch-movies');
        fetchMoviesCalls.push(body);
        try { return { data: await fetchMoviesImpl(body), error: null }; }
        catch (e) { return { data: null, error: { message: e.message } }; }
      },
    },
    rpc: async (fn, args = {}) => {
      assert.equal(key, 'service-key', `${fn} must be called with the service-role client`);
      try {
        const names = Object.keys(args);
        const named = names.map((n, i) => `${n} => $${i + 1}`).join(', ');
        const values = names.map((n) => args[n]);
        const data = await asServiceRole(async () => {
          // functions that return a list of rows, not one value
          if (['referee_list_overdue_drafts', 'referee_list_unscored_drafts', 'referee_pending_scores'].includes(fn)) {
            return rows(await db.query(`SELECT * FROM public.${fn}(${named})`, values));
          }
          return (await db.query(`SELECT public.${fn}(${named}) AS r`, values)).rows[0].r;
        });
        return { data, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },
  };
}

globalThis.__fakeSupabase = {
  createClient: (url, key, options) => fakeClient({ key, options }),
};

// ── helpers ────────────────────────────────────────────────
const call = (body, headers = {}, method = 'POST') =>
  handler(new Request('http://localhost/functions/v1/referee-tick', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  }));

const asUser = (userId) => {
  const token = `tok-${userId}`;
  validUsers.set(token, userId);
  return { Authorization: `Bearer ${token}` };
};
const asScheduler = { 'x-referee-secret': 'cron-secret', Authorization: 'Bearer anon-key' };

const pool = (year = 1999) => [
  { id: 101, title: 'Great', year, genre: 'Comedy', voteAverage: 8.5, vote_count: 9000, posterPath: '/g.jpg' },
  { id: 102, title: 'Good', year, genre: 'Comedy', voteAverage: 7.0, vote_count: 3000 },
  { id: 103, title: 'Meh', year, genre: 'Comedy', voteAverage: 5.0, vote_count: 500 },
];

const TWO = [{ name: 'Ann' }, { name: 'Ben' }];

describe('referee-tick edge function', () => {
  before(async () => { db = await newDb({ publicPlay: true }); });
  beforeEach(() => {
    validUsers = new Map();
    fetchMoviesCalls = [];
    fetchMoviesImpl = async () => ({ results: pool() });
    enrichCalls = [];
    // Like the real function: score every pick of that movie.
    enrichImpl = async ({ movieId }) => {
      await db.query(`UPDATE public.draft_picks SET calculated_score = 12.5 WHERE movie_id = $1`, [movieId]);
      return { success: true };
    };
  });

  describe('request checks', () => {
    test('only POST is accepted', async () => {
      const r = await handler(new Request('http://localhost/x', { method: 'GET' }));
      assert.equal(r.status, 405);
    });
    test('bad JSON is a 400', async () => {
      assert.equal((await call('{nope')).status, 400);
    });
    test('needs a draftId or sweep', async () => {
      assert.equal((await call({})).status, 400);
    });
    test('a draftId that is not a uuid is a 400', async () => {
      assert.equal((await call({ draftId: 'not-a-uuid' }, asScheduler)).status, 400);
    });
  });

  describe('who may call it', () => {
    test('no credentials -> 401', async () => {
      const d = await makeDraft(db, { players: TWO });
      assert.equal((await call({ draftId: d.draftId })).status, 401);
    });
    test('a wrong scheduler secret does not unlock anything', async () => {
      const d = await makeDraft(db, { players: TWO });
      const r = await call({ draftId: d.draftId }, { 'x-referee-secret': 'guess' });
      assert.equal(r.status, 401);
    });
    test('an invalid sign-in token -> 401', async () => {
      const d = await makeDraft(db, { players: TWO });
      assert.equal((await call({ draftId: d.draftId }, { Authorization: 'Bearer forged' })).status, 401);
    });
    test('a signed-in user who is not in the draft -> 403', async () => {
      const d = await makeDraft(db, { players: TWO });
      const stranger = uuid();
      assert.equal((await call({ draftId: d.draftId }, asUser(stranger))).status, 403);
    });
    test('players cannot run a sweep (scheduler only)', async () => {
      const d = await makeDraft(db, { players: TWO });
      assert.equal((await call({ sweep: true }, asUser(d.players[0].userId))).status, 403);
    });
  });

  describe('resolving turns', () => {
    test('a player in the draft nudges an overdue turn: the auto-pick is made and recorded', async () => {
      const d = await makeDraft(db, { players: TWO, categories: ['Comedy', 'Drama/Romance'] });
      await startDraft(db, d);
      await expireClock(db, d.draftId);

      const res = await call({ draftId: d.draftId }, asUser(d.players[1].userId));
      assert.equal(res.status, 200);
      const { results } = await res.json();
      assert.equal(results[0].status, 'applied');
      assert.equal(results[0].source, 'auto');

      const picks = await getPicks(db, d.draftId);
      assert.equal(picks.length, 1);
      assert.equal(picks[0].pick_source, 'auto');
      assert.equal(picks[0].movie_id, 101, 'the best available movie, same as a bot would take');
      assert.equal(picks[0].player_name, d.turnOrder[0].participant_name);
      assert.ok(['Comedy', 'Drama/Romance'].includes(picks[0].category));
      assert.equal((await getDraft(db, d.draftId)).current_pick_number, 2);
      assert.equal((await getParticipant(db, d.draftId, d.turnOrder[0].participant_name)).consecutive_auto_picks, 1);
    });

    test('nudging before the clock runs out does nothing', async () => {
      const d = await makeDraft(db, { players: TWO });
      await startDraft(db, d);
      const res = await call({ draftId: d.draftId }, asUser(d.players[0].userId));
      const { results } = await res.json();
      assert.equal(results[0].status, 'skipped');
      assert.equal(results[0].reason, 'not_overdue');
      assert.equal((await getPicks(db, d.draftId)).length, 0);
      assert.equal(fetchMoviesCalls.length, 0, 'no movie lookups are wasted');
    });

    test('five players nudging at once still produce exactly one pick', async () => {
      const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }, { name: 'Cy' }, { name: 'Di' }, { name: 'Ed' }] });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      const responses = await Promise.all(d.players.map((p) => call({ draftId: d.draftId }, asUser(p.userId))));
      const all = (await Promise.all(responses.map((r) => r.json()))).map((j) => j.results[0].status);
      assert.equal(all.filter((s) => s === 'applied').length, 1, JSON.stringify(all));
      assert.equal((await getPicks(db, d.draftId)).length, 1);
    });

    test('the scheduler sweep resolves every overdue draft and leaves the rest alone', async () => {
      const a = await makeDraft(db, { players: TWO });
      const b = await makeDraft(db, { players: TWO });
      const fresh = await makeDraft(db, { players: TWO });
      const legacy = await makeDraft(db, { players: TWO, referee: false });
      for (const d of [a, b, fresh, legacy]) await startDraft(db, d);
      await expireClock(db, a.draftId);
      await expireClock(db, b.draftId);
      await db.query(`UPDATE public.drafts SET current_turn_deadline_at = clock_timestamp() - interval '1 hour' WHERE id = $1`, [legacy.draftId]);

      const res = await call({ sweep: true }, asScheduler);
      assert.equal(res.status, 200);
      const { results } = await res.json();
      const applied = results.filter((r) => r.status === 'applied').map((r) => r.draftId);
      assert.ok(applied.includes(a.draftId) && applied.includes(b.draftId));
      assert.equal((await getPicks(db, fresh.draftId)).length, 0);
      assert.equal((await getPicks(db, legacy.draftId)).length, 0, 'drafts without the referee are never touched');
    });

    test('the scheduled sweep also runs the public-table sweep (a host who never showed is replaced)', async () => {
      await setMode(db, 'on');
      const host = await makePlayer(db, { publicName: 'Sweep Host One' });
      const next = await makePlayer(db, { publicName: 'Sweep Next One' });
      await actAs(db, host);
      const { draft_id } = await rpcJson(db, 'create_public_table', 'Sweep table', 'year', '1999', ['Comedy'], 4, 3600, true, inHours(2));
      await actAs(db, next);
      await rpcJson(db, 'join_public_table', draft_id);
      await db.query(
        `UPDATE public.drafts SET scheduled_start_at = now() - interval '25 hours', host_since = now() - interval '26 hours' WHERE id = $1`,
        [draft_id]
      );

      const res = await call({ sweep: true }, asScheduler);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.tables.handoffs >= 1, JSON.stringify(body.tables));
      assert.equal((await getDraft(db, draft_id)).user_id, next.id);
    });

    test('the scheduled sweep also runs the Quick Match sweep (a ready check that ran out gets finished)', async () => {
      await setMode(db, 'on');
      await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE theme = 'year' AND option = '1999'`);
      const a = await makePlayer(db, { publicName: 'Quick Sweep A' });
      const b = await makePlayer(db, { publicName: 'Quick Sweep B' });
      await actAs(db, a);
      const { draft_id } = await rpcJson(db, 'quick_start');
      await actAs(db, b);
      await rpcJson(db, 'quick_join');
      // The host presses Start; the other player's page isn't open, so they are asked to confirm.
      await actAs(db, a);
      const started = await rpcJson(db, 'start_public_table', draft_id, true);
      assert.equal(started.status, 'ready_check');
      await db.query(`UPDATE public.drafts SET ready_check_expires_at = now() - interval '1 second' WHERE id = $1`, [draft_id]);

      const res = await call({ sweep: true }, asScheduler);
      const body = await res.json();
      assert.equal(body.quick.started, 1, JSON.stringify(body.quick));
      assert.ok((await getDraft(db, draft_id)).turn_order.length > 0, 'the draft began without the player who never answered');
    });

    test('the scheduled sweep scores a finished rated game: fetches missing scores, then finalizes results', async () => {
      await setMode(db, 'on');
      const kit = gameKit(db);
      const [a, b] = [await makePlayer(db, { publicName: 'Score Sweep A' }), await makePlayer(db, { publicName: 'Score Sweep B' })];
      const g = await kit.playGame([a, b], { score: false }); // finished, rated, no scores yet
      assert.equal((await getDraft(db, g.id)).results_status, 'pending');

      const res = await call({ sweep: true }, asScheduler);
      const body = await res.json();
      assert.equal(body.scoring.finalized >= 1, true, JSON.stringify(body.scoring));
      assert.equal(enrichCalls.length, 4, 'one lookup per distinct movie (2 players x 2 picks)');
      assert.equal((await getDraft(db, g.id)).results_status, 'final');
      assert.equal((await kit.results(g.id)).length, 2);

      // Nothing left to do: a second sweep does not look anything up again.
      enrichCalls.length = 0;
      await call({ sweep: true }, asScheduler);
      assert.equal(enrichCalls.length, 0);
    });

    test('if scores cannot be fetched the game keeps waiting instead of being ranked wrongly', async () => {
      await setMode(db, 'on');
      const kit = gameKit(db);
      const [a, b] = [await makePlayer(db, { publicName: 'Score Fail A' }), await makePlayer(db, { publicName: 'Score Fail B' })];
      const g = await kit.playGame([a, b], { score: false });
      enrichImpl = async () => { throw new Error('movie data service is down'); };
      const body = await (await call({ sweep: true }, asScheduler)).json();
      assert.ok(body.scoring.enrichErrors >= 4);
      assert.equal((await getDraft(db, g.id)).results_status, 'pending');
      assert.equal((await kit.results(g.id)).length, 0);
    });

    test('players cannot trigger the public-table sweep (scheduler only)', async () => {
      const p = await makePlayer(db, { publicName: 'Not A Scheduler' });
      const res = await call({ sweep: true }, asUser(p.id));
      assert.equal(res.status, 403);
    });

    test('a bot\'s turn is played by the server: labelled "bot", no strike', async () => {
      const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Robo', ai: true }], categories: ['Comedy'] });
      await startDraft(db, d);
      if (d.turnOrder[0].participant_name === 'Ann') await humanPick(db, d, 'Ann', 'Comedy', { id: 900, title: 'Ann pick', year: 1999, genre: 'Comedy', poster: null });
      await expireClock(db, d.draftId);

      const res = await call({ sweep: true }, asScheduler);
      const { results } = await res.json();
      const mine = results.find((r) => r.draftId === d.draftId);
      assert.equal(mine.status, 'applied');
      assert.equal(mine.source, 'bot');
      assert.equal(mine.isComplete, true);
      const robo = (await getPicks(db, d.draftId)).find((p) => p.player_name === 'Robo');
      assert.equal(robo.pick_source, 'bot');
      assert.equal((await getParticipant(db, d.draftId, 'Robo')).auto_pick_count, 0);
    });

    test('a year draft asks fetch-movies for that year and never picks a re-release from another year', async () => {
      const d = await makeDraft(db, { players: TWO, categories: ['Comedy'] });
      await db.query(`UPDATE public.drafts SET theme = 'year', option = '1999' WHERE id = $1`, [d.draftId]);
      fetchMoviesImpl = async () => ({ results: [{ id: 555, title: 'Re-release', year: 2019, genre: 'Comedy', voteAverage: 9.9, vote_count: 99999 }, ...pool(1999)] });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      await call({ draftId: d.draftId }, asUser(d.players[0].userId));
      assert.equal(fetchMoviesCalls[0].category, 'year');
      assert.equal(fetchMoviesCalls[0].searchQuery, '1999');
      assert.equal((await getPicks(db, d.draftId))[0].movie_id, 101);
    });

    test('completing the last pick marks the draft complete', async () => {
      const d = await makeDraft(db, { players: TWO, categories: ['Comedy'] });
      await startDraft(db, d);
      await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy', { id: 800, title: 'First', year: 1999, genre: 'Comedy', poster: null });
      await expireClock(db, d.draftId);
      const { results } = await (await call({ draftId: d.draftId }, asUser(d.players[0].userId))).json();
      assert.equal(results[0].isComplete, true);
      assert.equal((await getDraft(db, d.draftId)).is_complete, true);
    });
  });

  describe('when things go wrong', () => {
    test('no movies available: nothing is picked, and the turn stays claimed so we don\'t hammer the movie API', async () => {
      const d = await makeDraft(db, { players: TWO });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      fetchMoviesImpl = async () => ({ results: [] });
      const first = await (await call({ draftId: d.draftId }, asUser(d.players[0].userId))).json();
      assert.equal(first.results[0].status, 'no_movie');
      assert.equal((await getPicks(db, d.draftId)).length, 0);
      const second = await (await call({ draftId: d.draftId }, asUser(d.players[0].userId))).json();
      assert.equal(second.results[0].reason, 'claim_in_progress');
    });

    test('movie service down: reported as an error, draft untouched, no crash', async () => {
      const d = await makeDraft(db, { players: TWO });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      fetchMoviesImpl = async () => { throw new Error('TMDB is down'); };
      const res = await call({ draftId: d.draftId }, asUser(d.players[0].userId));
      assert.equal(res.status, 200);
      const { results } = await res.json();
      assert.equal(results[0].status, 'error');
      assert.equal(results[0].reason, 'movie_data_unavailable');
      assert.equal((await getDraft(db, d.draftId)).current_pick_number, 1);
    });

    test('if the chosen movie is taken in the meantime, it chooses again', async () => {
      const d = await makeDraft(db, { players: TWO, categories: ['Comedy', 'Drama/Romance'] });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      // While the picker is "looking up movies", someone else ends up holding the best one.
      let injected = false;
      fetchMoviesImpl = async () => {
        if (!injected) {
          injected = true;
          await db.query(
            `INSERT INTO public.draft_picks (draft_id, player_id, player_name, movie_id, movie_title, category, pick_order, pick_source)
             VALUES ($1, 9, 'Someone', 101, 'Great', 'Comedy', 1, 'player')`, [d.draftId]);
        }
        return { results: pool() };
      };
      const { results } = await (await call({ draftId: d.draftId }, asUser(d.players[0].userId))).json();
      assert.equal(results[0].status, 'applied');
      const mine = (await getPicks(db, d.draftId)).find((p) => p.pick_source === 'auto');
      assert.equal(mine.movie_id, 102, 'second-best, because 101 was taken');
      assert.equal(fetchMoviesCalls.length, 1, 'the retry reused the movie list instead of asking the movie API again');
    });
  });
});
