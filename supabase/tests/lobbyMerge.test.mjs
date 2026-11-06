import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, uuid } from './helpers.mjs';

/**
 * The merged lobby: public tables say who is online. (Private drafts briefly had an optional ready-up; it is gone.)
 */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  return db;
}

describe('private drafts: no ready-up any more', () => {
  test('the optional ready-up functions are gone: being in the lobby is being ready', async () => {
    const db = await fresh();
    await assert.rejects(() => rpcJson(db, 'set_participant_ready', uuid(), uuid(), true), /does not exist/);
    await assert.rejects(() => rpcJson(db, 'get_lobby_ready', uuid(), uuid()), /does not exist/);
  });
});

describe('public tables: who is online', () => {
  async function table(db) {
    const host = await makePlayer(db, { publicName: 'Table Tom' });
    const guest = await makePlayer(db, { publicName: 'Late Larry' });
    await actAs(db, host);
    const r = await rpcJson(db, 'create_public_table', 'Open game', 'year', '1999', ['Comedy', 'Drama/Romance'], 4, 60, true, null);
    await actAs(db, guest);
    await rpcJson(db, 'join_public_table', r.draft_id);
    return { id: r.draft_id, host, guest };
  }
  const online = async (db, id, viewer) => {
    await actAs(db, viewer);
    const info = await rpcJson(db, 'get_table_info', id);
    return Object.fromEntries(info.participants.map((p) => [p.name, p.online]));
  };
  const seen = (db, id, userId, sql) =>
    db.query(`UPDATE public.draft_participants SET last_seen_at = ${sql} WHERE draft_id = $1 AND user_id = $2`, [id, userId]);

  test('checked in a moment ago is online; a minute ago, or never, is not', async () => {
    const db = await fresh();
    const { id, host, guest } = await table(db);
    await seen(db, id, host.id, 'now()');
    await seen(db, id, guest.id, `now() - interval '2 minutes'`);
    let map = await online(db, id, host);
    assert.equal(map['Table Tom'], true);
    assert.equal(map['Late Larry'], false);

    await seen(db, id, guest.id, 'NULL');
    map = await online(db, id, host);
    assert.equal(map['Late Larry'], false, 'a cleared check-in (tab hidden) is offline');
  });

  test('a bot is never online, and the answer is the same for every viewer', async () => {
    const db = await fresh();
    const { id, host, guest } = await table(db);
    await db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1`, [id]);
    await db.query(
      `INSERT INTO public.draft_participants (draft_id, participant_name, is_ai, status, last_seen_at)
       VALUES ($1, 'Robo Bot', true, 'joined', now())`,
      [id],
    );
    const fromHost = await online(db, id, host);
    const fromGuest = await online(db, id, guest);
    assert.equal(fromHost['Robo Bot'], false);
    assert.deepEqual(fromHost, fromGuest);
  });

  test('the table view still never contains an email', async () => {
    const db = await fresh();
    const { id, host } = await table(db);
    await actAs(db, host);
    const info = await rpcJson(db, 'get_table_info', id);
    assert.equal(JSON.stringify(info).includes('@'), false);
  });
});
