import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, ADMIN_EMAIL } from './helpers.mjs';

async function fresh({ mode = 'on', approve = true } = {}) {
  const db = await newDb({ publicPlay: true });
  await setMode(db, mode);
  if (approve) await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE kind = 'year'`);
  const available = async (who) => { await actAs(db, who); return rpcJson(db, 'quick_match_available'); };
  return { db, available };
}

describe('quick_match_available: guests can ask', () => {
  test('a signed-out guest gets a plain yes when public play is on and something is approved', async () => {
    const { available } = await fresh();
    assert.equal(await available(null), true);
  });

  test('...and still yes when nothing is switched on (Quick Play falls back to every year and actor)', async () => {
    const { db, available } = await fresh({ approve: false });
    await db.query(`UPDATE public.quick_match_pool SET enabled = false`);
    const p = await makePlayer(db, { publicName: 'Anyone Here' });
    assert.equal(await available(null), true);
    assert.equal(await available(p), true);
  });

  test('...and a plain no only when there are no years or actors to draw from at all', async () => {
    const { db, available } = await fresh({ approve: false });
    await db.query(`DELETE FROM public.quick_match_pool WHERE kind IN ('year', 'actor')`);
    const p = await makePlayer(db, { publicName: 'Anyone Here' });
    assert.equal(await available(null), false);
    assert.equal(await available(p), false);
  });

  test('switch off: false for everyone, including the admin; it never raises', async () => {
    const { db, available } = await fresh({ mode: 'off' });
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Boss' });
    assert.equal(await available(null), false);
    assert.equal(await available(admin), false);
  });

  test('"just me": only the signed-in admin gets yes; guests and other players get no', async () => {
    const { db, available } = await fresh({ mode: 'admin_only' });
    const admin = await makePlayer(db, { email: ADMIN_EMAIL, publicName: 'Robert Boss' });
    const other = await makePlayer(db, { publicName: 'Regular Rita' });
    assert.equal(await available(null), false, 'guest');
    assert.equal(await available(other), false, 'regular player');
    assert.equal(await available(admin), true, 'admin');
  });

  test('a suspended account gets no, and a lapsed suspension no longer counts', async () => {
    const { db, available } = await fresh();
    const p = await makePlayer(db, { publicName: 'Suspended Sam' });
    await db.query(`UPDATE public.profiles SET is_banned = true, banned_until = now() + interval '3 days' WHERE id = $1`, [p.id]);
    assert.equal(await available(p), false);
    await db.query(`UPDATE public.profiles SET banned_until = now() - interval '1 day' WHERE id = $1`, [p.id]);
    assert.equal(await available(p), true);
  });

  test('anyone may call it: guests included (it reveals only that yes/no)', async () => {
    const { db } = await fresh();
    for (const role of ['anon', 'authenticated']) {
      const r = (await db.query(`SELECT has_function_privilege('${role}', 'public.quick_match_available()', 'EXECUTE') AS can`)).rows[0];
      assert.equal(r.can, true, role);
    }
  });

  test('guests still cannot start or join anything', async () => {
    const { db } = await fresh();
    for (const fn of ['quick_start()', 'quick_join()', 'claim_public_name()', 'create_public_table(text, text, text, text[], integer, integer, boolean, timestamptz)', 'join_public_table(uuid)']) {
      const r = (await db.query(`SELECT has_function_privilege('anon', 'public.${fn}', 'EXECUTE') AS can`)).rows[0];
      assert.equal(r.can, false, `${fn} must stay closed to guests`);
    }
    await actAs(db, null);
    await assert.rejects(rpcJson(db, 'quick_start'), /Sign in/);
    await assert.rejects(rpcJson(db, 'quick_join'), /Sign in/);
  });
});
