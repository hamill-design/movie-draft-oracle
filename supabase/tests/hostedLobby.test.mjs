import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/**
 * One draft, the same hosting rules: the first player in a Quick Play lobby is its host and hands the role on
 * when they go. (How a host starts and changes a draft is in hostControls.test.mjs.)
 */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const mk = (b = 'Player') => makePlayer(db, { publicName: nm(b) });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const people = async (id) => (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at, created_at`, [id])).rows;
  const humans = async (id) => (await people(id)).filter((p) => p.user_id && !p.is_ai);
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const hostOf = async (id) => (await people(id)).find((p) => p.is_host)?.user_id ?? null;
  const notes = async (uid, type) => (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND type = $2`, [uid, type])).rows;
  const here = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  const gone = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '5 minutes' WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  const old = (id, secs = 90) => db.query(`UPDATE public.drafts SET created_at = now() - ($2 || ' seconds')::interval WHERE id = $1`, [id, String(secs)]);
  const sweepQuick = () => rpcJson(db, 'referee_sweep_quick_match');
  const sweepTables = () => rpcJson(db, 'referee_sweep_tables');

  async function quickPlay(who) {
    const j = await call(who, 'quick_join');
    const id = j.found ? j.draft_id : (await call(who, 'quick_start')).draft_id;
    await here(id, who);
    return id;
  }
  /** A lobby of `count` players who have all pressed Quick Play, in order. */
  async function lobbyOf(count) {
    const players = [];
    let id;
    for (let i = 0; i < count; i++) { const p = await mk(); players.push(p); id = await quickPlay(p); }
    return { players, id };
  }
  /** A game a player hosts, with `count - 1` others seated. */
  async function openTable(count, { size = 4 } = {}) {
    const host = await mk('Host');
    await actAs(db, host);
    const r = await rpcJson(db, 'create_public_table', 'Open game', 'year', '1999', ['Comedy', 'Drama/Romance'], size, 60, true, null);
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
  return { db, mk, call, people, humans, draft, hostOf, notes, here, gone, old, sweepQuick, sweepTables, quickPlay, lobbyOf, openTable };
}

describe('Quick Play: the first player is the host', () => {
  test('whoever opens the lobby owns it and is its host; the next players are not', async () => {
    const { lobbyOf, draft, people } = await fresh();
    const { players, id } = await lobbyOf(3);
    const d = await draft(id);
    assert.equal(d.user_id, players[0].id);
    const hosts = (await people(id)).filter((p) => p.is_host);
    assert.deepEqual(hosts.map((h) => h.user_id), [players[0].id]);
  });

  test('the host can start whenever they like; nobody else can', async () => {
    const { lobbyOf, call, draft } = await fresh();
    const { players, id } = await lobbyOf(2);
    const r = await call(players[0], 'start_public_table', id, true);
    assert.ok(['started', 'ready_check'].includes(r.status), `got ${r.status}`);
    // A live table checks the others are there first; a non-host can never do this.
    await assert.rejects(() => call(players[1], 'start_public_table', id, true), /Only the host/);
    assert.ok(await draft(id));
  });

  test('a lobby that was opened before this change gets a host (the player who was there first)', async () => {
    // New lobbies are created with a host; this checks the data fix by recreating the old shape.
    const { db, mk, quickPlay, hostOf, draft } = await fresh();
    const a = await mk(); const b = await mk();
    const id = await quickPlay(a);
    await quickPlay(b);
    await db.query(`UPDATE public.drafts SET user_id = NULL WHERE id = $1`, [id]);
    await db.query(`UPDATE public.draft_participants SET is_host = false WHERE draft_id = $1`, [id]);
    // run the backfill statements from the migration again
    const sql = (await import('node:fs')).readFileSync(new URL('../migrations/20261114100000_one_draft_hosting.sql', import.meta.url), 'utf8');
    const start = sql.indexOf('WITH first_human AS');
    const end = sql.indexOf('-- ── "Here" means');
    await db.exec(sql.slice(start, end));
    assert.equal((await draft(id)).user_id, a.id);
    assert.equal(await hostOf(id), a.id);
  });
});

describe('the host leaves: the next player takes over', () => {
  test('host gone, a second player here: the sweep hands the lobby to them, and they are told', async () => {
    const { lobbyOf, gone, old, sweepQuick, hostOf, draft, notes } = await fresh();
    const { players: [a, b, c], id } = await lobbyOf(3);
    await old(id); await gone(id, a);
    const r = await sweepQuick();
    assert.equal(r.handoffs, 1);
    assert.equal(await hostOf(id), b.id, 'the player who joined next is the host now');
    assert.equal((await draft(id)).user_id, b.id, 'ownership moves with the role');
    assert.equal((await notes(b.id, 'you_are_host')).length, 1);
    assert.equal((await notes(c.id, 'you_are_host')).length, 0);

    // ...and if that player goes too, it passes on again
    await gone(id, b);
    const r2 = await sweepQuick();
    assert.equal(r2.handoffs, 1);
    assert.equal(await hostOf(id), c.id);
  });

  test('a player who is here is chosen before one who has wandered off, even if the wanderer joined first', async () => {
    const { lobbyOf, gone, old, sweepQuick, hostOf } = await fresh();
    const { players: [a, b, c], id } = await lobbyOf(3);
    await old(id); await gone(id, a); await gone(id, b);
    await sweepQuick();
    assert.equal(await hostOf(id), c.id);
  });

  test('nobody else is here: nothing changes (the lobby is left for the "everyone left" rule)', async () => {
    const { lobbyOf, gone, old, sweepQuick, hostOf, draft } = await fresh();
    const { players: [a, b], id } = await lobbyOf(2);
    await old(id, 90); await gone(id, a); await gone(id, b);
    const r = await sweepQuick();
    assert.equal(r.handoffs, 0);
    assert.equal(await hostOf(id), a.id);
    assert.equal((await draft(id)).cancelled_at, null);
  });

  test('a brand-new lobby is not handed over in its first minute (the host is still loading the page)', async () => {
    const { lobbyOf, db, sweepQuick, hostOf } = await fresh();
    const { players: [a], id } = await lobbyOf(2);
    await db.query(`UPDATE public.draft_participants SET last_seen_at = NULL WHERE draft_id = $1 AND user_id = $2`, [id, a.id]);
    const r = await sweepQuick();
    assert.equal(r.handoffs, 0);
    assert.equal(await hostOf(id), a.id);
  });
});
