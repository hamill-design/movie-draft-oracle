import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, uuid } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/**
 * One simple lobby for every public draft. The host starts it (nothing ever starts by itself), empty seats fill
 * with bots, being in the lobby counts as ready, and until it starts the host can change the seats, the pick
 * clock, rated or casual, and the categories.
 */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const mk = (b = 'Player') => makePlayer(db, { publicName: nm(b) });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const info = (who, id) => call(who, 'get_table_info', id);
  const people = async (id) => (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at NULLS LAST, created_at`, [id])).rows;
  const humans = async (id) => (await people(id)).filter((p) => p.user_id && !p.is_ai);
  const bots = async (id) => (await people(id)).filter((p) => p.is_ai);
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const started = async (id) => { const d = await draft(id); return Array.isArray(d.turn_order) && d.turn_order.length > 0; };
  const notes = async (uid, type) => (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND type = $2`, [uid, type])).rows;
  const here = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  const away = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '5 minutes' WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  const sweepQuick = () => rpcJson(db, 'referee_sweep_quick_match');
  const sweepTables = () => rpcJson(db, 'referee_sweep_tables');

  async function quickPlay(who) {
    const j = await call(who, 'quick_join');
    const id = j.found ? j.draft_id : (await call(who, 'quick_start')).draft_id;
    await here(id, who);
    return id;
  }
  async function lobbyOf(count) {
    const players = [];
    let id;
    for (let i = 0; i < count; i++) { const p = await mk(); players.push(p); id = await quickPlay(p); }
    return { players, id };
  }
  /** A game a player hosts, with `count - 1` others seated, everybody's page open. */
  async function openTable(count, { size = 4, clock = 60, rated = true, categories = ['Comedy', 'Drama/Romance'], theme = 'year', option = '1999' } = {}) {
    const host = await mk('Host');
    await actAs(db, host);
    const r = await rpcJson(db, 'create_public_table', 'Open game', theme, option, categories, size, clock, rated, null);
    await here(r.draft_id, host);
    const players = [host];
    for (let i = 1; i < count; i++) {
      const p = await mk();
      await call(p, 'join_public_table', r.draft_id);
      await here(r.draft_id, p);
      players.push(p);
    }
    return { players, id: r.draft_id };
  }
  return { db, mk, call, info, people, humans, bots, draft, started, notes, here, away, sweepQuick, sweepTables, quickPlay, lobbyOf, openTable };
}

describe('nothing starts by itself', () => {
  test('a full Quick Play lobby of people who are all here waits for its host, through the minute sweep too', async () => {
    const { lobbyOf, sweepQuick, started, draft, db } = await fresh();
    const { id } = await lobbyOf(4);
    await db.query(`UPDATE public.drafts SET created_at = now() - interval '10 minutes' WHERE id = $1`, [id]);
    for (let i = 0; i < 3; i++) {
      const r = await sweepQuick();
      assert.equal(r.started, 0);
    }
    assert.equal(await started(id), false);
    assert.equal((await draft(id)).ready_check_expires_at, null);
  });

  test('a full open game waits for its host too', async () => {
    const { openTable, sweepTables, started, db, draft } = await fresh();
    const { id } = await openTable(4, { size: 4 });
    await db.query(`UPDATE public.drafts SET auto_start = true WHERE id = $1`, [id]);   // even a leftover old setting does nothing
    const r = await sweepTables();
    assert.equal(r.started, 0);
    assert.equal(await started(id), false);
    assert.equal((await draft(id)).ready_check_expires_at, null);
  });

  test('the old ready-up, switch and countdown functions are gone', async () => {
    const { db, openTable, call } = await fresh();
    const { players: [host], id } = await openTable(2);
    await assert.rejects(() => call(host, 'set_lobby_ready', id, true), /does not exist/);
    await assert.rejects(() => call(host, 'set_lobby_options', id, true, true), /does not exist/);
    await assert.rejects(() => db.query(`SELECT public._begin_ready_check($1, true)`, [id]), /does not exist/);
  });

  test('the lobby data no longer carries start-by-itself, bot-switch or countdown fields', async () => {
    const { openTable, info } = await fresh();
    const { players: [host], id } = await openTable(2);
    const i = await info(host, id);
    for (const k of ['auto_start', 'fill_bots', 'fill_deadline_at', 'waiting_for_invited']) assert.equal(k in i, false, k);
    for (const k of ['table_size', 'pick_clock_seconds', 'rated', 'categories', 'i_am_host']) assert.equal(k in i, true, k);
  });
});

