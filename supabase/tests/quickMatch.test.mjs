import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDb, makePlayer, actAs, setMode, rpc, rpcJson, ADMIN_EMAIL, uuid, expireClock, refereeResolve,
} from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/** Quick Match lobbies are shared by everyone, so every test gets its own database. */
async function fresh({ enable = ['year'] } = {}) {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  // Years and actors are on by default now. Unless a test asks for the defaults (enable: null), start from
  // "nothing switched on" and turn on just what the test needs, so each test keeps its meaning.
  if (enable !== null) {
    await db.query(`UPDATE public.quick_match_pool SET enabled = false`);
    if (enable.length) await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE kind = ANY($1)`, [enable]);
  }
  const mk = (b = 'Quick', extra = {}) => makePlayer(db, { publicName: nm(b), ...extra });
  /** What the Quick Play button does: jump into an open lobby, otherwise open one. */
  const join = async (who) => {
    await actAs(db, who);
    const j = await rpcJson(db, 'quick_join');
    if (j.found) return { ...j, created: false };
    return rpcJson(db, 'quick_start');
  };
  /** Their lobby page is open right now (that is what "here" means). */
  const here = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const people = async (id) => (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at, created_at`, [id])).rows;
  const notes = async (uid, type) => (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND type = $2`, [uid, type])).rows;
  const sweep = () => rpcJson(db, 'referee_sweep_quick_match');
  const backdate = (id, sql) => db.query(`UPDATE public.drafts SET ${sql} WHERE id = $1`, [id]);
  const status = async (id, who) => { await actAs(db, who); return (await rpcJson(db, 'get_table_info', id)).status; };
  /** n players join, returns { players, id } (all in the same lobby). */
  async function lobbyOf(count) {
    const players = [];
    let id;
    for (let i = 0; i < count; i++) {
      const p = await mk();
      players.push(p);
      id = (await join(p)).draft_id;
    }
    return { players, id };
  }
  return { db, mk, join, call, draft, people, notes, sweep, backdate, status, lobbyOf, here };
}

describe('Quick Match: the pool', () => {
  test('seeds the 50 most recent FULL years and 50 suggested actors, all switched ON by default', async () => {
    const { db } = await fresh({ enable: null });
    const rows = (await db.query(`SELECT kind, option, enabled FROM public.quick_match_pool`)).rows;
    const years = rows.filter((r) => r.kind === 'year').map((r) => Number(r.option)).sort();
    const thisYear = new Date().getFullYear();
    assert.equal(years.length, 50);
    assert.equal(years[0], thisYear - 50);
    assert.equal(years[49], thisYear - 1, 'the year in progress is not included');
    assert.equal(rows.filter((r) => r.kind === 'actor').length, 50);
    assert.ok(rows.filter((r) => r.kind === 'year' || r.kind === 'actor').every((r) => r.enabled === true), 'years and actors need nobody\'s approval');
  });

  test('special drafts found later still start switched off (they are curated)', async () => {
    const { db } = await fresh({ enable: null });
    await db.query(`INSERT INTO public.spec_drafts (name) VALUES ('Brand New Theme')`);
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Spec' });
    await actAs(db, admin);
    await rpcJson(db, 'admin_sync_quick_pool');
    const spec = (await rpc(db, 'admin_list_quick_pool')).find((r) => r.label === 'Brand New Theme');
    assert.equal(spec.enabled, false);
  });

  test('even with everything switched off, Quick Match is available and still finds a lobby (from the years and actors)', async () => {
    const { db, mk } = await fresh({ enable: [] });
    const p = await mk();
    await actAs(db, p);
    assert.equal(await rpcJson(db, 'quick_match_available'), true);
    const r = await rpcJson(db, 'quick_start');
    assert.equal(r.created, true);
    const d = (await db.query(`SELECT d.theme, q.kind, q.enabled FROM public.drafts d JOIN public.quick_match_pool q ON q.id = d.quick_pool_id WHERE d.id = $1`, [r.draft_id])).rows[0];
    assert.ok(['year', 'actor'].includes(d.kind), 'never a special draft unless approved');
    assert.equal(d.enabled, false, 'the fallback ignores the off switches only because everything was off');
  });

  test('a single entry switched back on is the only one used again (the off switches still work)', async () => {
    const { db, mk } = await fresh({ enable: [] });
    await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE theme = 'year' AND option = '1999'`);
    const p = await mk();
    await actAs(db, p);
    assert.equal(await rpcJson(db, 'quick_match_available'), true);
    const r = await rpcJson(db, 'quick_start');
    const d = (await db.query(`SELECT option FROM public.drafts WHERE id = $1`, [r.draft_id])).rows[0];
    assert.equal(d.option, '1999');
  });

  test('only when there are no years or actors at all is Quick Match unavailable (and it says so)', async () => {
    const { db, mk } = await fresh({ enable: [] });
    await db.query(`DELETE FROM public.quick_match_pool WHERE kind IN ('year', 'actor')`);
    const p = await mk();
    await actAs(db, p);
    assert.equal(await rpcJson(db, 'quick_match_available'), false);
    await assert.rejects(rpcJson(db, 'quick_start'), /isn't available right now/);
  });

  test('the admin can review, approve, add and remove entries; nobody else can', async () => {
    const { db, mk } = await fresh({ enable: [] });
    const player = await mk();
    await actAs(db, player);
    await assert.rejects(rpc(db, 'admin_list_quick_pool'), /Admins only/);
    await assert.rejects(rpcJson(db, 'admin_sync_quick_pool'), /Admins only/);

    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Boss' });
    await actAs(db, admin);
    const all = await rpc(db, 'admin_list_quick_pool');
    assert.equal(all.length, 100);
    const [first] = all;
    await db.query(`SELECT public.admin_set_quick_pool_enabled($1, true)`, [first.id]);
    assert.equal((await rpc(db, 'admin_list_quick_pool')).filter((r) => r.enabled).length, 1);

    assert.equal(await rpcJson(db, 'admin_set_quick_pool_kind_enabled', 'year', true), 50);
    assert.equal(await rpcJson(db, 'admin_set_quick_pool_kind_enabled', 'year', false), 50);

    const id = await rpcJson(db, 'admin_add_quick_pool_actor', 'Sidney Poitier');
    const added = (await rpc(db, 'admin_list_quick_pool')).find((r) => r.id === id);
    assert.equal(added.label, 'Sidney Poitier filmography');
    assert.equal(added.enabled, false);
    await assert.rejects(rpcJson(db, 'admin_add_quick_pool_actor', 'x'), /full name/);

    await db.query(`SELECT public.admin_remove_quick_pool_entry($1)`, [id]);
    assert.ok(!(await rpc(db, 'admin_list_quick_pool')).some((r) => r.id === id));
  });

  test('syncing picks up new special drafts, once, and leaves them switched off', async () => {
    const { db } = await fresh({ enable: [] });
    await db.query(`INSERT INTO public.spec_drafts (name) VALUES ('Stop Motion'), ('Secret Draft')`);
    await db.query(`UPDATE public.spec_drafts SET is_hidden = true WHERE name = 'Secret Draft'`);
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Sync' });
    await actAs(db, admin);
    assert.equal(await rpcJson(db, 'admin_sync_quick_pool'), 1, 'only the visible one is added');
    assert.equal(await rpcJson(db, 'admin_sync_quick_pool'), 0, 'a second sync adds nothing');
    const spec = (await rpc(db, 'admin_list_quick_pool')).filter((r) => r.kind === 'spec');
    assert.equal(spec.length, 1);
    assert.equal(spec[0].label, 'Stop Motion');
    assert.equal(spec[0].enabled, false);
  });

  test('players cannot read or change the pool directly', async () => {
    const { db, mk } = await fresh();
    const p = await mk();
    await actAs(db, p);
    await db.exec('SET ROLE authenticated');
    try {
      await assert.rejects(db.query(`SELECT * FROM public.quick_match_pool`), /permission denied/);
      await assert.rejects(db.query(`UPDATE public.quick_match_pool SET enabled = true`), /permission denied/);
    } finally {
      await db.exec('RESET ROLE');
    }
  });
});

