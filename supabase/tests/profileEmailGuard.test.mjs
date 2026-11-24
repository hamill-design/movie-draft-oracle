// A player must not be able to rewrite the email on their own profile with a direct request.
// Migration under test: 20261124100000_protect_profile_email.sql
//
// Every check runs the way the live site does: `SET ROLE authenticated` (a signed-in player's direct request) or
// `service_role` (edge functions). Calls made as the all-powerful test user would not notice a trigger that blocks
// the wrong people.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, readMigration, uuid } from './helpers.mjs';

const FIX = '20261124100000_protect_profile_email.sql';

/** The in-memory profiles table answers direct requests like the live one: row security on, three own-row policies, every column writable. */
async function liveLikeProfileAccess(db) {
  await db.exec(`
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS marketing_emails_opt_in boolean NOT NULL DEFAULT false;
    ALTER ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT ALL ON public.profiles TO anon, authenticated, service_role;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  `);
}

async function freshDb({ withFix }) {
  const db = await newDb({ referee: false });
  await liveLikeProfileAccess(db);
  if (withFix) await db.exec(readMigration(FIX));
  // Test-the-tests hook: break the fix on purpose and these tests must fail.
  if (withFix && process.env.MUTATE_SQL_AFTER_FIX) await db.exec(process.env.MUTATE_SQL_AFTER_FIX);
  return db;
}

const asRole = async (db, role, fn) => {
  await db.exec(`SET ROLE ${role}`);
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
};
const direct = async (db, who, sql, params = [], role = 'authenticated') => {
  await actAs(db, who);
  return asRole(db, role, () => db.query(sql, params));
};
const profile = async (db, id) => (await db.query(`SELECT * FROM public.profiles WHERE id = $1`, [id])).rows[0];
const refused = (err) => {
  assert.equal(err.code, '42501', `expected a permission error, got: ${err.message}`);
  assert.match(err.message, /can only be changed by MovieDrafter/);
  return true;
};

describe('the hole, before the fix (proves these tests reproduce the live problem)', () => {
  test('a player can set their profile email to someone else\'s address with one direct request', async () => {
    const db = await freshDb({ withFix: false });
    const victim = await makePlayer(db, { email: 'victim@example.test' });
    const attacker = await makePlayer(db);
    await direct(db, attacker, `UPDATE public.profiles SET email = 'victim@example.test' WHERE id = $1`, [attacker.id]);
    assert.equal((await profile(db, attacker.id)).email, 'victim@example.test');
    assert.ok(victim.id);
  });
});