describe('the host starts: bots, and who counts as ready', () => {
  test('empty seats always fill with bots', async () => {
    const { openTable, call, started, bots, humans } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 5, clock: 3600 });
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'started');
    assert.equal(r.bots_added, 3);
    assert.equal(await started(id), true);
    assert.equal((await bots(id)).length, 3);
    assert.equal((await humans(id)).length, 2);
  });

  test('whatever the old flag says, the seats fill', async () => {
    const { openTable, call, bots } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4 });
    await call(host, 'start_public_table', id, false);
    assert.equal((await bots(id)).length, 2);
  });

  test('everyone is in the lobby: a live draft starts at once, with no ready check and no notifications', async () => {
    const { openTable, call, started, notes, draft } = await fresh();
    const { players: [host, a, b], id } = await openTable(3, { size: 3, clock: 60 });
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'started');
    assert.equal(await started(id), true);
    assert.equal((await draft(id)).ready_check_expires_at, null);
    for (const p of [a, b]) assert.equal((await notes(p.id, 'match_found')).length, 0);
  });

  test('someone who has wandered off is the only one asked; the people in the lobby are not', async () => {
    const { openTable, call, away, started, notes, draft, people } = await fresh();
    const { players: [host, a, b], id } = await openTable(3, { size: 3, clock: 60 });
    await away(id, b);
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'ready_check');
    assert.equal(await started(id), false);
    assert.equal((await notes(b.id, 'match_found')).length, 1);
    assert.equal((await notes(a.id, 'match_found')).length, 0);
    assert.ok((await draft(id)).ready_check_expires_at);
    const ready = (await people(id)).filter((p) => p.ready_at).map((p) => p.user_id).sort();
    assert.deepEqual(ready, [host.id, a.id].sort(), 'the ones who are here count as ready');

    const done = await call(b, 'confirm_ready', id);
    assert.equal(done.result.status, 'started');
  });

  test('a slow draft never asks anyone, even someone who is away', async () => {
    const { openTable, call, away, started, notes } = await fresh();
    const { players: [host, a], id } = await openTable(2, { size: 2, clock: 3600 });
    await away(id, a);
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'started');
    assert.equal(await started(id), true);
    assert.equal((await notes(a.id, 'match_found')).length, 0);
  });

  test('an expired check finishes the draft without the person who never answered; a bot takes their seat', async () => {
    const { openTable, call, away, db, sweepTables, humans, bots, started, notes } = await fresh();
    const { players: [host, a, b], id } = await openTable(3, { size: 4, clock: 60 });
    await away(id, b);
    await call(host, 'start_public_table', id, true);
    await db.query(`UPDATE public.drafts SET ready_check_expires_at = now() - interval '1 second' WHERE id = $1`, [id]);
    const r = await sweepTables();
    assert.equal(r.started, 1);
    assert.equal(await started(id), true);
    assert.equal((await humans(id)).length, 2);
    assert.equal((await bots(id)).length, 2, 'the seat they left and the one nobody took');
    assert.equal((await notes(b.id, 'removed_from_table')).length, 1);
    void a;
  });
});