describe('Quick Match: finding a match', () => {
  test('the first player opens a lobby: 4 seats, 90 seconds, rated, hosted by them, from the pool', async () => {
    const { db, mk, join, draft, people } = await fresh();
    const p = await mk();
    const r = await join(p);
    assert.equal(r.created, true);
    const d = await draft(r.draft_id);
    assert.equal(d.match_source, 'quick');
    assert.equal(d.lobby_visibility, 'public');
    assert.equal(d.table_size, 4);
    assert.equal(d.pick_clock_seconds, 90);
    assert.equal(d.rated, true);
    assert.equal(d.referee_enabled, true);
    assert.equal(d.user_id, p.id, 'whoever opens the lobby owns it');
    assert.equal(d.theme, 'year');
    assert.ok(d.quick_pool_id);
    assert.equal(d.categories.length, 5);
    const ps = await people(r.draft_id);
    assert.equal(ps.length, 1);
    assert.ok(ps[0].is_host, 'the first player is the host');
    assert.ok(ps[0].participant_name.startsWith('Quick'), 'seated under the public name');
    void db;
  });

  test('the next player lands in the SAME lobby, and is not the host', async () => {
    const { mk, join, people } = await fresh();
    const a = await mk();
    const first = await join(a);
    const b = await mk();
    const second = await join(b);
    assert.equal(second.draft_id, first.draft_id);
    assert.equal(second.created, false);
    const hosts = (await people(first.draft_id)).filter((p) => p.is_host);
    assert.deepEqual(hosts.map((h) => h.user_id), [a.id]);
  });

  test('searching again while already in a match just takes you back to it', async () => {
    const { mk, join, people } = await fresh();
    const a = await mk();
    const first = await join(a);
    const again = await join(a);
    assert.equal(again.already_in, true);
    assert.equal(again.draft_id, first.draft_id);
    assert.equal((await people(first.draft_id)).length, 1);
  });

  test('a full lobby waits for its host (no ready check, no countdown), and the 5th player opens a new lobby', async () => {
    const { mk, join, draft, notes, lobbyOf } = await fresh();
    const { players, id } = await lobbyOf(4);
    const d = await draft(id);
    assert.equal(d.ready_check_expires_at, null, 'nothing starts when the 4th player sits down');
    assert.equal(d.turn_order, null);
    for (const p of players) assert.equal((await notes(p.id, 'match_found')).length, 0);

    const fifth = await mk();
    const r = await join(fifth);
    assert.equal(r.created, true);
    assert.notEqual(r.draft_id, id);
  });

  test('two people who blocked each other are never put in the same lobby', async () => {
    const { db, mk, join } = await fresh();
    const a = await mk();
    const b = await mk();
    await actAs(db, b);
    await db.query(`SELECT public.block_player($1)`, [a.id]);
    const first = await join(a);
    const second = await join(b);
    assert.notEqual(second.draft_id, first.draft_id);
    assert.equal(second.created, true);
  });

  test('nobody is given the same entry twice in a row', async () => {
    const { db, mk, join, call, draft } = await fresh({ enable: [] });
    await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE theme = 'year' AND option IN ('1999', '2001')`);
    const p = await mk();
    const first = await join(p);
    const entryOne = (await draft(first.draft_id)).quick_pool_id;
    await call(p, 'quick_match_leave', first.draft_id);
    const second = await join(p);
    const entryTwo = (await draft(second.draft_id)).quick_pool_id;
    assert.notEqual(entryTwo, entryOne);
  });

  test('if only ONE entry is approved, a repeat is better than no match', async () => {
    const { db, mk, join, call, draft } = await fresh({ enable: [] });
    await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE theme = 'year' AND option = '1999'`);
    const p = await mk();
    const first = await join(p);
    await call(p, 'quick_match_leave', first.draft_id);
    const second = await join(p);
    assert.equal((await draft(second.draft_id)).option, '1999');
  });

  test('matches are a fair mix of years, actors and special drafts', async () => {
    const { db, mk, join, draft } = await fresh({ enable: [] });
    await db.query(`INSERT INTO public.spec_drafts (name) VALUES ('Stop Motion')`);
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Mix' });
    await actAs(db, admin);
    await rpcJson(db, 'admin_sync_quick_pool');
    await db.query(`UPDATE public.quick_match_pool SET enabled = true`);

    const seen = { year: 0, people: 0, 'spec-draft': 0 };
    for (let i = 0; i < 45; i++) {
      const p = await mk();
      const r = await join(p); // a brand-new player always opens a fresh lobby when none has room
      const d = await draft(r.draft_id);
      seen[d.theme] += 1;
      await actAs(db, p);
      await rpcJson(db, 'quick_match_leave', r.draft_id); // close it so the next player opens another
    }
    assert.ok(seen.year > 0 && seen.people > 0 && seen['spec-draft'] > 0, JSON.stringify(seen));
    // years have 50 entries and actors 50 but spec only 1: by TYPE they should still be roughly equal thirds
    assert.ok(seen['spec-draft'] >= 5, `the lone special draft is not drowned out by 100 others: ${JSON.stringify(seen)}`);
  });

  test('leaving: the lobby survives while others are in it, and closes when the last human goes', async () => {
    const { mk, join, call, status, lobbyOf } = await fresh();
    const { players, id } = await lobbyOf(2);
    const res = await call(players[0], 'quick_match_leave', id);
    assert.equal(res.match_cancelled, false);
    assert.equal(await status(id, players[1]), 'forming');
    const res2 = await call(players[1], 'quick_match_leave', id);
    assert.equal(res2.match_cancelled, true);
    assert.equal(await status(id, players[1]), 'cancelled');
    const fresh1 = await mk();
    assert.equal((await join(fresh1)).created, true, 'a closed lobby is never matched into');
  });

  test('hopping in and out too fast is slowed down', async () => {
    const { mk, join, call } = await fresh();
    const p = await mk();
    for (let i = 0; i < 5; i++) {
      const r = await join(p);
      await call(p, 'quick_match_leave', r.draft_id);
    }
    await assert.rejects(join(p), /left several (matches|games)/);
  });

  test('the usual doors apply: switch, name, bans', async () => {
    const { db, mk, join } = await fresh();
    const named = await mk();
    const nameless = await makePlayer(db);
    await assert.rejects(join(nameless), /Choose a display name/);
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [named.id]);
    await assert.rejects(join(named), /suspended/);
    await setMode(db, 'admin_only');
    const other = await mk();
    await assert.rejects(join(other), /not open yet/);
  });
});

