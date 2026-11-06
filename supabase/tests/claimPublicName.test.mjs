import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, ADMIN_EMAIL } from './helpers.mjs';

const VALID = /^[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]$/;

async function fresh({ mode = 'on' } = {}) {
  const db = await newDb({ publicPlay: true });
  await setMode(db, mode);
  /** A person with a name in their settings (profiles.name) and no public name yet. */
  const person = (name, extra = {}) => makePlayer(db, { name, ...extra });
  const claim = async (who) => { await actAs(db, who); return rpcJson(db, 'claim_public_name'); };
  const row = async (who) => (await db.query(`SELECT public_name, public_name_changed_at FROM public.profiles WHERE id = $1`, [who.id])).rows[0];
  return { db, person, claim, row };
}

describe('claim_public_name: the settings name becomes the public name', () => {
  test('a plain name is used as it is, and shows up in the public status', async () => {
    const { db, person, claim, row } = await fresh();
    const p = await person('Film Fan');
    assert.deepEqual(await claim(p), { public_name: 'Film Fan', claimed: true });
    assert.equal((await row(p)).public_name, 'Film Fan');
    await actAs(db, p);
    const status = await rpcJson(db, 'public_play_status');
    assert.equal(status.has_public_name, true);
    assert.equal(status.public_name, 'Film Fan');
  });

  test('asking again changes nothing, even if the settings name has changed since', async () => {
    const { db, person, claim } = await fresh();
    const p = await person('First Name');
    assert.equal((await claim(p)).claimed, true);
    await db.query(`UPDATE public.profiles SET name = 'Totally Different' WHERE id = $1`, [p.id]);
    assert.deepEqual(await claim(p), { public_name: 'First Name', claimed: false });
  });

  test('never overwrites a name the player chose themselves', async () => {
    const { db, person, claim } = await fresh();
    const p = await person('Settings Name');
    await db.query(`UPDATE public.profiles SET public_name = 'Chosen Name' WHERE id = $1`, [p.id]);
    assert.deepEqual(await claim(p), { public_name: 'Chosen Name', claimed: false });
  });

  test('an apostrophe or other symbol is dropped: "Tim Allen\'s Nose" becomes "Tim Allens Nose"', async () => {
    const { person, claim } = await fresh();
    const r = await claim(await person("Tim Allen's Nose"));
    assert.equal(r.public_name, 'Tim Allens Nose');
  });

  test('accents are simplified rather than lost, and emoji are dropped', async () => {
    const { person, claim } = await fresh();
    assert.equal((await claim(await person('José Müller'))).public_name, 'Jose Muller');
    assert.equal((await claim(await person('Çelik Ñandú Ólafur'))).public_name, 'Celik Nandu Olafur');
    assert.equal((await claim(await person('Ângela Åström Ünal'))).public_name, 'Angela Astrom Unal');
    assert.equal((await claim(await person('Movie 🎬 Buff'))).public_name, 'Movie Buff');
    assert.equal((await claim(await person('Dr. Strangelove!'))).public_name, 'Dr. Strangelove');
  });

  test('stray spaces and symbols at the ends are tidied', async () => {
    const { person, claim } = await fresh();
    assert.equal((await claim(await person('   Spaced    Out   '))).public_name, 'Spaced Out');
    assert.equal((await claim(await person('--Dashed--'))).public_name, 'Dashed');
    assert.equal((await claim(await person('★★ Star Gazer ★★'))).public_name, 'Star Gazer');
  });

  test('a name over 20 characters is cut at a word where that keeps a sensible amount', async () => {
    const { person, claim } = await fresh();
    const r = await claim(await person('Bartholomew Montgomery Fitzgerald'));
    assert.ok(r.public_name.length <= 20);
    assert.equal(r.public_name, 'Bartholomew', 'cut at the last word that fits');
    assert.match(r.public_name, VALID);
  });

  test('a very long single word is cut hard at 20 characters; a long name with a short first word keeps more', async () => {
    const { person, claim } = await fresh();
    const a = await claim(await person('Supercalifragilisticexpialidocious'));
    assert.equal(a.public_name, 'Supercalifragilistic', 'exactly the first 20 characters');
    assert.equal(a.public_name.length, 20);
    const b = await claim(await person('Al Pacino Robert De Niro Jr Senior'));
    assert.ok(b.public_name.length <= 20);
    assert.match(b.public_name, VALID);
    assert.ok(b.public_name.startsWith('Al Pacino'));
  });

  test('if the name is taken, a number is added (and case does not matter)', async () => {
    const { person, claim } = await fresh();
    assert.equal((await claim(await person('Pat Jones'))).public_name, 'Pat Jones');
    assert.equal((await claim(await person('Pat Jones'))).public_name, 'Pat Jones 2');
    // Same name in capitals: "Pat Jones" and "Pat Jones 2" are both taken (case-insensitively), so it gets a 3.
    assert.equal((await claim(await person('PAT JONES'))).public_name, 'PAT JONES 3');
  });

  test('a long name that is taken still fits in 20 characters with its number', async () => {
    const { person, claim } = await fresh();
    const first = await claim(await person('Supercalifragilisticexpialidocious'));
    const second = await claim(await person('Supercalifragilisticexpialidocious'));
    assert.equal(first.public_name, 'Supercalifragilistic');
    assert.equal(second.public_name, 'Supercalifragilist 2', 'cut short to leave room for the number');
    assert.ok(second.public_name.length <= 20, second.public_name);
    assert.match(second.public_name, VALID);
    assert.notEqual(second.public_name.toLowerCase(), first.public_name.toLowerCase());
    assert.ok(second.public_name.endsWith(' 2'));
  });

  test('does not use up the once-a-day change: the player can pick another name straight away', async () => {
    const { db, person, claim, row } = await fresh();
    const p = await person('Auto Named');
    await claim(p);
    assert.equal((await row(p)).public_name_changed_at, null);
    await actAs(db, p);
    const r = await rpcJson(db, 'set_public_name', 'Hand Picked');
    assert.equal(r.public_name, 'Hand Picked');
  });

  test('the claimed name is enough to host and join straight away', async () => {
    const { db, person, claim } = await fresh();
    const host = await person('Host Hannah');
    await claim(host);
    await actAs(db, host);
    const t = await rpcJson(db, 'create_public_table', 'Draft by 1999', 'year', '1999', ['Comedy', 'Drama/Romance'], 4, 60, true, null);
    const guest = await person('Guest Gary');
    await claim(guest);
    await actAs(db, guest);
    const j = await rpcJson(db, 'join_public_table', t.draft_id);
    assert.equal(j.already_joined, false);
    const names = (await db.query(`SELECT participant_name FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at`, [t.draft_id])).rows.map((r) => r.participant_name);
    assert.deepEqual(names, ['Host Hannah', 'Guest Gary']);
  });
});

