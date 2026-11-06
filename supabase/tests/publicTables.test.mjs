import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDb, makePlayer, actAs, setMode, rpc, rpcJson, inHours, uuid, expireClock, refereeResolve,
} from './helpers.mjs';

let counter = 0;
const nm = (base) => `${base} ${++counter}`;

describe('public tables (Open Tables)', () => {
  let db;
  before(async () => {
    db = await newDb({ publicPlay: true });
    await setMode(db, 'on');
  });

  // ── helpers ──────────────────────────────────────────────
  const mk = (base, extra = {}) => makePlayer(db, { publicName: nm(base), ...extra });

  async function createTable(host, o = {}) {
    await actAs(db, host);
    const r = await rpcJson(
      db, 'create_public_table',
      o.title ?? 'Test table', o.theme ?? 'year', o.option ?? '1999',
      o.categories ?? ['Comedy', 'Drama/Romance'], o.size ?? 4, o.clock ?? 3600,
      o.rated ?? true, o.at ?? null,
    );
    return r.draft_id;
  }
  const join = async (who, id) => { await actAs(db, who); return rpcJson(db, 'join_public_table', id); };
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const draftRow = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const people = async (id) =>
    (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at, created_at`, [id])).rows;
  const notes = async (userId, type) =>
    (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND ($2::text IS NULL OR type = $2)`, [userId, type ?? null])).rows;
  const sweep = () => rpcJson(db, 'referee_sweep_tables');
  const status = async (id, who) => { await actAs(db, who); return (await rpcJson(db, 'get_table_info', id)).status; };
  const backdate = (id, sql, params = []) => db.query(`UPDATE public.drafts SET ${sql} WHERE id = $1`, [id, ...params]);

  // ── creating a table ─────────────────────────────────────
  describe('creating a table', () => {
    test('the host is seated under their PUBLIC name, never their email or real name', async () => {
      const host = await mk('Host Hannah', { name: 'Hannah Realname', email: 'hannah.real@example.test' });
      const id = await createTable(host);
      const [row] = await people(id);
      assert.ok(row.is_host);
      assert.ok(row.participant_name.startsWith('Host Hannah'));
      assert.ok(!row.participant_name.includes('Realname'));
      assert.ok(!row.participant_name.includes('@'));
    });

    test('the table gets its settings, always with a clock, owned by the host', async () => {
      const host = await mk('Settings Sue');
      const id = await createTable(host, { size: 3, clock: 90, rated: false, theme: 'people', option: 'Tom Hanks' });
      const d = await draftRow(id);
      assert.equal(d.lobby_visibility, 'public');
      assert.equal(d.match_source, 'open');
      assert.equal(d.referee_enabled, true);
      assert.equal(d.pick_clock_seconds, 90);
      assert.equal(d.table_size, 3);
      assert.equal(d.rated, false);
      assert.equal(d.user_id, host.id);
      assert.equal(d.is_multiplayer, true);
    });

    test('invalid tables are refused with a plain reason', async () => {
      const host = await mk('Picky Pat');
      await assert.rejects(createTable(host, { clock: 29 }), /between 30 seconds and 24 hours/);
      await assert.rejects(createTable(host, { clock: 86401 }), /between 30 seconds and 24 hours/);
      await assert.rejects(createTable(host, { size: 7 }), /between 2 and 6 seats/);
      await assert.rejects(createTable(host, { size: 1 }), /between 2 and 6 seats/);
      await assert.rejects(createTable(host, { theme: 'classic' }), /Choose a draft format/);
      await assert.rejects(createTable(host, { categories: [] }), /between 1 and 20 categories/);
      await assert.rejects(createTable(host, { title: '   ' }), /title/);
      await assert.rejects(createTable(host, { at: new Date(Date.now() - 60000).toISOString() }), /start time/);
      await assert.rejects(createTable(host, { at: inHours(24 * 31) }), /start time/);
    });

    test('a player must choose a display name first', async () => {
      const nameless = await makePlayer(db);
      await assert.rejects(createTable(nameless), /Choose a display name/);
    });

    test('one host can have at most two open tables', async () => {
      const host = await mk('Busy Bee');
      const a = await createTable(host);
      await createTable(host);
      await assert.rejects(createTable(host), /already host 2 open tables/);
      await call(host, 'cancel_public_table', a);
      await createTable(host); // room again
    });

    test('the database itself refuses a public table without a clock', async () => {
      const host = await mk('Direct Dora');
      const id = await createTable(host);
      await assert.rejects(
        db.query(`UPDATE public.drafts SET pick_clock_seconds = NULL WHERE id = $1`, [id]),
        /drafts_public_needs_clock/
      );
      await assert.rejects(
        db.query(`UPDATE public.drafts SET referee_enabled = false WHERE id = $1`, [id]),
        /drafts_public_needs_clock/
      );
    });

    test('the host cannot change a public table\'s clock after creating it', async () => {
      const host = await mk('Clock Clive');
      const id = await createTable(host);
      await assert.rejects(call(host, 'set_draft_referee', id, host.id, true, 45), /cannot be changed/);
    });
  });

  // ── browsing ─────────────────────────────────────────────
  describe('browsing tables', () => {
    test('a newly created table shows up with the host\'s public name, seats and clock', async () => {
      const host = await mk('Lister Lou');
      const viewer = await mk('Viewer Val');
      const id = await createTable(host, { size: 3, clock: 3600 });
      await actAs(db, viewer);
      const rows = await rpc(db, 'list_public_tables');
      const row = rows.find((r) => r.draft_id === id);
      assert.ok(row, 'listed');
      assert.ok(row.host_name.startsWith('Lister Lou'));
      assert.equal(row.table_size, 3);
      assert.equal(row.joined_count, 1);
      assert.equal(row.seats_open, 2);
      assert.equal(row.speed, 'slow');
      assert.equal(row.i_joined, false);
    });

    test('the list never contains an email address', async () => {
      const host = await mk('Private Pete', { email: 'pete.private@example.test', name: 'Pete Private' });
      await createTable(host);
      await actAs(db, await mk('Nosy Nan'));
      const json = JSON.stringify(await rpc(db, 'list_public_tables'));
      assert.ok(!json.includes('@'), 'no email-looking text anywhere');
      assert.ok(!json.includes('pete.private'));
    });

    test('filter by speed: live (2 minutes or less) vs slow', async () => {
      const host = await mk('Speedy Sam');
      const live = await createTable(host, { clock: 60 });
      const slow = await createTable(host, { clock: 43200 });
      await actAs(db, await mk('Filter Fran'));
      const liveRows = await rpc(db, 'list_public_tables', 'live');
      assert.ok(liveRows.every((r) => r.speed === 'live'));
      assert.ok(liveRows.some((r) => r.draft_id === live));
      assert.ok(!liveRows.some((r) => r.draft_id === slow));
      const slowRows = await rpc(db, 'list_public_tables', 'slow');
      assert.ok(slowRows.some((r) => r.draft_id === slow));
      assert.ok(!slowRows.some((r) => r.draft_id === live));
    });

    test('filter by format', async () => {
      const host = await mk('Format Fred');
      const people = await createTable(host, { theme: 'people', option: 'Meryl Streep' });
      await actAs(db, await mk('Format Fay'));
      const rows = await rpc(db, 'list_public_tables', null, 'people');
      assert.ok(rows.every((r) => r.theme === 'people'));
      assert.ok(rows.some((r) => r.draft_id === people));
    });

    test('cancelled and already-started tables are not listed; private drafts never are', async () => {
      const host = await mk('Hidden Hal');
      const cancelled = await createTable(host);
      await call(host, 'cancel_public_table', cancelled);
      const started = await createTable(host);
      const joiner = await mk('Hidden Joiner');
      await join(joiner, started);
      await call(host, 'start_public_table', started, false);

      const { rows: [priv] } = await db.query(
        `INSERT INTO public.drafts (user_id, title, categories, is_multiplayer) VALUES ($1, 'Friends only', ARRAY['Comedy'], true) RETURNING id`, [host.id]);

      await actAs(db, await mk('Hidden Looker'));
      const ids = (await rpc(db, 'list_public_tables')).map((r) => r.draft_id);
      assert.ok(!ids.includes(cancelled));
      assert.ok(!ids.includes(started));
      assert.ok(!ids.includes(priv.id));
    });

    test('a table hosted by someone you blocked (or who blocked you) is hidden', async () => {
      const host = await mk('Blocked Host');
      const viewer = await mk('Blocking Viewer');
      const id = await createTable(host);
      await actAs(db, viewer);
      assert.ok((await rpc(db, 'list_public_tables')).some((r) => r.draft_id === id));
      await db.query(`SELECT public.block_player($1)`, [host.id]);
      assert.ok(!(await rpc(db, 'list_public_tables')).some((r) => r.draft_id === id));
      // the other direction too
      const viewer2 = await mk('Blocked Viewer');
      await actAs(db, host);
      await db.query(`SELECT public.block_player($1)`, [viewer2.id]);
      await actAs(db, viewer2);
      assert.ok(!(await rpc(db, 'list_public_tables')).some((r) => r.draft_id === id));
    });

    test('people can browse before choosing a name; they just cannot join yet', async () => {
      const nameless = await makePlayer(db);
      const host = await mk('Open Door');
      const id = await createTable(host);
      await actAs(db, nameless);
      assert.ok((await rpc(db, 'list_public_tables')).some((r) => r.draft_id === id));
      await assert.rejects(rpcJson(db, 'join_public_table', id), /Choose a display name/);
    });

    test('get_table_info shows names and avatars only', async () => {
      const host = await mk('Info Ivy', { email: 'ivy.info@example.test', name: 'Ivy Realname' });
      const id = await createTable(host);
      const joiner = await mk('Info Jack', { email: 'jack.info@example.test' });
      await join(joiner, id);
      await actAs(db, joiner);
      const info = await rpcJson(db, 'get_table_info', id);
      assert.equal(info.status, 'forming');
      assert.equal(info.i_joined, true);
      assert.equal(info.i_am_host, false);
      assert.equal(info.participants.length, 2);
      assert.equal(info.participants.find((p) => p.is_host).name.startsWith('Info Ivy'), true);
      const json = JSON.stringify(info);
      assert.ok(!json.includes('@'));
      assert.ok(!json.includes('Realname'));
    });

    test('get_table_info refuses non-public drafts (it never leaks private ones)', async () => {
      const host = await mk('Leak Lee');
      const { rows: [priv] } = await db.query(
        `INSERT INTO public.drafts (user_id, title, categories, is_multiplayer) VALUES ($1, 'Friends only', ARRAY['Comedy'], true) RETURNING id`, [host.id]);
      await actAs(db, host);
      await assert.rejects(rpcJson(db, 'get_table_info', priv.id), /Table not found/);
      await assert.rejects(rpcJson(db, 'get_table_info', uuid()), /Table not found/);
    });

    test('draft_is_public tells the draft screen not to load emails', async () => {
      const host = await mk('Public Pam');
      const id = await createTable(host);
      const { rows: [priv] } = await db.query(
        `INSERT INTO public.drafts (user_id, title, categories, is_multiplayer) VALUES ($1, 'Friends only', ARRAY['Comedy'], true) RETURNING id`, [host.id]);
      assert.equal(await rpcJson(db, 'draft_is_public', id), true);
      assert.equal(await rpcJson(db, 'draft_is_public', priv.id), false);
      assert.equal(await rpcJson(db, 'draft_is_public', uuid()), false);
    });
  });

  // ── joining and leaving ──────────────────────────────────
  describe('joining', () => {
    test('a joiner is seated under their public name, not their email', async () => {
      const host = await mk('Join Host');
      const id = await createTable(host);
      const joiner = await mk('Joiner Jo', { name: 'Joanna Realname', email: 'joanna.real@example.test' });
      await join(joiner, id);
      const row = (await people(id)).find((p) => p.user_id === joiner.id);
      assert.ok(row.participant_name.startsWith('Joiner Jo'));
      assert.ok(!row.participant_name.includes('Realname') && !row.participant_name.includes('@'));
    });

    test('joining twice is harmless', async () => {
      const host = await mk('Twice Host');
      const id = await createTable(host);
      const j = await mk('Twice Joiner');
      await join(j, id);
      const again = await join(j, id);
      assert.equal(again.already_joined, true);
      assert.equal((await people(id)).length, 2);
    });

    test('a full table refuses, and seats are never over-filled', async () => {
      const host = await mk('Full Host');
      const id = await createTable(host, { size: 2 });
      await join(await mk('First In'), id);
      await assert.rejects(join(await mk('Too Late'), id), /table is full/);
      assert.equal((await people(id)).length, 2);
    });

    test('cancelled or started tables cannot be joined', async () => {
      const host = await mk('Closed Host');
      const cancelled = await createTable(host);
      await call(host, 'cancel_public_table', cancelled);
      await assert.rejects(join(await mk('Late Larry'), cancelled), /cancelled/);

      const started = await createTable(host);
      await join(await mk('Early Ed'), started);
      await call(host, 'start_public_table', started, false);
      await assert.rejects(join(await mk('Later Lena'), started), /already started/);
    });

    test('someone blocked by (or blocking) a player at the table cannot sit down', async () => {
      const host = await mk('Block Host');
      const id = await createTable(host);
      const a = await mk('Block Ann');
      await join(a, id);
      const b = await mk('Block Bob');
      await actAs(db, b);
      await db.query(`SELECT public.block_player($1)`, [a.id]);
      await assert.rejects(rpcJson(db, 'join_public_table', id), /isn't available/);
    });

    test('a banned player cannot join', async () => {
      const host = await mk('Ban Host');
      const id = await createTable(host);
      const banned = await mk('Banned Bill');
      await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [banned.id]);
      await assert.rejects(join(banned, id), /suspended/);
    });

    test('hopping on and off tables too quickly is slowed down', async () => {
      const hopper = await mk('Hopper Hank');
      for (let i = 0; i < 5; i++) {
        const host = await mk('Hop Host');
        const id = await createTable(host);
        await join(hopper, id);
        await call(hopper, 'leave_public_table', id);
      }
      const host = await mk('Hop Host');
      const id = await createTable(host);
      await assert.rejects(join(hopper, id), /left several tables/);
    });

    test('my_public_tables lists tables I am at', async () => {
      const host = await mk('Mine Host');
      const id = await createTable(host);
      const j = await mk('Mine Joiner');
      await join(j, id);
      await actAs(db, j);
      const mine = await rpc(db, 'my_public_tables');
      assert.ok(mine.some((t) => t.draft_id === id && t.status === 'forming' && t.i_am_host === false));
    });
  });

  describe('leaving', () => {
    test('a player leaves and their seat is free again', async () => {
      const host = await mk('Leave Host');
      const id = await createTable(host, { size: 2 });
      const j = await mk('Leaver Lee');
      await join(j, id);
      await call(j, 'leave_public_table', id);
      assert.equal((await people(id)).length, 1);
      await join(await mk('Replacement Rae'), id);
    });

    test('when the host leaves, the next player who joined becomes host, and ownership moves with it', async () => {
      const host = await mk('Leaving Host');
      const id = await createTable(host);
      const first = await mk('Next In Line');
      const second = await mk('Second In Line');
      await join(first, id);
      await join(second, id);

      const res = await call(host, 'leave_public_table', id);
      assert.equal(res.table_cancelled, false);
      assert.equal(res.new_host, first.id);

      const ps = await people(id);
      assert.equal(ps.length, 2);
      assert.equal(ps.find((p) => p.user_id === first.id).is_host, true);
      assert.equal((await draftRow(id)).user_id, first.id);
      assert.equal((await notes(first.id, 'you_are_host')).length, 1);
    });

    test('if the host leaves an empty table, it is cancelled', async () => {
      const host = await mk('Lonely Host');
      const id = await createTable(host);
      const res = await call(host, 'leave_public_table', id);
      assert.equal(res.table_cancelled, true);
      assert.equal(await status(id, host), 'cancelled');
    });

    test('leaving after the draft started is not possible', async () => {
      const host = await mk('Started Host');
      const id = await createTable(host);
      const j = await mk('Started Joiner');
      await join(j, id);
      await call(host, 'start_public_table', id, false);
      await assert.rejects(call(j, 'leave_public_table', id), /already started/);
    });

    test('you cannot leave a table you are not at', async () => {
      const host = await mk('Not Mine Host');
      const id = await createTable(host);
      await assert.rejects(call(await mk('Stranger Sid'), 'leave_public_table', id), /not at this table/);
    });
  });

  // ── host controls ────────────────────────────────────────
  describe('schedule and cancel', () => {
    test('only the host can change the schedule; players are told', async () => {
      const host = await mk('Sched Host');
      const id = await createTable(host, { at: inHours(5) });
      const j = await mk('Sched Joiner');
      await join(j, id);

      await assert.rejects(call(j, 'set_table_schedule', id, inHours(6)), /Only the host/);

      const when = inHours(8);
      const res = await call(host, 'set_table_schedule', id, when);
      assert.equal(res.changed, true);
      const told = await notes(j.id, 'schedule_changed');
      assert.equal(told.length, 1);
      assert.equal((await notes(host.id, 'schedule_changed')).length, 0, 'the host is not notified of their own change');
    });

    test('a schedule can be cleared, and an unchanged one does nothing', async () => {
      const host = await mk('Clear Host');
      const when = inHours(3);
      const id = await createTable(host, { at: when });
      assert.equal((await call(host, 'set_table_schedule', id, null)).changed, true);
      assert.equal((await draftRow(id)).scheduled_start_at, null);
      assert.equal((await call(host, 'set_table_schedule', id, null)).changed, false);
    });

    test('an impossible schedule is refused', async () => {
      const host = await mk('Past Host');
      const id = await createTable(host);
      await assert.rejects(call(host, 'set_table_schedule', id, new Date(Date.now() - 1000).toISOString()), /start time/);
    });

    test('cancelling tells the players and closes the table', async () => {
      const host = await mk('Cancel Host');
      const id = await createTable(host);
      const j = await mk('Cancel Joiner');
      await join(j, id);
      await assert.rejects(call(j, 'cancel_public_table', id), /Only the host/);
      await call(host, 'cancel_public_table', id);
      assert.equal((await notes(j.id, 'table_cancelled')).length, 1);
      assert.equal(await status(id, j), 'cancelled');
    });
  });

  // ── starting ─────────────────────────────────────────────
  describe('starting a table', () => {
    test('only the host can start it', async () => {
      const host = await mk('Boss Host');
      const id = await createTable(host);
      const j = await mk('Eager Joiner');
      await join(j, id);
      await assert.rejects(call(j, 'start_public_table', id, false), /Only the host/);
    });

    test('a slow table starts straight away, using the LIVE start function, and the referee clock begins', async () => {
      const host = await mk('Slow Host');
      const id = await createTable(host, { categories: ['Comedy', 'Drama/Romance'], clock: 3600, size: 2 });
      const j = await mk('Slow Joiner');
      await join(j, id);

      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.status, 'started');
      assert.equal(res.humans, 2);
      assert.equal(res.bots_added, 0);
      assert.equal(res.rated, true);

      const d = await draftRow(id);
      assert.equal(d.turn_order.length, 4, '2 players x 2 categories');
      assert.equal(d.current_pick_number, 1);
      assert.equal(d.current_turn_participant_id, d.turn_order[0].participant_id);
      assert.ok((new Date(d.current_turn_deadline_at) - Date.now()) / 1000 > 3500, 'the first turn has a ~1 hour clock');
      assert.equal(await status(id, host), 'active');
    });

    test('the signed-in person is unchanged after starting (the start borrows the host\'s identity only inside)', async () => {
      const host = await mk('Identity Host');
      const id = await createTable(host);
      await join(await mk('Identity Joiner'), id);
      await actAs(db, host);
      await rpcJson(db, 'start_public_table', id, false);
      const who = (await db.query(`SELECT auth.uid() AS u`)).rows[0].u;
      assert.equal(who, host.id);
    });

    test('a host on their own plays against bots, and the game is automatically unrated', async () => {
      const host = await mk('Solo Host');
      const id = await createTable(host, { size: 4, rated: true });
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.status, 'started');
      assert.equal(res.humans, 1);
      assert.equal(res.bots_added, 3);
      assert.equal(res.rated, false);
      const d = await draftRow(id);
      assert.equal(d.rated, false);
      const ps = await people(id);
      assert.equal(ps.length, 4);
      assert.equal(ps.filter((p) => p.is_ai).length, 3);
    });

    test('even a 2-seat table works solo (one bot)', async () => {
      const host = await mk('Duel Host');
      const id = await createTable(host, { size: 2 });
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.bots_added, 1);
      assert.equal((await draftRow(id)).turn_order.length > 0, true);
    });

    test('the host can fill empty seats with bots, and still be rated with 2+ real players', async () => {
      const host = await mk('Fill Host');
      const id = await createTable(host, { size: 4, rated: true });
      await join(await mk('Fill Joiner'), id);
      const res = await call(host, 'start_public_table', id, true);
      assert.equal(res.humans, 2);
      assert.equal(res.bots_added, 2);
      assert.equal(res.rated, true);
      assert.equal((await people(id)).length, 4);
    });

    test('empty seats always fill with bots, whatever the screen sends; a smaller draft means taking seats away', async () => {
      const host = await mk('Small Host');
      const id = await createTable(host, { size: 6 });
      await join(await mk('Small Joiner'), id);
      await call(host, 'set_table_settings', id, 2);
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.bots_added, 0, 'two seats, two people: no bots needed');
      assert.equal((await people(id)).length, 2);

      const host2 = await mk('Bots Host');
      const id2 = await createTable(host2, { size: 6 });
      await join(await mk('Bots Joiner'), id2);
      const res2 = await call(host2, 'start_public_table', id2, false);
      assert.equal(res2.bots_added, 4, 'leaving the seats alone fills them, even when the old "no bots" flag is sent');
      assert.equal((await people(id2)).length, 6);
    });

    test('a casual table stays casual', async () => {
      const host = await mk('Casual Host');
      const id = await createTable(host, { rated: false });
      await join(await mk('Casual Joiner'), id);
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.rated, false);
    });

    test('bot names are never real players\' names and are unique at the table', async () => {
      const host = await mk('Names Host');
      const id = await createTable(host, { size: 6 });
      await call(host, 'start_public_table', id, true);
      const bots = (await people(id)).filter((p) => p.is_ai).map((p) => p.participant_name);
      assert.equal(new Set(bots).size, bots.length);
      assert.equal(bots.length, 5);
    });

    test('starting twice does not start it twice', async () => {
      const host = await mk('Twice Start Host');
      const id = await createTable(host);
      await join(await mk('Twice Start Joiner'), id);
      await call(host, 'start_public_table', id, false);
      await assert.rejects(call(host, 'start_public_table', id, false), /already started/);
    });
  });

  describe('the live ready check (clock of 2 minutes or less)', () => {
    async function liveTable(extraJoiners = 2, opts = {}) {
      const host = await mk('Live Host');
      const id = await createTable(host, { clock: 60, categories: ['Comedy'], size: 4, ...opts });
      const joiners = [];
      for (let i = 0; i < extraJoiners; i++) {
        const j = await mk('Live Joiner');
        await join(j, id);
        joiners.push(j);
      }
      return { host, id, joiners };
    }

    test('pressing Start begins a 15-second check instead of starting', async () => {
      const { host, id } = await liveTable(2);
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.status, 'ready_check');
      const secs = (new Date(res.expires_at) - Date.now()) / 1000;
      assert.ok(secs > 10 && secs <= 15.5, `~15s, got ${secs}`);
      assert.equal(await status(id, host), 'forming');
      const ps = await people(id);
      assert.equal(ps.find((p) => p.is_host).ready_at !== null, true, 'the host is already ready');
      assert.equal(ps.filter((p) => !p.is_host && p.ready_at === null).length, 2);
      const { joiners } = { joiners: ps.filter((p) => !p.is_host) };
      assert.equal(joiners.length, 2);
    });

    test('the players are told to confirm', async () => {
      const { host, id, joiners } = await liveTable(2);
      await call(host, 'start_public_table', id, false);
      for (const j of joiners) assert.equal((await notes(j.id, 'match_found')).length, 1);
      assert.equal((await notes(host.id, 'match_found')).length, 0);
    });

    test('nobody new can sit down during a ready check', async () => {
      const { host, id } = await liveTable(1);
      await call(host, 'start_public_table', id, false);
      await assert.rejects(join(await mk('Sneaky Late'), id), /about to start/);
    });

    test('when everybody confirms, the draft starts at once', async () => {
      const { host, id, joiners } = await liveTable(2);
      await call(host, 'start_public_table', id, false);
      const first = await call(joiners[0], 'confirm_ready', id);
      assert.equal(first.all_ready, false);
      const last = await call(joiners[1], 'confirm_ready', id);
      assert.equal(last.all_ready, true);
      assert.equal(last.result.status, 'started');
      assert.equal(last.result.humans, 3);
      assert.equal(await status(id, host), 'active');
    });

    test('when the LAST PLAYER (not the host) triggers the start, they are still themselves afterwards', async () => {
      // The start borrows the host's identity internally; it must hand it back. Only visible
      // inside one transaction, which is how a real request runs.
      const { host, id, joiners } = await liveTable(1);
      await call(host, 'start_public_table', id, false);
      await actAs(db, joiners[0]);
      const who = await db.transaction(async (tx) => {
        await tx.query(`SELECT public.confirm_ready($1)`, [id]);
        return (await tx.query(`SELECT auth.uid() AS u`)).rows[0].u;
      });
      assert.equal(who, joiners[0].id);
      assert.equal(await status(id, host), 'active');
    });

    test('if someone never confirms, the sweep starts without them and tells them', async () => {
      const { host, id, joiners } = await liveTable(2);
      await call(host, 'start_public_table', id, false);
      await call(joiners[0], 'confirm_ready', id);
      await backdate(id, `ready_check_expires_at = now() - interval '1 second'`);

      const out = await sweep();
      assert.equal(out.started, 1);
      const ps = await people(id);
      assert.equal(ps.filter((p) => !p.is_ai).length, 2, 'the absent player was removed');
      assert.equal(ps.length, 4, 'and the table is still full: bots took the empty seats');
      assert.ok(!ps.some((p) => p.user_id === joiners[1].id));
      assert.equal((await notes(joiners[1].id, 'removed_from_table')).length, 1);
      assert.equal(await status(id, host), 'active');
    });

    test('the host can also finish an expired check by pressing Start again', async () => {
      const { host, id, joiners } = await liveTable(2);
      await call(host, 'start_public_table', id, false);
      await call(joiners[0], 'confirm_ready', id);
      await backdate(id, `ready_check_expires_at = now() - interval '1 second'`);
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.status, 'started');
      assert.equal(res.humans, 2);
    });

    test('pressing Start while a check is still running just reports it', async () => {
      const { host, id } = await liveTable(1);
      await call(host, 'start_public_table', id, false);
      const again = await call(host, 'start_public_table', id, false);
      assert.equal(again.status, 'ready_check');
    });

    test('the "fill with bots" choice made at Start is remembered through the check', async () => {
      const { host, id, joiners } = await liveTable(1);
      await call(host, 'start_public_table', id, true);
      const res = await call(joiners[0], 'confirm_ready', id);
      assert.equal(res.result.bots_added, 2);
      assert.equal((await people(id)).length, 4);
    });

    test('a live table with only the host starts without a check', async () => {
      const { host, id } = await liveTable(0);
      const res = await call(host, 'start_public_table', id, false);
      assert.equal(res.status, 'started');
      assert.equal(res.humans, 1);
    });

    test('confirming when there is no check, or when you are not at the table, is refused', async () => {
      const { host, id, joiners } = await liveTable(1);
      await assert.rejects(call(joiners[0], 'confirm_ready', id), /no ready check/);
      await call(host, 'start_public_table', id, false);
      await assert.rejects(call(await mk('Outsider Olga'), 'confirm_ready', id), /not at this table/);
    });
  });

  // ── host no-shows, reminders, and the sweep ──────────────
  describe('the sweep: reminders, nudges and host no-shows', () => {
    test('players get one "starts soon" reminder in the last hour, the host gets one nudge when it is time', async () => {
      const host = await mk('Remind Host');
      const id = await createTable(host, { at: inHours(2) });
      const j = await mk('Remind Joiner');
      await join(j, id);

      assert.equal((await sweep()).reminded >= 0, true);
      assert.equal((await notes(j.id, 'table_starts_soon')).length, 0, 'not yet: still 2 hours out');

      await backdate(id, `scheduled_start_at = now() + interval '30 minutes'`);
      await sweep();
      await sweep(); // a second sweep must not repeat it
      assert.equal((await notes(j.id, 'table_starts_soon')).length, 1);
      assert.equal((await notes(host.id, 'table_starts_soon')).length, 1);

      await backdate(id, `scheduled_start_at = now() - interval '1 minute'`);
      await sweep();
      await sweep();
      assert.equal((await notes(host.id, 'time_to_start')).length, 1);
      assert.equal((await notes(j.id, 'time_to_start')).length, 0, 'only the host is nudged');
    });

    test('changing the schedule re-arms the reminders', async () => {
      const host = await mk('Rearm Host');
      const id = await createTable(host, { at: inHours(2) });
      const j = await mk('Rearm Joiner');
      await join(j, id);
      await backdate(id, `scheduled_start_at = now() + interval '30 minutes'`);
      await sweep();
      assert.equal((await notes(j.id, 'table_starts_soon')).length, 1);

      await call(host, 'set_table_schedule', id, inHours(1) /* 60 min: just outside the window */);
      assert.equal((await draftRow(id)).reminder_sent_at, null);
      await backdate(id, `scheduled_start_at = now() + interval '20 minutes'`);
      await sweep();
      assert.equal((await notes(j.id, 'table_starts_soon')).length, 2);
    });

    test('SLOW table, host absent 24h past the scheduled time: the next player who joined takes over', async () => {
      const host = await mk('Absent Host');
      const id = await createTable(host, { clock: 3600, at: inHours(2) });
      const first = await mk('Takes Over');
      const second = await mk('Waits Behind');
      await join(first, id);
      await join(second, id);
      await backdate(id, `scheduled_start_at = now() - interval '25 hours', host_since = now() - interval '26 hours'`);

      const out = await sweep();
      assert.equal(out.handoffs, 1);

      const d = await draftRow(id);
      assert.equal(d.user_id, first.id, 'ownership moved with the role');
      assert.equal(d.host_handoff_count, 1);
      const ps = await people(id);
      assert.equal(ps.find((p) => p.user_id === first.id).is_host, true);
      assert.equal(ps.find((p) => p.user_id === host.id).is_host, false);
      assert.ok(ps.find((p) => p.user_id === host.id), 'the original host keeps their seat as a player');
      assert.equal((await notes(first.id, 'you_are_host')).length, 1);
    });

    test('the old host can no longer start the table, not even through the live start function', async () => {
      const host = await mk('Deposed Host');
      const id = await createTable(host, { at: inHours(2) });
      await join(await mk('New Boss'), id);
      await backdate(id, `scheduled_start_at = now() - interval '25 hours', host_since = now() - interval '26 hours'`);
      await sweep();

      await assert.rejects(call(host, 'start_public_table', id, false), /Only the host/);
      await actAs(db, host);
      await assert.rejects(db.query(`SELECT * FROM public.start_multiplayer_draft_unified($1)`, [id]), /Access denied/);
    });

    test('the new host can start the table', async () => {
      const host = await mk('Gone Host');
      const id = await createTable(host, { at: inHours(2) });
      const next = await mk('Steps Up');
      await join(next, id);
      await backdate(id, `scheduled_start_at = now() - interval '25 hours', host_since = now() - interval '26 hours'`);
      await sweep();
      const res = await call(next, 'start_public_table', id, false);
      assert.equal(res.status, 'started');
      assert.equal(res.humans, 2);
    });

    test('after two handoffs, a third no-show cancels the table and tells everyone', async () => {
      const host = await mk('Flaky Host');
      const id = await createTable(host, { size: 4, at: inHours(2) });
      const a = await mk('Flaky A');
      const b = await mk('Flaky B');
      const c = await mk('Flaky C');
      for (const p of [a, b, c]) await join(p, id);

      const expire = () => backdate(id, `scheduled_start_at = now() - interval '25 hours', host_since = now() - interval '25 hours'`);
      await expire(); assert.equal((await sweep()).handoffs, 1);
      await expire(); assert.equal((await sweep()).handoffs, 1);
      assert.equal((await draftRow(id)).host_handoff_count, 2);
      await expire(); const third = await sweep();
      assert.equal(third.handoffs, 0);
      assert.equal(third.cancelled, 1);

      const d = await draftRow(id);
      assert.equal(d.cancel_reason, 'host_no_show');
      for (const p of [host, a, b, c]) assert.equal((await notes(p.id, 'table_cancelled')).length, 1, 'everyone is told');
    });

    test('a no-show host with nobody else at the table: cancelled', async () => {
      const host = await mk('Alone And Absent');
      const id = await createTable(host, { at: inHours(2) });
      await backdate(id, `scheduled_start_at = now() - interval '25 hours', host_since = now() - interval '26 hours'`);
      const out = await sweep();
      assert.equal(out.cancelled, 1);
      assert.equal(await status(id, host), 'cancelled');
    });

    test('LIVE table: the grace period is only 15 minutes', async () => {
      const host = await mk('Late Live Host');
      const id = await createTable(host, { clock: 60, at: inHours(2) });
      await join(await mk('Waiting Live'), id);

      await backdate(id, `scheduled_start_at = now() - interval '10 minutes', host_since = now() - interval '1 hour'`);
      assert.equal((await sweep()).handoffs, 0, '10 minutes late is still within grace');
      assert.equal((await draftRow(id)).host_handoff_count, 0);

      await backdate(id, `scheduled_start_at = now() - interval '20 minutes'`);
      assert.equal((await sweep()).handoffs, 1, '20 minutes late: handed over');
    });

    test('a scheduled slow table is NOT touched before the grace period ends', async () => {
      const host = await mk('Patient Host');
      const id = await createTable(host, { clock: 3600, at: inHours(2) });
      await join(await mk('Patient Joiner'), id);
      await backdate(id, `scheduled_start_at = now() - interval '23 hours', host_since = now() - interval '24 hours'`);
      assert.equal((await sweep()).handoffs, 0);
    });

    test('UNSCHEDULED tables go by presence: a host who has been away too long loses the role', async () => {
      const host = await mk('Wandering Host');
      const id = await createTable(host, { clock: 3600 });
      await join(await mk('Unscheduled Joiner'), id);
      await backdate(id, `created_at = now() - interval '30 hours', host_since = now() - interval '30 hours'`);
      await db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '25 hours' WHERE draft_id = $1 AND is_host`, [id]);
      assert.equal((await sweep()).handoffs, 1);
    });

    test('UNSCHEDULED tables: a host who is around (recent heartbeat) keeps the table', async () => {
      const host = await mk('Present Host');
      const id = await createTable(host, { clock: 3600 });
      await join(await mk('Present Joiner'), id);
      await backdate(id, `created_at = now() - interval '30 hours', host_since = now() - interval '30 hours'`);
      await db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '1 minute' WHERE draft_id = $1 AND is_host`, [id]);
      assert.equal((await sweep()).handoffs, 0);
    });

    test('UNSCHEDULED live table: 15 minutes away is enough', async () => {
      const host = await mk('Live Wanderer');
      const id = await createTable(host, { clock: 60 });
      await join(await mk('Live Wanderer Joiner'), id);
      await backdate(id, `created_at = now() - interval '2 hours', host_since = now() - interval '2 hours'`);
      await db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '20 minutes' WHERE draft_id = $1 AND is_host`, [id]);
      assert.equal((await sweep()).handoffs, 1);
    });

    test('the sweep leaves started, cancelled and non-"open" tables alone', async () => {
      const host = await mk('Untouchable Host');
      const started = await createTable(host, { at: inHours(2) });
      await join(await mk('Untouchable A'), started);
      await call(host, 'start_public_table', started, false);
      await backdate(started, `scheduled_start_at = now() - interval '50 hours', host_since = now() - interval '50 hours'`);

      const cancelled = await createTable(host, { at: inHours(2) });
      await call(host, 'cancel_public_table', cancelled);
      await backdate(cancelled, `scheduled_start_at = now() - interval '50 hours', host_since = now() - interval '50 hours'`);

      const quickHost = await mk('Quick Host');
      const { rows: [quick] } = await db.query(
        `INSERT INTO public.drafts (user_id, title, categories, is_multiplayer, lobby_visibility, match_source, referee_enabled, pick_clock_seconds, scheduled_start_at, host_since)
         VALUES ($1, 'Quick', ARRAY['Comedy'], true, 'public', 'quick', true, 90, now() - interval '50 hours', now() - interval '50 hours') RETURNING id`, [quickHost.id]);

      const before = await draftRow(started);
      const out = await sweep();
      assert.equal(out.handoffs, 0);
      assert.equal(out.cancelled, 0);
      assert.equal((await draftRow(started)).host_handoff_count, before.host_handoff_count);
      assert.equal((await draftRow(quick.id)).cancelled_at, null);
    });
  });

  // ── permissions ──────────────────────────────────────────
  describe('permissions', () => {
    test('internal and sweep functions are not callable by ordinary users', async () => {
      const p = await mk('Perm Pete');
      await actAs(db, p);
      try {
        await db.exec('SET ROLE authenticated');
        await assert.rejects(db.query(`SELECT public.referee_sweep_tables()`), /permission denied/);
        await assert.rejects(db.query(`SELECT public._do_start($1, true, false)`, [uuid()]), /permission denied/);
        await assert.rejects(db.query(`SELECT public._handoff_host($1, 'x')`, [uuid()]), /permission denied/);
        await assert.rejects(db.query(`SELECT public._add_bots($1, 3)`, [uuid()]), /permission denied/);
      } finally {
        await db.exec('RESET ROLE');
      }
    });

    test('signed-in players can use the table functions; guests (anon) cannot', async () => {
      const p = await mk('Perm Paula');
      await actAs(db, p);
      try {
        await db.exec('SET ROLE authenticated');
        await db.query(`SELECT * FROM public.list_public_tables()`);
        // A signed-out guest: the anon database role with NO signed-in person behind it.
        await db.exec('RESET ROLE');
        await actAs(db, null);
        await db.exec('SET ROLE anon');
        await assert.rejects(db.query(`SELECT * FROM public.list_public_tables()`), /permission denied/);
        await assert.rejects(db.query(`SELECT public.join_public_table($1)`, [uuid()]), /permission denied/);
        await assert.rejects(db.query(`SELECT public.create_public_table('x','year','1999',ARRAY['Comedy'],4,60,true,NULL)`), /permission denied/);
        // ...but a guest can still ask whether public play exists at all
        await db.query(`SELECT public.public_play_status()`);
        await db.query(`SELECT public.draft_is_public($1)`, [uuid()]);
      } finally {
        await db.exec('RESET ROLE');
      }
    });
  });

  // ── the whole journey ────────────────────────────────────
  describe('end to end', () => {
    test('create, join, ready check, start, play it out with the referee, finish', async () => {
      const host = await mk('Journey Host');
      const id = await createTable(host, { clock: 30, categories: ['Comedy'], size: 2 });
      const guest = await mk('Journey Guest');
      await join(guest, id);

      const started = await call(host, 'start_public_table', id, false);
      assert.equal(started.status, 'ready_check');
      const done = await call(guest, 'confirm_ready', id);
      assert.equal(done.result.status, 'started');

      // Both players walk away. The referee makes both picks.
      const d = { draftId: id };
      for (let turn = 0; turn < 2; turn++) {
        await expireClock(db, id);
        const { applied } = await refereeResolve(db, d);
        assert.equal(applied.applied, true, `turn ${turn + 1}`);
      }
      assert.equal(await status(id, host), 'complete');
      const picks = (await db.query(`SELECT pick_source FROM public.draft_picks WHERE draft_id = $1`, [id])).rows;
      assert.deepEqual(picks.map((p) => p.pick_source), ['auto', 'auto']);
    });
  });
});