describe('the host changes the draft before it starts', () => {
  test('seats, clock, rated and categories: each change is saved and shows in the lobby data', async () => {
    const { openTable, call, info, draft } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4, clock: 60, rated: true });
    const r = await call(host, 'set_table_settings', id, 5, 120, false, ['Comedy', 'Horror/Thriller', 'Animated']);
    assert.deepEqual(r, { table_size: 5, pick_clock_seconds: 120, rated: false, categories: ['Comedy', 'Horror/Thriller', 'Animated'] });
    const i = await info(host, id);
    assert.equal(i.table_size, 5);
    assert.equal(i.pick_clock_seconds, 120);
    assert.equal(i.rated, false);
    assert.deepEqual(i.categories, ['Comedy', 'Horror/Thriller', 'Animated']);
    assert.equal((await draft(id)).rated, false);
  });

  test('leaving a setting out keeps it as it was', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4, clock: 60, rated: true, categories: ['Comedy', 'Drama/Romance'] });
    const r = await call(host, 'set_table_settings', id, null, 90, null, null);
    assert.deepEqual(r, { table_size: 4, pick_clock_seconds: 90, rated: true, categories: ['Comedy', 'Drama/Romance'] });
    const r2 = await call(host, 'set_table_settings', id, null, null, false, null);
    assert.equal(r2.rated, false);
    assert.equal(r2.pick_clock_seconds, 90);
  });

  test('works the same on a Quick Play lobby', async () => {
    const { lobbyOf, call, info } = await fresh();
    const { players: [host], id } = await lobbyOf(2);
    const r = await call(host, 'set_table_settings', id, 3, 3600, false, null);
    assert.equal(r.table_size, 3);
    const i = await info(host, id);
    assert.equal(i.pick_clock_seconds, 3600);
    assert.equal(i.speed, 'slow', 'a longer clock makes it a slow draft');
    assert.equal(i.rated, false);
  });

  test('changing the clock changes live to slow and back', async () => {
    const { openTable, call, info } = await fresh();
    const { players: [host], id } = await openTable(1, { clock: 60 });
    assert.equal((await info(host, id)).speed, 'live');
    await call(host, 'set_table_settings', id, null, 14400, null, null);
    assert.equal((await info(host, id)).speed, 'slow');
    await call(host, 'set_table_settings', id, null, 30, null, null);
    assert.equal((await info(host, id)).speed, 'live');
  });

  test('new categories decide how many picks the draft has', async () => {
    const { openTable, call, draft } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 2, clock: 3600, categories: ['Comedy', 'Drama/Romance'] });
    await call(host, 'set_table_settings', id, null, null, null, ['Comedy', 'Horror/Thriller', 'Animated', 'Wild Card']);
    await call(host, 'start_public_table', id, true);
    assert.equal((await draft(id)).turn_order.length, 8, '2 players x 4 categories');
  });

  test('seats: 2 to 6, never fewer than the people (and held seats) already at the table', async () => {
    const { openTable, call, people } = await fresh();
    const { players: [host], id } = await openTable(3, { size: 4 });
    await assert.rejects(() => call(host, 'set_table_settings', id, 1), /between 2 and 6/);
    await assert.rejects(() => call(host, 'set_table_settings', id, 7), /between 2 and 6/);
    await assert.rejects(() => call(host, 'set_table_settings', id, 2), /can.t go below the 3/);
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    await assert.rejects(() => call(host, 'set_table_settings', id, 3), /can.t go below the 4/, 'a held seat counts');
    await call(host, 'set_table_settings', id, 6);
    assert.equal((await people(id)).length, 4);
  });

  test('fewer seats fill the table up for strangers; more seats let more people in', async () => {
    const { openTable, call, mk } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4 });
    await call(host, 'set_table_settings', id, 2);
    const stranger = await mk();
    await assert.rejects(() => call(stranger, 'join_public_table', id), /full/);
    await call(host, 'set_table_settings', id, 3);
    await call(stranger, 'join_public_table', id);
  });

  test('the pick clock is 30 seconds to 24 hours', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1);
    await assert.rejects(() => call(host, 'set_table_settings', id, null, 10), /between 30 seconds and 24 hours/);
    await assert.rejects(() => call(host, 'set_table_settings', id, null, 90000), /between 30 seconds and 24 hours/);
    await call(host, 'set_table_settings', id, null, 86400);
  });

  test('categories come from the standard list: no made-up names, no repeats, between 1 and 20', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1);
    await assert.rejects(() => call(host, 'set_table_settings', id, null, null, null, ['Comedy', 'Something Rude']), /isn.t available/);
    await assert.rejects(() => call(host, 'set_table_settings', id, null, null, null, ['Comedy', ' Comedy ']), /only be used once/);
    await assert.rejects(() => call(host, 'set_table_settings', id, null, null, null, []), /between 1 and 20/);
    const r = await call(host, 'set_table_settings', id, null, null, null, ['  Comedy  ', "80's", 'Blockbuster (minimum of $50 Mil)']);
    assert.deepEqual(r.categories, ['Comedy', "80's", 'Blockbuster (minimum of $50 Mil)'], 'spaces are trimmed');
  });

  test('every category the app offers is accepted (the list here must match src/config/categoryConfigs.ts)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/config/categoryConfigs.ts', import.meta.url), 'utf8');
    const start = src.indexOf('export const CATEGORY_CONFIGS');
    const end = src.indexOf('\n};', start);
    const names = [...src.slice(start, end).matchAll(/^  (?:'([^']+)'|"([^"]+)"|(\w+)): \{$/gm)].map((m) => m[1] ?? m[2] ?? m[3]);
    assert.ok(names.length >= 20, `found ${names.length} categories in the app's list`);
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1);
    for (const name of names) {
      const r = await call(host, 'set_table_settings', id, null, null, null, [name]);
      assert.deepEqual(r.categories, [name]);
    }
  });

  test('a special draft keeps its own categories', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1, { theme: 'spec-draft', option: 'Some Special', categories: ['Best Villain', 'Best Sidekick'] });
    await assert.rejects(() => call(host, 'set_table_settings', id, null, null, null, ['Comedy']), /keeps its own categories/);
    const r = await call(host, 'set_table_settings', id, 3, 120, false, null);
    assert.equal(r.table_size, 3, 'everything else can still change');
    assert.deepEqual(r.categories, ['Best Villain', 'Best Sidekick']);
  });

  test('only the host; not other players, strangers or signed-out visitors', async () => {
    const { openTable, call, mk, db } = await fresh();
    const { players: [host, other], id } = await openTable(2);
    await assert.rejects(() => call(other, 'set_table_settings', id, 3), /Only the host/);
    const stranger = await mk();
    await assert.rejects(() => call(stranger, 'set_table_settings', id, 3), /Only the host/);
    await actAs(db, null);
    await assert.rejects(() => rpcJson(db, 'set_table_settings', id, 3), /Sign in first/);
    void host;
  });

  test('not once the draft has started, and not while a ready check is running', async () => {
    const { openTable, call, away } = await fresh();
    const live = await openTable(2, { size: 2, clock: 60 });
    await away(live.id, live.players[1]);
    await call(live.players[0], 'start_public_table', live.id, true);   // a check begins
    await assert.rejects(() => call(live.players[0], 'set_table_settings', live.id, 3), /about to start/);

    const slow = await openTable(2, { size: 2, clock: 3600 });
    await call(slow.players[0], 'start_public_table', slow.id, true);
    await assert.rejects(() => call(slow.players[0], 'set_table_settings', slow.id, 3), /already started/);
  });

  test('changes are slowed down after a lot of them in an hour', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1);
    for (let i = 0; i < 60; i++) await call(host, 'set_table_settings', id, null, 60 + (i % 2), null, null);
    await assert.rejects(() => call(host, 'set_table_settings', id, null, 90, null, null), /changed the settings a lot/);
  });

  test('a private draft is not a table: the function does not touch it', async () => {
    const { db, mk, call } = await fresh();
    const owner = await mk('Owner');
    const id = uuid();
    await db.query(`INSERT INTO public.drafts (id, user_id, title) VALUES ($1, $2, 'Friends draft')`, [id, owner.id]);
    await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, is_host, joined_at) VALUES ($1, $2, 'Host', 'joined', true, now())`, [id, owner.id]);
    await assert.rejects(() => call(owner, 'set_table_settings', id, 3), /Table not found/);
  });

  test('rated still only counts with 2+ real players, whatever the host chose', async () => {
    const { openTable, call, draft } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 3, clock: 3600, rated: false });
    await call(host, 'set_table_settings', id, null, null, true, null);
    assert.equal((await draft(id)).rated, true);
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.rated, false, 'one person plus bots is never rated');
  });
});

describe('private drafts: the owner changes the categories', () => {
  /** A private draft the owner has not started. */
  async function privateDraft(db, owner, { theme = 'year', categories = ['Comedy', 'Drama/Romance'] } = {}) {
    const id = uuid();
    await db.query(`INSERT INTO public.drafts (id, user_id, title, theme, option, categories) VALUES ($1, $2, 'Friends draft', $3, '1999', $4)`, [id, owner.id, theme, categories]);
    await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, is_host, joined_at) VALUES ($1, $2, 'Host', 'joined', true, now())`, [id, owner.id]);
    return id;
  }

  test('the owner picks from the standard list, and it is saved', async () => {
    const { db, mk, call } = await fresh();
    const owner = await mk('Owner');
    const id = await privateDraft(db, owner);
    const r = await call(owner, 'set_draft_categories', id, owner.id, ['  Comedy ', 'Sci-Fi/Fantasy', 'Wild Card']);
    assert.deepEqual(r.categories, ['Comedy', 'Sci-Fi/Fantasy', 'Wild Card']);
    assert.deepEqual((await db.query(`SELECT categories FROM public.drafts WHERE id = $1`, [id])).rows[0].categories, ['Comedy', 'Sci-Fi/Fantasy', 'Wild Card']);
  });

  test('the same rules as a public table: no made-up names, no repeats, between 1 and 20', async () => {
    const { db, mk, call } = await fresh();
    const owner = await mk('Owner');
    const id = await privateDraft(db, owner);
    await assert.rejects(() => call(owner, 'set_draft_categories', id, owner.id, ['Comedy', 'Something Rude']), /isn.t available/);
    await assert.rejects(() => call(owner, 'set_draft_categories', id, owner.id, ['Comedy', 'Comedy']), /only be used once/);
    await assert.rejects(() => call(owner, 'set_draft_categories', id, owner.id, []), /between 1 and 20/);
  });

  test('a category the draft was made with stays allowed, even a custom one; a new custom one does not', async () => {
    const { db, mk, call } = await fresh();
    const owner = await mk('Owner');
    const id = await privateDraft(db, owner, { theme: 'people', categories: ['Comedy', 'Best Villain'] });
    const r = await call(owner, 'set_draft_categories', id, owner.id, ['Best Villain', 'Drama/Romance']);
    assert.deepEqual(r.categories, ['Best Villain', 'Drama/Romance']);
    await assert.rejects(() => call(owner, 'set_draft_categories', id, owner.id, ['Best Villain', 'Best Hero']), /isn.t available/);
    // ...and once it has been taken out it is gone for good
    await call(owner, 'set_draft_categories', id, owner.id, ['Comedy']);
    await assert.rejects(() => call(owner, 'set_draft_categories', id, owner.id, ['Best Villain']), /isn.t available/);
  });

  test('only the owner; not a friend in the draft, a stranger or a signed-out visitor', async () => {
    const { db, mk, call } = await fresh();
    const owner = await mk('Owner');
    const friend = await mk('Friend');
    const id = await privateDraft(db, owner);
    await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, joined_at) VALUES ($1, $2, 'Friend', 'joined', now())`, [id, friend.id]);
    await assert.rejects(() => call(friend, 'set_draft_categories', id, friend.id, ['Comedy']), /Only the draft owner/);
    const stranger = await mk('Stranger');
    await assert.rejects(() => call(stranger, 'set_draft_categories', id, uuid(), ['Comedy']), /Only the draft owner/);
    await actAs(db, null);
    await assert.rejects(() => rpcJson(db, 'set_draft_categories', id, uuid(), ['Comedy']), /Only the draft owner/);
  });

  test('a guest who owns a draft can change it with their guest id', async () => {
    const { db, call, mk } = await fresh();
    const owner = await mk('Someone');
    const guestId = uuid();
    const id = uuid();
    await db.query(`INSERT INTO public.drafts (id, user_id, guest_session_id, title, theme, option, categories) VALUES ($1, NULL, $2, 'Guest draft', 'year', '1999', ARRAY['Comedy'])`, [id, guestId]);
    await actAs(db, null);
    const r = await rpcJson(db, 'set_draft_categories', id, guestId, ['Comedy', 'Horror/Thriller']);
    assert.deepEqual(r.categories, ['Comedy', 'Horror/Thriller']);
    await assert.rejects(() => rpcJson(db, 'set_draft_categories', id, uuid(), ['Comedy']), /Only the draft owner/);
    void call; void owner;
  });

  test('not once it has started, not for a special draft, and not for a public table', async () => {
    const { db, mk, call, openTable } = await fresh();
    const owner = await mk('Owner');
    const started = await privateDraft(db, owner);
    await db.query(`UPDATE public.drafts SET turn_order = '[{"participant_id":"x"}]'::jsonb WHERE id = $1`, [started]);
    await assert.rejects(() => call(owner, 'set_draft_categories', started, owner.id, ['Comedy']), /after the draft has started/);

    const special = await privateDraft(db, owner, { theme: 'spec-draft', categories: ['Best Villain'] });
    await assert.rejects(() => call(owner, 'set_draft_categories', special, owner.id, ['Comedy']), /keeps its own categories/);

    const { players: [host], id } = await openTable(1);
    await assert.rejects(() => call(host, 'set_draft_categories', id, host.id, ['Comedy']), /changed from its settings/);
  });

  test('a filmography draft can also pick the actor\'s own categories from the setup list; other kinds of draft cannot', async () => {
    const { db, openTable, call } = await fresh();
    await db.exec(`CREATE TABLE IF NOT EXISTS public.actor_spec_categories (id uuid DEFAULT gen_random_uuid(), actor_name text, category_name text)`);
    await db.query(`INSERT INTO public.actor_spec_categories (actor_name, category_name) VALUES ('Tom Cruise', 'Mission Impossible')`);
    const people = await openTable(1, { theme: 'people', option: 'Tom Cruise', categories: ['Comedy'] });
    const r = await call(people.players[0], 'set_table_settings', people.id, null, null, null, ['Mission Impossible', 'Comedy']);
    assert.deepEqual(r.categories, ['Mission Impossible', 'Comedy']);
    await assert.rejects(() => call(people.players[0], 'set_table_settings', people.id, null, null, null, ['Mission Impossible', 'Not In The List']), /isn.t available/);

    const year = await openTable(1, { theme: 'year', option: '1999', categories: ['Comedy'] });
    await assert.rejects(() => call(year.players[0], 'set_table_settings', year.id, null, null, null, ['Mission Impossible']), /isn.t available/);
  });

  test('a table keeps a custom category it was made with, too', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1, { categories: ['Comedy', 'Best Villain'] });
    const r = await call(host, 'set_table_settings', id, null, null, null, ['Best Villain']);
    assert.deepEqual(r.categories, ['Best Villain']);
  });
});

describe('who may call it', () => {
  test('signed-in people only: closed to signed-out visitors', async () => {
    const { db, mk } = await fresh();
    const p = await mk();
    await actAs(db, p);
    try {
      await db.exec('SET ROLE anon');
      await assert.rejects(db.query(`SELECT public.set_table_settings($1, 2)`, [uuid()]), /permission denied/);
    } finally {
      await db.exec('RESET ROLE');
    }
  });
});