describe('after the fix', () => {
  let db;
  before(async () => { db = await freshDb({ withFix: true }); });

  test('a signed-in player cannot change the email on their own profile', async () => {
    const p = await makePlayer(db);
    const before = await profile(db, p.id);
    await assert.rejects(direct(db, p, `UPDATE public.profiles SET email = 'victim@example.test' WHERE id = $1`, [p.id]), refused);
    await assert.rejects(direct(db, p, `UPDATE public.profiles SET email = NULL WHERE id = $1`, [p.id]), refused);
    assert.deepEqual(await profile(db, p.id), before);
  });

  test('a signed-out visitor changes nothing', async () => {
    const p = await makePlayer(db);
    const before = await profile(db, p.id);
    await actAs(db, null);
    const res = await asRole(db, 'anon', () => db.query(`UPDATE public.profiles SET email = 'x@example.test' WHERE id = $1`, [p.id]).catch((e) => e));
    // Either refused, or no row visible to update: never changed.
    assert.deepEqual(await profile(db, p.id), before);
    assert.ok(res instanceof Error || res.affectedRows === 0 || res.rows !== undefined);
  });

  test('nobody can touch someone else\'s row either', async () => {
    const a = await makePlayer(db);
    const b = await makePlayer(db);
    const before = await profile(db, b.id);
    await direct(db, a, `UPDATE public.profiles SET email = 'hijack@example.test' WHERE id = $1`, [b.id]).catch(() => {});
    assert.deepEqual(await profile(db, b.id), before);
  });

  test('an upsert cannot be used as a back door', async () => {
    const p = await makePlayer(db);
    await assert.rejects(
      direct(db, p, `INSERT INTO public.profiles (id, email) VALUES ($1, 'victim@example.test')
                     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`, [p.id]),
      refused);
    assert.notEqual((await profile(db, p.id)).email, 'victim@example.test');
  });

  test('a new player can create their own profile row with their own sign-in email, but not someone else\'s', async () => {
    const id = uuid();
    const mail = `${id.slice(0, 8)}@example.test`;
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, mail]);
    const me = { id, email: mail };
    await assert.rejects(direct(db, me, `INSERT INTO public.profiles (id, email) VALUES ($1, 'someone.else@example.test')`, [id]), refused);
    await direct(db, me, `INSERT INTO public.profiles (id, email, name) VALUES ($1, $2, 'New Person')`, [id, mail]);
    assert.equal((await profile(db, id)).email, mail);
  });

  test('ordinary saves still work: name, photo, marketing preference, and re-saving the same email', async () => {
    const p = await makePlayer(db, { name: 'Before' });
    await direct(db, p, `UPDATE public.profiles SET name = 'After' WHERE id = $1`, [p.id]);
    await direct(db, p, `UPDATE public.profiles SET avatar_url = 'https://example.test/a.png' WHERE id = $1`, [p.id]);
    await direct(db, p, `UPDATE public.profiles SET marketing_emails_opt_in = true WHERE id = $1`, [p.id]);
    // a screen that writes back the whole row, email included, with the value it just read
    await direct(db, p, `UPDATE public.profiles SET name = 'Whole Row', email = $2 WHERE id = $1`, [p.id, p.email]);
    const row = await profile(db, p.id);
    assert.equal(row.name, 'Whole Row');
    assert.equal(row.avatar_url, 'https://example.test/a.png');
    assert.equal(row.marketing_emails_opt_in, true);
    assert.equal(row.email, p.email);
  });

  test('the sign-up function (runs as the database owner) and the service role can still write the email', async () => {
    const p = await makePlayer(db);
    // the database owner, like handle_new_user() and the dashboard
    await db.query(`UPDATE public.profiles SET email = 'owner.changed@example.test' WHERE id = $1`, [p.id]);
    assert.equal((await profile(db, p.id)).email, 'owner.changed@example.test');
    // the service role, like an edge function
    await asRole(db, 'service_role', () => db.query(`UPDATE public.profiles SET email = 'service.changed@example.test' WHERE id = $1`, [p.id]));
    assert.equal((await profile(db, p.id)).email, 'service.changed@example.test');
    // a SECURITY DEFINER function called by a player runs as the owner, so it passes too
    await db.exec(`
      CREATE OR REPLACE FUNCTION public._test_definer_set_email(p_id uuid, p_email text) RETURNS void
        LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE public.profiles SET email = p_email WHERE id = p_id $$;
      GRANT EXECUTE ON FUNCTION public._test_definer_set_email(uuid, text) TO authenticated;
    `);
    await direct(db, p, `SELECT public._test_definer_set_email($1, 'definer.changed@example.test')`, [p.id]);
    assert.equal((await profile(db, p.id)).email, 'definer.changed@example.test');
  });

  test('the trigger function cannot be called directly', async () => {
    const p = await makePlayer(db);
    await assert.rejects(direct(db, p, `SELECT public.protect_profile_email()`), /permission denied|trigger/i);
  });

  test('running the migration twice is harmless and leaves exactly one trigger', async () => {
    await db.exec(readMigration(FIX));
    const n = (await db.query(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'protect_profile_email'`
    )).rows[0].n;
    assert.equal(n, 1);
    const p = await makePlayer(db);
    await assert.rejects(direct(db, p, `UPDATE public.profiles SET email = 'again@example.test' WHERE id = $1`, [p.id]), refused);
  });
});
