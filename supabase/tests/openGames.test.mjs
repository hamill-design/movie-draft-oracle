import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDb, makePlayer, actAs, setMode, rpc, rpcJson, ADMIN_EMAIL,
} from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/**
 * Quick Join / Quick Start / the homepage list. Lobbies are shared by everyone, so every test gets
 * its own database (the same way the Quick Match tests do).
 */
async function fresh({ enable = ['year'], mode = 'on' } = {}) {
  const db = await newDb({ publicPlay: true });
  await setMode(db, mode);
  // Years and actors are on by default; start from "nothing on" so each test controls exactly what Quick Play can draw.
  await db.query(`UPDATE public.quick_match_pool SET enabled = false`);
  if (enable.length) await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE kind = ANY($1)`, [enable]);

  const mk = (b = 'Player', extra = {}) => makePlayer(db, { publicName: nm(b), ...extra });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const quickStart = (who) => call(who, 'quick_start');
  const quickJoin = (who) => call(who, 'quick_join');

  /** A game a player hosts. Defaults: live (60 s), 4 seats, no schedule. */
  async function host(who, o = {}) {
    await actAs(db, who);
    const r = await rpcJson(
      db, 'create_public_table',
      o.title ?? 'Hosted game', o.theme ?? 'year', o.option ?? '1999',
      o.categories ?? ['Comedy', 'Drama/Romance'], o.size ?? 4, o.clock ?? 60,
      o.rated ?? true, o.at ?? null,
    );
    return r.draft_id;
  }
  const join = (who, id) => call(who, 'join_public_table', id);
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const seated = async (id) =>
    (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at, created_at`, [id])).rows;
  const draftCount = async () => Number((await db.query(`SELECT count(*) AS c FROM public.drafts`)).rows[0].c);
  const list = async (who, limit) => {
    await actAs(db, who);
    return limit === undefined ? rpc(db, 'list_open_games_preview') : rpc(db, 'list_open_games_preview', limit);
  };
  const asRole = async (role, fn) => {
    await db.exec(`SET ROLE ${role}`);
    try { return await fn(); } finally { await db.exec('RESET ROLE'); }
  };
  return { db, mk, call, quickStart, quickJoin, host, join, draft, seated, draftCount, list, asRole };
}

