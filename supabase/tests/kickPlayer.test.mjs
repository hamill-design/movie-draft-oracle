// The host removes a player from the lobby.
// Migration under test: 20261124140000_kick_player.sql

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, readMigration } from './helpers.mjs';

let n = 0;

/** A database with public play on, plus helpers. Each test gets its own: lobbies are shared by everyone. */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const mk = (base = 'Kick') => makePlayer(db, { publicName: `${base} ${++n}` });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  /** What the Quick Play button does: jump into an open lobby, otherwise open one. */
  const play = async (who) => {
    const j = await call(who, 'quick_join');
    return j.found ? { ...j, created: false } : call(who, 'quick_start');
  };
  const people = async (id) => (await db.query(
    `SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at, created_at`, [id])).rows;
  const notes = async (uid) => (await db.query(
    `SELECT * FROM public.notifications WHERE user_id = $1 AND type = 'removed_from_table'`, [uid])).rows;
  /** The first person opens a lobby and is its host; the rest join it. */
  async function lobbyOf(count) {
    const players = [];
    let id;
    for (let i = 0; i < count; i++) {
      const p = await mk(i === 0 ? 'Host' : 'Guest');
      players.push(p);
      id = (await play(p)).draft_id;
    }
    return { players, id, host: players[0] };
  }
  return { db, mk, call, play, people, notes, lobbyOf };
}