describe('claim_public_name: when it must not use the settings name', () => {
  test('no name in settings: asks the player to choose, and never falls back to the email', async () => {
    const { db, person, claim, row } = await fresh();
    const p = await person(null, { email: 'robert.hamill@example.test' });
    const r = await claim(p);
    assert.equal(r.public_name, null);
    assert.match(r.reason, /haven't set a name/);
    assert.equal((await row(p)).public_name, null);
    assert.ok(!JSON.stringify(r).includes('robert'), 'the email is not echoed back');
    void db;
  });

  test('too short, or nothing usable once cleaned up, asks the player to choose', async () => {
    const { person, claim } = await fresh();
    assert.equal((await claim(await person('Al'))).public_name, null);
    const emoji = await claim(await person('🎬🎬🎬🎬'));
    assert.equal(emoji.public_name, null);
    assert.match(emoji.reason, /Choose the name/);
    assert.equal((await claim(await person('  '))).public_name, null);
  });

  test('a settings name that looks like an email address or link is never made public', async () => {
    const { person, claim, row } = await fresh();
    for (const bad of ['robert@example.com', 'robertexample.com', 'visit https://spam.test', 'me@home']) {
      const p = await person(bad);
      const r = await claim(p);
      assert.equal(r.public_name, null, bad);
      assert.match(r.reason, /Choose the name/);
      assert.equal((await row(p)).public_name, null);
    }
  });

  test('a name that is the start of the player\'s own email address is refused', async () => {
    const { person, claim } = await fresh();
    const p = await person('robert.hamill', { email: 'robert.hamill@example.test' });
    const r = await claim(p);
    assert.equal(r.public_name, null);
    assert.match(r.reason, /not your email address/i);
  });

  test('the word filter applies, including look-alike spellings; the offending name is not echoed back', async () => {
    const { person, claim } = await fresh();
    for (const bad of ['Hitler Fan', 'N4zi Boy', 'Admin Rob', 'Moderator Mike', 'Big D1ck']) {
      const r = await claim(await person(bad));
      assert.equal(r.public_name, null, bad);
      assert.match(r.reason, /not allowed/i, bad);
      assert.ok(!r.reason.toLowerCase().includes(bad.toLowerCase().split(' ')[0]), `reason must not repeat "${bad}"`);
    }
  });

  test('a harmless name that merely contains a short blocked word is fine ("Classic" has "ass" inside)', async () => {
    const { person, claim } = await fresh();
    assert.equal((await claim(await person('Classic Cinema'))).public_name, 'Classic Cinema');
  });
});

describe('claim_public_name: who may call it', () => {
  test('refused while public play is off, or "just me" for anyone but the admin', async () => {
    const { db, person, claim } = await fresh({ mode: 'off' });
    const p = await person('Waiting Wanda');
    await assert.rejects(claim(p), /not open yet/);
    await setMode(db, 'admin_only');
    await assert.rejects(claim(p), /not open yet/);
    const admin = await makePlayer(db, { name: 'Robert Boss', email: ADMIN_EMAIL });
    assert.equal((await claim(admin)).public_name, 'Robert Boss');
    const stillNone = (await db.query(`SELECT public_name FROM public.profiles WHERE id = $1`, [p.id])).rows[0];
    assert.equal(stillNone.public_name, null, 'nothing was written for the player who was refused');
  });

  test('refused for a suspended account', async () => {
    const { db, person, claim } = await fresh();
    const p = await person('Banned Barry');
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [p.id]);
    await assert.rejects(claim(p), /suspended/);
  });

  test('signed-out visitors cannot call it', async () => {
    const { db } = await fresh();
    await actAs(db, null);
    await assert.rejects(rpcJson(db, 'claim_public_name'), /Sign in/);
    const anon = (await db.query(`SELECT has_function_privilege('anon', 'public.claim_public_name()', 'EXECUTE') AS can`)).rows[0];
    const auth = (await db.query(`SELECT has_function_privilege('authenticated', 'public.claim_public_name()', 'EXECUTE') AS can`)).rows[0];
    assert.equal(anon.can, false);
    assert.equal(auth.can, true);
  });

  test('it only ever touches the caller\'s own profile', async () => {
    const { db, person, claim } = await fresh();
    const a = await person('Alice Anders');
    const b = await person('Bob Barker');
    await claim(a);
    const rows = (await db.query(`SELECT name, public_name FROM public.profiles WHERE id = ANY($1) ORDER BY name`, [[a.id, b.id]])).rows;
    assert.deepEqual(rows.map((r) => r.public_name), ['Alice Anders', null]);
  });
});