describe('Quick Match: the host starts, bots and the ready check', () => {
  test('when everyone is in the lobby, the host\'s Start begins at once: 20 picks, rated, 90-second clock', async () => {
    const { call, draft, status, lobbyOf, here } = await fresh();
    const { players, id } = await lobbyOf(4);
    for (const p of players) await here(id, p);
    const r = await call(players[0], 'start_public_table', id, true);
    assert.equal(r.status, 'started', 'being in the lobby is being ready: no check');
    assert.equal(r.rated, true);
    assert.equal(r.bots_added, 0);
    const d = await draft(id);
    assert.equal(d.turn_order.length, 20, '4 players x 5 categories');
    assert.ok((new Date(d.current_turn_deadline_at) - Date.now()) / 1000 > 80);
    assert.equal(await status(id, players[0]), 'active');
  });

  test('someone whose page is closed gets a 15-second check; if they never answer, the rest play and a bot takes the seat', async () => {
    const { call, draft, people, notes, sweep, backdate, lobbyOf, here } = await fresh();
    const { players, id } = await lobbyOf(4);
    for (const p of players.slice(0, 3)) await here(id, p);
    const r = await call(players[0], 'start_public_table', id, true);
    assert.equal(r.status, 'ready_check');
    assert.equal((await notes(players[3].id, 'match_found')).length, 1, 'only the absent player is asked');
    assert.equal((await notes(players[1].id, 'match_found')).length, 0, 'people who are here are not');
    await backdate(id, `ready_check_expires_at = now() - interval '1 second'`);
    const out = await sweep();
    assert.equal(out.started, 1);
    const ps = await people(id);
    assert.equal(ps.filter((p) => !p.is_ai).length, 3);
    assert.equal(ps.filter((p) => p.is_ai).length, 1, 'a bot fills the seat they left');
    assert.equal((await notes(players[3].id, 'removed_from_table')).length, 1);
    assert.equal((await draft(id)).rated, true, '3 real players: still rated');
  });

  test('the absent player can still confirm in time: then everyone plays', async () => {
    const { call, people, lobbyOf, here } = await fresh();
    const { players, id } = await lobbyOf(2);
    await here(id, players[0]);
    await call(players[0], 'start_public_table', id, true);
    const done = await call(players[1], 'confirm_ready', id);
    assert.equal(done.result.status, 'started');
    assert.equal(done.result.bots_added, 2);
    assert.equal(done.result.rated, true);
    assert.equal((await people(id)).length, 4);
  });

  test('nothing starts by itself, however long the lobby waits: no countdown, no bots arriving, no ready check', async () => {
    const { draft, sweep, backdate, lobbyOf, here, db } = await fresh();
    const { players, id } = await lobbyOf(2);
    for (const p of players) await here(id, p);
    await backdate(id, `created_at = now() - interval '2 minutes'`);
    await db.query(`UPDATE public.drafts SET fill_deadline_at = now() - interval '1 minute' WHERE id = $1`, [id]);
    const out = await sweep();
    assert.equal(out.started, 0);
    assert.equal(out.ready_checks, 0);
    const d = await draft(id);
    assert.equal(d.ready_check_expires_at, null);
    assert.equal(d.turn_order, null);
  });

  test('a host on their own starts against bots: they take the other three seats, and the game is unrated', async () => {
    const { call, draft, people, lobbyOf } = await fresh();
    const { players, id } = await lobbyOf(1);
    const res = await call(players[0], 'start_public_table', id, true);
    assert.equal(res.status, 'started');
    assert.equal(res.bots_added, 3);
    assert.equal(res.rated, false);
    assert.equal((await draft(id)).rated, false);
    assert.equal((await people(id)).filter((p) => p.is_ai).length, 3);
  });

  test('the old "practise against bots" button is gone', async () => {
    const { call, lobbyOf } = await fresh();
    const { players, id } = await lobbyOf(1);
    await assert.rejects(call(players[0], 'quick_match_practice', id), /does not exist|not exist/);
  });

  test('if a ready check leaves only one real player, the game is unrated and bots fill the table', async () => {
    const { call, draft, people, sweep, backdate, lobbyOf, here } = await fresh();
    const { players, id } = await lobbyOf(2);
    await here(id, players[0]);
    await call(players[0], 'start_public_table', id, true); // the other player is away and never answers
    await backdate(id, `ready_check_expires_at = now() - interval '1 second'`);
    const out = await sweep();
    assert.equal(out.started, 1);
    assert.equal((await draft(id)).rated, false, 'one real player cannot make a rated game');
    const ps = await people(id);
    assert.equal(ps.length, 4);
    assert.equal(ps.filter((p) => !p.is_ai).length, 1);
  });

  test('a lobby everyone has abandoned (not seen for 3+ minutes) is closed, and they are told', async () => {
    const { db, notes, draft, sweep, backdate, lobbyOf } = await fresh();
    const gone = await lobbyOf(1);
    await backdate(gone.id, `created_at = now() - interval '10 minutes'`);
    await db.query(`UPDATE public.draft_participants SET joined_at = now() - interval '10 minutes', last_seen_at = now() - interval '4 minutes' WHERE draft_id = $1`, [gone.id]);

    const out = await sweep();
    assert.ok(out.cancelled >= 1);
    assert.equal((await draft(gone.id)).cancel_reason, 'everyone_left');
    assert.equal((await notes(gone.players[0].id, 'table_cancelled')).length, 1);
  });

  test('a young lobby is never closed, and neither is one with a recent heartbeat', async () => {
    const { db, draft, sweep, backdate, lobbyOf } = await fresh();
    const young = await lobbyOf(1);
    await sweep();
    assert.equal((await draft(young.id)).cancelled_at, null, 'a lobby under 3 minutes old stays open');

    await backdate(young.id, `created_at = now() - interval '10 minutes'`);
    await db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '30 seconds' WHERE draft_id = $1`, [young.id]);
    await sweep();
    assert.equal((await draft(young.id)).cancelled_at, null, 'someone is still here');
  });
});

describe('Quick Match: how it shows up', () => {
  test('the lobby info says it is Quick Match, who the host is, and lists names only', async () => {
    const { db, lobbyOf } = await fresh();
    const { players, id } = await lobbyOf(2);
    await actAs(db, players[0]);
    const info = await rpcJson(db, 'get_table_info', id);
    assert.equal(info.is_quick, true);
    assert.equal(info.i_am_host, true);
    assert.equal(info.participants.length, 2);
    assert.ok(!JSON.stringify(info).includes('@'));
    assert.equal('fill_deadline_at' in info, false, 'there is no countdown to show any more');
  });

  test('Quick Match lobbies are not listed as open tables, and host-only buttons do nothing for other players', async () => {
    const { db, call, lobbyOf } = await fresh();
    const { players, id } = await lobbyOf(2);
    await actAs(db, players[0]);
    assert.ok(!(await rpc(db, 'list_public_tables')).some((t) => t.draft_id === id));
    await assert.rejects(call(players[1], 'start_public_table', id, true), /Only the host/);
    await assert.rejects(call(players[1], 'cancel_public_table', id), /Only the host/);
    await assert.rejects(call(players[1], 'set_table_settings', id, 2), /Only the host/);
  });

  test('only the server can run the sweep or start a draft directly, and signed-out guests cannot change a lobby', async () => {
    const { db, mk } = await fresh();
    const p = await mk();
    await actAs(db, p);
    try {
      await db.exec('SET ROLE authenticated');
      await assert.rejects(db.query(`SELECT public.referee_sweep_quick_match()`), /permission denied/);
      await assert.rejects(db.query(`SELECT public._do_start($1, true, false)`, [uuid()]), /permission denied/);
      await db.exec('RESET ROLE');
      await actAs(db, null);
      await db.exec('SET ROLE anon');
      await assert.rejects(db.query(`SELECT public.set_table_settings($1, 2)`, [uuid()]), /permission denied/);
    } finally {
      await db.exec('RESET ROLE');
    }
  });
});

describe('Quick Match: the whole journey', () => {
  test('search, wait, the host starts, bots join, draft, and the referee plays it to the end', async () => {
    const { db, call, draft, status, lobbyOf, here } = await fresh();
    const { players, id } = await lobbyOf(2);
    await here(id, players[0]);
    await call(players[0], 'start_public_table', id, true);   // the other player's page is closed: a check begins
    const started = await call(players[1], 'confirm_ready', id);
    assert.equal(started.result.status, 'started');

    // Everyone walks away: the referee plays all 20 picks (humans auto-pick, bots are bots).
    let guard = 0;
    while (!(await draft(id)).is_complete && guard++ < 40) {
      await expireClock(db, id);
      const { applied } = await refereeResolve(db, { draftId: id });
      assert.equal(applied.applied, true, `pick ${guard}`);
    }
    assert.equal(await status(id, players[0]), 'complete');
    const sources = (await db.query(`SELECT pick_source, count(*)::int AS n FROM public.draft_picks WHERE draft_id = $1 GROUP BY 1`, [id])).rows
      .reduce((m, r) => ({ ...m, [r.pick_source]: r.n }), {});
    assert.equal(sources.bot, 10, '2 bots x 5 picks');
    assert.equal(sources.auto, 10, '2 absent humans x 5 picks');
  });
});
