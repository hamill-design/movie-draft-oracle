import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/** Every test gets its own database: lobbies are shared by everyone. */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const mk = (b = 'Player') => makePlayer(db, { publicName: nm(b) });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const info = (who, id) => call(who, 'get_table_info', id);
  const status = async (who, id) => (await info(who, id)).status;
  const people = async (id) => (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at, created_at`, [id])).rows;
  const humans = async (id) => (await people(id)).filter((p) => p.user_id && !p.is_ai);
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const notes = async (uid, type = 'match_found') => (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND type = $2`, [uid, type])).rows;
  const sweep = () => rpcJson(db, 'referee_sweep_quick_match');

  /** What the big Quick Play button does: join an open game, otherwise open a lobby. Returns the lobby id. */
  async function quickPlay(who) {
    const j = await call(who, 'quick_join');
    const id = j.found ? j.draft_id : (await call(who, 'quick_start')).draft_id;
    await here(id, who);
    return id;
  }
  /** Opening the lobby page checks the player in (that's what "here" means). */
  const here = (id, who) =>
    db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  /** They closed the tab a while ago. */
  const gone = (id, who) =>
    db.query(`UPDATE public.draft_participants SET last_seen_at = now() - interval '5 minutes' WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  /** n players press Quick Play one after another; they all end up in one lobby. */
  async function lobbyOf(count) {
    const players = [];
    let id;
    for (let i = 0; i < count; i++) {
      const p = await mk();
      players.push(p);
      id = await quickPlay(p);
    }
    return { players, id };
  }
  return { db, mk, call, info, status, people, humans, draft, notes, sweep, quickPlay, lobbyOf, here, gone };
}

describe('Quick Play: the next person lands in the same lobby', () => {
  test('nobody open: the first player gets a lobby; the next players join it; a full lobby leaves the next player a new one', async () => {
    const { mk, quickPlay, humans, info } = await fresh();
    const a = await mk(); const b = await mk(); const c = await mk(); const d = await mk(); const e = await mk();
    const lobby = await quickPlay(a);
    assert.equal(await quickPlay(b), lobby, 'the next person joins that lobby');
    assert.equal(await quickPlay(c), lobby);
    assert.equal(await quickPlay(d), lobby, 'and so on, until it is full');
    assert.equal((await humans(lobby)).length, 4);
    const next = await quickPlay(e);
    assert.notEqual(next, lobby, 'a full lobby is not joinable, so the fifth person starts a new one');
    assert.equal((await info(e, next)).status, 'forming');
  });

  test('nobody ever hits a dead end, even with nothing switched on for Quick Match', async () => {
    const { db, mk, quickPlay, draft } = await fresh();
    await db.query(`UPDATE public.quick_match_pool SET enabled = false`);
    const id = await quickPlay(await mk());
    assert.equal((await draft(id)).match_source, 'quick');
  });
});