describe('Quick Start', () => {
  test('opens a new Quick Match: you are seated and you are its host, 90 s clock, bots fill after a wait', async () => {
    const { db, mk, quickStart, draft, seated } = await fresh();
    const p = await mk('Starter');
    const r = await quickStart(p);
    assert.equal(r.created, true);
    assert.equal(r.already_in, false);
    assert.equal(r.joined, 1);

    const d = await draft(r.draft_id);
    assert.equal(d.match_source, 'quick');
    assert.equal(d.lobby_visibility, 'public');
    assert.equal(d.user_id, p.id, 'whoever opens a Quick Match owns it (they are its host)');
    assert.equal(d.auto_start, true, 'it starts by itself when everyone is ready');
    assert.equal(d.fill_bots, true, 'and bots fill the empty seats');
    assert.equal(d.pick_clock_seconds, 90);
    assert.equal(d.table_size, 4);
    assert.equal(d.rated, true);
    const wait = (new Date(d.fill_deadline_at) - Date.now()) / 1000;
    assert.ok(wait > 30 && wait <= 41, `bots arrive after about 40 seconds (was ${wait}s)`);

    const people = await seated(r.draft_id);
    assert.equal(people.length, 1);
    assert.equal(people[0].user_id, p.id);
    assert.equal(people[0].is_host, true, 'the first player is the host');
    const hist = (await db.query(`SELECT * FROM public.quick_match_history WHERE user_id = $1`, [p.id])).rows;
    assert.equal(hist.length, 1, 'remembered so you are not given the same draft twice in a row');
  });

  test('always opens its OWN game, even when another Quick Match is waiting for players', async () => {
    const { mk, quickStart, seated } = await fresh();
    const a = await mk('First');
    const b = await mk('Second');
    const ra = await quickStart(a);
    const rb = await quickStart(b);
    assert.notEqual(ra.draft_id, rb.draft_id, 'two starters get two separate games');
    assert.equal((await seated(ra.draft_id)).length, 1);
    assert.equal((await seated(rb.draft_id)).length, 1);
  });

  test('if you are already in an unfinished Quick Match it takes you back instead of opening another', async () => {
    const { mk, quickStart, draftCount } = await fresh();
    const p = await mk('Twice');
    const first = await quickStart(p);
    const before = await draftCount();
    const again = await quickStart(p);
    assert.equal(again.draft_id, first.draft_id);
    assert.equal(again.already_in, true);
    assert.equal(await draftCount(), before, 'no second game was created');
  });

  test('with nothing switched on for Quick Match it still opens a lobby (from the years and actors)', async () => {
    const { db, mk, quickStart, seated } = await fresh({ enable: [] });
    const p = await mk();
    const r = await quickStart(p);
    assert.equal(r.created, true);
    assert.equal((await seated(r.draft_id)).length, 1);
    const kind = (await db.query(`SELECT q.kind FROM public.drafts d JOIN public.quick_match_pool q ON q.id = d.quick_pool_id WHERE d.id = $1`, [r.draft_id])).rows[0].kind;
    assert.ok(['year', 'actor'].includes(kind));
  });

  test('...and says so plainly, creating nothing, only if there are no years or actors at all', async () => {
    const { db, mk, quickStart, draftCount } = await fresh({ enable: [] });
    await db.query(`DELETE FROM public.quick_match_pool WHERE kind IN ('year', 'actor')`);
    await assert.rejects(quickStart(await mk()), /isn't available right now/);
    assert.equal(await draftCount(), 0);
  });

  test('refuses more than 8 starts an hour', async () => {
    const { db, mk, quickStart } = await fresh();
    const p = await mk('Eager');
    for (let i = 0; i < 8; i++) {
      await db.query(`INSERT INTO public.public_play_events (user_id, kind) VALUES ($1, 'quick_start')`, [p.id]);
    }
    await assert.rejects(quickStart(p), /started a lot of quick games/);
  });

  test('refuses someone who has left several matches in the last 10 minutes', async () => {
    const { db, mk, quickStart } = await fresh();
    const p = await mk('Leaver');
    for (let i = 0; i < 5; i++) {
      await db.query(`INSERT INTO public.public_play_events (user_id, kind) VALUES ($1, 'leave')`, [p.id]);
    }
    await assert.rejects(quickStart(p), /left several matches recently/);
  });
});

describe('Quick Join', () => {
  test('jumps into a live game a player hosts, and does not start it for them', async () => {
    const { mk, host, quickJoin, seated, draft } = await fresh();
    const h = await mk('Host');
    const id = await host(h, { title: 'Hosted: 1999' });
    const guest = await mk('Guest');
    const r = await quickJoin(guest);
    assert.equal(r.found, true);
    assert.equal(r.draft_id, id);
    assert.equal(r.match_source, 'open');
    assert.equal(r.already_in, false);
    assert.equal(r.joined, 2);
    const people = await seated(id);
    assert.deepEqual(people.map((p) => p.user_id), [h.id, guest.id]);
    assert.equal(people.find((p) => p.user_id === h.id).is_host, true, 'the host is still the host');
    assert.equal((await draft(id)).turn_order, null, 'the host still decides when to start');
  });

  test('says nothing was found, and changes nothing, when there is nothing to join', async () => {
    const { mk, quickJoin, draftCount } = await fresh();
    const p = await mk('Alone');
    assert.deepEqual(await quickJoin(p), { found: false });
    assert.equal(await draftCount(), 0, 'it never opens a game for you: that is Quick Start');
  });

  test('picks the game closest to full', async () => {
    const { mk, host, join, quickJoin } = await fresh();
    const h1 = await mk('Lonely');
    const h2 = await mk('Popular');
    const emptier = await host(h1, { title: 'Emptier' });
    const fuller = await host(h2, { title: 'Fuller' });
    await join(await mk(), fuller);
    await join(await mk(), fuller);
    const guest = await mk('Newcomer');
    const r = await quickJoin(guest);
    assert.equal(r.draft_id, fuller);
    assert.notEqual(r.draft_id, emptier);
    assert.equal(r.joined, 4);
  });

  test('also fills a Quick Match lobby, and even at four people nothing starts until the host does', async () => {
    const { db, mk, quickStart, quickJoin, draft, seated } = await fresh();
    const starter = await mk('Starter');
    const { draft_id } = await quickStart(starter);

    const b = await mk('B');
    const rb = await quickJoin(b);
    assert.equal(rb.draft_id, draft_id);
    assert.equal(rb.match_source, 'quick');
    assert.equal(rb.joined, 2);
    assert.equal((await draft(draft_id)).ready_check_expires_at, null);

    await quickJoin(await mk('C'));
    const rd = await quickJoin(await mk('D'));
    assert.equal(rd.joined, 4);
    assert.equal((await seated(draft_id)).length, 4);
    const d = await draft(draft_id);
    assert.equal(d.ready_check_expires_at, null, 'a full Quick Match waits for its host: no ready check, no countdown');
    assert.equal(d.turn_order, null, 'and has not started');
    const hist = (await db.query(`SELECT count(*) AS c FROM public.quick_match_history WHERE pool_id = (SELECT quick_pool_id FROM public.drafts WHERE id = $1)`, [draft_id])).rows[0].c;
    assert.equal(Number(hist), 4);
  });

  test('prefers whichever is fuller when a Quick Match and a hosted game are both open', async () => {
    const { mk, host, quickStart, quickJoin } = await fresh();
    // Both games start with one person, so the first joiner goes to either (a tie is random).
    // After that one game has two people, so every later joiner must go to that same game.
    const hosted = await host(await mk('Host'));
    const q = await quickStart(await mk('Q1'));
    const second = await quickJoin(await mk('Q2'));
    assert.ok([hosted, q.draft_id].includes(second.draft_id));
    assert.equal(second.joined, 2);
    const third = await quickJoin(await mk('Q3'));
    assert.equal(third.draft_id, second.draft_id, 'the fuller game wins, whoever hosts it');
    assert.equal(third.joined, 3);
  });

  test('skips slow games: "quick" means now', async () => {
    const { mk, host, quickJoin } = await fresh();
    await host(await mk('Slow host'), { clock: 3600 });
    await host(await mk('Slower host'), { clock: 43200 });
    assert.deepEqual(await quickJoin(await mk('Impatient')), { found: false });
  });

  test('a live game just over 2 minutes a pick counts as slow; exactly 2 minutes counts as live', async () => {
    const { mk, host, quickJoin } = await fresh();
    await host(await mk('H1'), { clock: 121 });
    assert.deepEqual(await quickJoin(await mk('P1')), { found: false });
    const id = await host(await mk('H2'), { clock: 120 });
    assert.equal((await quickJoin(await mk('P2'))).draft_id, id);
  });

  test('skips games scheduled more than 15 minutes away, joins ones about to begin', async () => {
    const { mk, host, quickJoin } = await fresh();
    const far = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    const soon = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await host(await mk('Later host'), { at: far });
    assert.deepEqual(await quickJoin(await mk('Early')), { found: false });
    const id = await host(await mk('Soon host'), { at: soon });
    assert.equal((await quickJoin(await mk('Early 2'))).draft_id, id);
  });

  test('skips full games, games already counting down to start, started games and cancelled games', async () => {
    const { db, mk, host, join, quickJoin, call } = await fresh();
    // full
    const full = await host(await mk('Full host'), { size: 2 });
    await join(await mk(), full);
    // counting down
    const counting = await host(await mk('Countdown host'));
    await db.query(`UPDATE public.drafts SET ready_check_expires_at = now() + interval '10 seconds' WHERE id = $1`, [counting]);
    // started
    const started = await host(await mk('Started host'));
    await db.query(`UPDATE public.drafts SET turn_order = '["a","b"]'::jsonb WHERE id = $1`, [started]);
    // cancelled
    const cancelledHost = await mk('Cancelled host');
    const cancelled = await host(cancelledHost);
    await call(cancelledHost, 'cancel_public_table', cancelled);

    assert.deepEqual(await quickJoin(await mk('Out of luck')), { found: false });
  });

  test('a countdown that has already run out no longer blocks joining', async () => {
    const { db, mk, host, quickJoin } = await fresh();
    const id = await host(await mk('Host'));
    await db.query(`UPDATE public.drafts SET ready_check_expires_at = now() - interval '5 seconds' WHERE id = $1`, [id]);
    assert.equal((await quickJoin(await mk('Guest'))).draft_id, id);
  });

  test('never picks a game you are already sitting in', async () => {
    const { mk, host, quickJoin, seated } = await fresh();
    const me = await mk('Me');
    const mine = await host(me);
    assert.deepEqual(await quickJoin(me), { found: false }, 'my own game is not "another game"');
    assert.equal((await seated(mine)).length, 1);

    const other = await host(await mk('Other host'));
    assert.equal((await quickJoin(me)).draft_id, other);
  });

  test('skips games with someone you have blocked, or who has blocked you', async () => {
    const { mk, host, quickJoin, call } = await fresh();
    const me = await mk('Careful');
    const bad = await mk('Blocked one');
    const blocker = await mk('Blocker');
    const g1 = await host(bad);
    const g2 = await host(blocker);
    await call(me, 'block_player', bad.id);
    await call(blocker, 'block_player', me.id);
    assert.deepEqual(await quickJoin(me), { found: false });
    const ok = await host(await mk('Fine host'));
    assert.equal((await quickJoin(me)).draft_id, ok);
    void g1; void g2;
  });

  test('if you are already in an unfinished Quick Match it takes you back to it', async () => {
    const { mk, host, quickStart, quickJoin, seated } = await fresh();
    const me = await mk('Settled');
    const q = await quickStart(me);
    await host(await mk('Tempting host'));
    const r = await quickJoin(me);
    assert.equal(r.found, true);
    assert.equal(r.already_in, true);
    assert.equal(r.draft_id, q.draft_id);
    assert.equal((await seated(q.draft_id)).length, 1, 'not seated twice');
  });

  test('two people quick-joining the last seat: one gets it, the other is told nothing was found', async () => {
    const { mk, host, join, quickJoin } = await fresh();
    const id = await host(await mk('Host'), { size: 3 });
    await join(await mk(), id);
    const a = await quickJoin(await mk('Fast'));
    const b = await quickJoin(await mk('Slow'));
    assert.equal(a.draft_id, id);
    assert.deepEqual(b, { found: false });
  });

  test('applies the usual rules: a name is needed, the switch must be on, bans and the leave limit apply', async () => {
    const { db, mk, host, quickJoin } = await fresh();
    await host(await mk('Host'));

    const unnamed = await makePlayer(db, {});
    await assert.rejects(quickJoin(unnamed), /display name/);

    await actAs(db, null);
    await assert.rejects(rpcJson(db, 'quick_join'), /Sign in/);

    const leaver = await mk('Leaver');
    for (let i = 0; i < 5; i++) await db.query(`INSERT INTO public.public_play_events (user_id, kind) VALUES ($1, 'leave')`, [leaver.id]);
    await assert.rejects(quickJoin(leaver), /left several games recently/);

    const banned = await mk('Banned');
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [banned.id]);
    await assert.rejects(quickJoin(banned), /suspended/);

    const player = await mk('Fine');
    await setMode(db, 'off');
    await assert.rejects(quickJoin(player), /not open yet/);
    await setMode(db, 'admin_only');
    await assert.rejects(quickJoin(player), /not open yet/);
  });

  test('a hosted game still obeys the join rules: 20 joins an hour', async () => {
    const { db, mk, host, quickJoin } = await fresh();
    await host(await mk('Host'));
    const p = await mk('Joiner');
    for (let i = 0; i < 20; i++) await db.query(`INSERT INTO public.public_play_events (user_id, kind) VALUES ($1, 'join')`, [p.id]);
    await assert.rejects(quickJoin(p), /joining tables very quickly/);
  });
});