describe('kick_player', () => {
  test('the host removes a player: their seat opens, they are told, and nobody else is affected', async () => {
    const { db, call, people, notes, lobbyOf } = await fresh();
    const { players: [host, ann, ben], id } = await lobbyOf(3);

    const out = await call(host, 'kick_player', id, ann.id);
    assert.equal(out.kicked, true);

    const rows = await people(id);
    assert.equal(rows.length, 2);
    assert.ok(!rows.some((r) => r.user_id === ann.id), 'Ann is gone');
    assert.ok(rows.some((r) => r.user_id === host.id && r.is_host), 'the host is still the host');
    assert.ok(rows.some((r) => r.user_id === ben.id), 'Ben is untouched');

    const told = await notes(ann.id);
    assert.equal(told.length, 1);
    assert.equal(told[0].title, 'You were removed from a table');
    assert.match(told[0].body, /the host removed you/);
    assert.equal((await notes(ben.id)).length, 0);
    assert.equal((await notes(host.id)).length, 0);

    const events = (await db.query(`SELECT kind FROM public.public_play_events WHERE user_id = $1 AND draft_id = $2`, [ann.id, id])).rows.map((r) => r.kind);
    assert.ok(events.includes('kicked'));
    assert.ok(!events.includes('leave'), 'being removed does not count as leaving');
  });

  test('the freed seat can be taken by someone else', async () => {
    const { call, play, people, mk, lobbyOf } = await fresh();
    const { players: [host, a, b, c], id } = await lobbyOf(4);   // a full table of 4
    await call(host, 'kick_player', id, b.id);
    const late = await mk('Late');
    const j = await play(late);
    assert.equal(j.draft_id, id, 'Quick Play puts the newcomer in the now-open seat');
    assert.equal((await people(id)).length, 4);
    assert.ok(a && c);
  });

  test('the removed player cannot sit down at that table again, by any door', async () => {
    const { call, play, people, lobbyOf } = await fresh();
    const { players: [host, ann], id } = await lobbyOf(2);
    await call(host, 'kick_player', id, ann.id);

    await assert.rejects(call(ann, 'join_public_table', id), /host removed you/);

    // Quick Play skips that lobby and opens a new one instead of bouncing off it
    const j = await call(ann, 'quick_join');
    assert.equal(j.found, false, 'the lobby she was removed from is not offered');
    const fresh2 = await play(ann);
    assert.equal(fresh2.created, true);
    assert.notEqual(fresh2.draft_id, id);
    assert.equal((await people(id)).length, 1, 'still only the host at the old table');
  });

  test('being removed from one table does not touch any other table', async () => {
    const { call, play, mk, lobbyOf } = await fresh();
    const { players: [host, ann], id } = await lobbyOf(2);
    await call(host, 'kick_player', id, ann.id);
    const other = await mk('Other Host');
    const opened = await call(other, 'quick_start');          // a different lobby
    const j = await call(ann, 'quick_join');                  // she can join that one
    assert.equal(j.found, true);
    assert.equal(j.draft_id, opened.draft_id);
    assert.ok(play);
  });

  test('only the host can remove players', async () => {
    const { call, lobbyOf } = await fresh();
    const { players: [host, ann, ben], id } = await lobbyOf(3);
    await assert.rejects(call(ann, 'kick_player', id, ben.id), /Only the host/);
    assert.ok(host);
  });

  test('the host cannot remove themselves, someone who is not there, or nobody', async () => {
    const { call, mk, lobbyOf } = await fresh();
    const { players: [host], id } = await lobbyOf(2);
    await assert.rejects(call(host, 'kick_player', id, host.id), /cannot remove yourself/);
    const stranger = await mk('Stranger');
    await assert.rejects(call(host, 'kick_player', id, stranger.id), /not at this table/);
    await assert.rejects(call(host, 'kick_player', id, null), /cannot remove yourself/);
  });

  test('a signed-out visitor cannot remove anyone', async () => {
    const { db, lobbyOf } = await fresh();
    const { players: [, ann], id } = await lobbyOf(2);
    await actAs(db, null);
    await assert.rejects(rpcJson(db, 'kick_player', id, ann.id), /Sign in/);
  });

  test('not once the draft has started, and not during the 15-second check', async () => {
    const { db, call, people, lobbyOf } = await fresh();
    const { players: [host, ann], id } = await lobbyOf(2);

    await db.query(`UPDATE public.drafts SET ready_check_expires_at = now() + interval '10 seconds' WHERE id = $1`, [id]);
    await assert.rejects(call(host, 'kick_player', id, ann.id), /about to start/);
    await db.query(`UPDATE public.drafts SET ready_check_expires_at = NULL WHERE id = $1`, [id]);

    // everyone is on the page, so Start begins the draft at once (nobody needs the 15-second check)
    await db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1`, [id]);
    await call(host, 'start_public_table', id, true);
    await assert.rejects(call(host, 'kick_player', id, ann.id), /before the draft starts/);
    assert.ok((await people(id)).some((p) => p.user_id === ann.id), 'Ann is still in the draft');
  });

  test('a host can remove at most 20 players an hour', async () => {
    const { db, call, lobbyOf } = await fresh();
    const { players: [host, ann], id } = await lobbyOf(2);
    for (let i = 0; i < 20; i++) {
      await db.query(`INSERT INTO public.public_play_events (user_id, kind, draft_id) VALUES ($1, 'kick', $2)`, [host.id, id]);
    }
    await assert.rejects(call(host, 'kick_player', id, ann.id), /removed a lot of players/);
  });

  test('removing the same person again is refused cleanly, not recorded twice', async () => {
    const { db, call, lobbyOf } = await fresh();
    const { players: [host, ann], id } = await lobbyOf(2);
    await call(host, 'kick_player', id, ann.id);
    await assert.rejects(call(host, 'kick_player', id, ann.id), /not at this table/);
    const n2 = (await db.query(`SELECT count(*)::int AS n FROM public.draft_kicks WHERE draft_id = $1`, [id])).rows[0].n;
    assert.equal(n2, 1);
  });

  test('the list of removed players is closed to players and visitors', async () => {
    const { db, lobbyOf } = await fresh();
    const { players: [host], id } = await lobbyOf(2);
    await actAs(db, host);
    for (const role of ['authenticated', 'anon']) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await assert.rejects(db.query(`SELECT * FROM public.draft_kicks WHERE draft_id = $1`, [id]), /permission denied|row-level/, role);
      } finally {
        await db.exec('RESET ROLE');
      }
    }
  });

  test('only signed-in players may call it: the signed-out role may not', async () => {
    const { db, lobbyOf } = await fresh();
    const { players: [, ann], id } = await lobbyOf(2);
    await db.exec('SET ROLE anon');
    try {
      await assert.rejects(db.query(`SELECT public.kick_player($1, $2)`, [id, ann.id]), /permission denied/);
    } finally {
      await db.exec('RESET ROLE');
    }
  });

  test('running the migration again is harmless and keeps working', async () => {
    const { db, call, lobbyOf } = await fresh();
    await db.exec(readMigration('20261124140000_kick_player.sql'));
    const { players: [host, ann], id } = await lobbyOf(2);
    assert.equal((await call(host, 'kick_player', id, ann.id)).kicked, true);
  });
});