describe('Quick Start / Quick Join and the switch', () => {
  test('Quick Start is closed while public play is off, or "just me" for anyone but the admin', async () => {
    const { db, mk, quickStart } = await fresh({ mode: 'off' });
    const p = await mk();
    await assert.rejects(quickStart(p), /not open yet/);
    await setMode(db, 'admin_only');
    await assert.rejects(quickStart(p), /not open yet/);
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Boss' });
    assert.equal((await quickStart(admin)).created, true);
  });

  test('signed-out visitors cannot call Quick Start or Quick Join at all', async () => {
    const { db } = await fresh();
    for (const fn of ['quick_start()', 'quick_join()']) {
      const r = (await db.query(`SELECT has_function_privilege('anon', 'public.${fn}', 'EXECUTE') AS can`)).rows[0];
      assert.equal(r.can, false, `${fn} must not be callable by anon`);
      const a = (await db.query(`SELECT has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE') AS can`)).rows[0];
      assert.equal(a.can, true, `${fn} must be callable by signed-in players`);
    }
    const h = (await db.query(`SELECT has_function_privilege('authenticated', 'public._quick_seat(uuid, uuid, boolean)', 'EXECUTE') AS can`)).rows[0];
    assert.equal(h.can, false, 'the seating helper is internal');
  });
});

describe('Open games list (homepage)', () => {
  test('shows hosted open games with a free seat: format, seats, clock, host name', async () => {
    const { mk, host, join, list } = await fresh();
    const h = await mk('Cinephile');
    const id = await host(h, { title: 'Draft by 1999', theme: 'year', option: '1999', size: 4, clock: 60, rated: false });
    await join(await mk(), id);

    const rows = await list(await mk('Viewer'));
    assert.equal(rows.length, 1);
    const g = rows[0];
    assert.equal(g.draft_id, id);
    assert.equal(g.title, 'Draft by 1999');
    assert.equal(g.theme, 'year');
    assert.equal(g.option, '1999');
    assert.equal(g.table_size, 4);
    assert.equal(g.joined_count, 2);
    assert.equal(g.seats_open, 2);
    assert.match(g.host_name, /^Cinephile \d+$/);
    assert.equal(g.pick_clock_seconds, 60);
    assert.equal(g.speed, 'live');
    assert.equal(g.rated, false);
    assert.equal(g.i_joined, false);
  });

  test('never exposes an email address, a user id or anything beyond the card', async () => {
    const { mk, host, list } = await fresh();
    const h = await mk('Private', { email: 'secret.person@example.test', name: 'Real Name Person' });
    await host(h);
    const rows = await list(null);
    assert.equal(rows.length, 1);
    assert.deepEqual(
      Object.keys(rows[0]).sort(),
      ['created_at', 'draft_id', 'host_name', 'i_joined', 'joined_count', 'option', 'pick_clock_seconds', 'rated',
        'scheduled_start_at', 'seats_open', 'speed', 'table_size', 'theme', 'title'],
    );
    const text = JSON.stringify(rows);
    assert.ok(!text.includes('secret.person'), 'no email');
    assert.ok(!text.includes('Real Name Person'), 'only the chosen public name');
    assert.ok(!text.includes(h.id), 'no user id');
  });

  test('does not list Quick Match lobbies, only games a player hosts', async () => {
    const { mk, quickStart, list } = await fresh();
    await quickStart(await mk('Q'));
    assert.deepEqual(await list(null), []);
  });

  test('hides full, counting-down, started, cancelled and private games', async () => {
    const { db, mk, host, join, call, list } = await fresh();
    const full = await host(await mk('Full host'), { size: 2 });
    await join(await mk(), full);
    const counting = await host(await mk('Countdown host'));
    await db.query(`UPDATE public.drafts SET ready_check_expires_at = now() + interval '10 seconds' WHERE id = $1`, [counting]);
    const started = await host(await mk('Started host'));
    await db.query(`UPDATE public.drafts SET turn_order = '["a","b"]'::jsonb WHERE id = $1`, [started]);
    const cancelHost = await mk('Cancelled host');
    const cancelled = await host(cancelHost);
    await call(cancelHost, 'cancel_public_table', cancelled);
    await db.query(`INSERT INTO public.drafts (user_id, title, theme, option, categories, participants, is_multiplayer, invite_code)
                    VALUES ($1, 'Friends only', 'year', '2001', ARRAY['Comedy'], ARRAY[]::text[], true, 'PRIVATE1')`, [(await mk()).id]);
    const open = await host(await mk('Open host'));
    const rows = await list(null);
    assert.deepEqual(rows.map((r) => r.draft_id), [open]);
  });

  test('live games come first, then the soonest to start; slow games are listed too', async () => {
    const { mk, host, list } = await fresh();
    const slow = await host(await mk('Slow'), { clock: 43200, title: 'slow' });
    const liveLater = await host(await mk('Live later'), { title: 'live later', at: new Date(Date.now() + 2 * 3600 * 1000).toISOString() });
    const liveNow = await host(await mk('Live now'), { title: 'live now' });
    const rows = await list(null);
    assert.deepEqual(rows.map((r) => r.draft_id), [liveNow, liveLater, slow]);
    assert.deepEqual(rows.map((r) => r.speed), ['live', 'live', 'slow']);
  });

  test('a signed-in viewer sees which game they are already in; blocked hosts are hidden', async () => {
    const { mk, host, join, call, list } = await fresh();
    const viewer = await mk('Viewer');
    const g1 = await host(await mk('Friendly'));
    await join(viewer, g1);
    const bad = await mk('Rude');
    await host(bad);
    await call(viewer, 'block_player', bad.id);

    const rows = await list(viewer);
    assert.deepEqual(rows.map((r) => [r.draft_id, r.i_joined]), [[g1, true]]);
    const guest = await list(null);
    assert.equal(guest.length, 2, 'a signed-out visitor has no blocks, so sees both');
    assert.ok(guest.every((r) => r.i_joined === false));
  });

  test('follows the switch and never raises: off shows nothing, "just me" shows only the admin', async () => {
    const { db, mk, host, list } = await fresh();
    await host(await mk('Host'));
    assert.equal((await list(null)).length, 1, 'on: everyone, even signed out');

    await setMode(db, 'admin_only');
    assert.deepEqual(await list(null), [], 'just me: a signed-out visitor sees nothing');
    assert.deepEqual(await list(await mk('Regular')), [], 'just me: neither does a regular player');
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Admin' });
    assert.equal((await list(admin)).length, 1, 'just me: the admin sees it');

    await setMode(db, 'off');
    assert.deepEqual(await list(admin), [], 'off: nobody, not even the admin');
  });

  test('is callable by signed-out visitors (the only new function that is) and respects the limit', async () => {
    const { db, mk, host, list, asRole } = await fresh();
    for (let i = 0; i < 5; i++) await host(await mk(`Host${i}`));
    const can = (await db.query(`SELECT has_function_privilege('anon', 'public.list_open_games_preview(integer)', 'EXECUTE') AS can`)).rows[0];
    assert.equal(can.can, true);

    await actAs(db, null);
    const rows = await asRole('anon', () => rpc(db, 'list_open_games_preview', 3));
    assert.equal(rows.length, 3, 'limit respected');
    assert.equal((await list(null, 1)).length, 1);
    assert.equal((await list(null, 0)).length, 1, 'a limit of zero still returns at least one');
    assert.equal((await list(null, 1000)).length, 5, 'and a huge limit is clamped, not an error');
  });

  test('players still cannot read hosted-game data any other way through this function', async () => {
    const { db } = await fresh();
    for (const fn of ['list_public_tables(text, text, integer)', 'get_table_info(uuid)', 'my_public_tables()']) {
      const r = (await db.query(`SELECT has_function_privilege('anon', 'public.${fn}', 'EXECUTE') AS can`)).rows[0];
      assert.equal(r.can, false, `${fn} stays closed to signed-out visitors`);
    }
  });
});
