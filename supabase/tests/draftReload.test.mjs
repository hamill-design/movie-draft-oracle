// Tests for src/utils/draftReload.ts: the helpers that let a draft reload land as one update.
// Pure logic, no network and no database. Node strips the TypeScript types on import.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sameDeep, sameFields, keepIfSame, keepIfCovers, createParticipantEnricher,
} from '../../src/utils/draftReload.ts';

describe('sameDeep (exact match)', () => {
  test('equal data matches, whatever the object identity', () => {
    assert.ok(sameDeep({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 }));
    assert.ok(sameDeep([], []));
    assert.ok(sameDeep(null, null));
  });
  test('any difference is noticed: value, extra key, missing key, array length or order', () => {
    assert.ok(!sameDeep({ a: 1 }, { a: 2 }));
    assert.ok(!sameDeep({ a: 1 }, { a: 1, b: 2 }));
    assert.ok(!sameDeep({ a: 1, b: 2 }, { a: 1 }));
    assert.ok(!sameDeep([1, 2], [1, 2, 3]));
    assert.ok(!sameDeep([1, 2], [2, 1]));
    assert.ok(!sameDeep([1], { 0: 1 }));
  });
});

describe('sameFields (the old value may carry extras)', () => {
  test('matches when everything in the new value is already there, ignoring extra fields in the old one', () => {
    assert.ok(sameFields({ id: 1, turn: 'a', extra: 'x' }, { id: 1, turn: 'a' }));
  });
  test('a changed or missing field is a difference', () => {
    assert.ok(!sameFields({ id: 1, turn: 'a' }, { id: 1, turn: 'b' }));
    assert.ok(!sameFields({ id: 1 }, { id: 1, turn: 'a' }));
    assert.ok(!sameFields({ turn_order: [1, 2] }, { turn_order: [1, 2, 3] }));
  });
});

describe('keepIfSame / keepIfCovers return the OLD object when nothing changed', () => {
  test('so nothing downstream re-renders or re-runs', () => {
    const prev = [{ id: 1 }, { id: 2 }];
    assert.equal(keepIfSame(prev, [{ id: 1 }, { id: 2 }]), prev);
    const changed = [{ id: 1 }, { id: 3 }];
    assert.equal(keepIfSame(prev, changed), changed);
    const draft = { id: 'd', pick: 3, extra: true };
    assert.equal(keepIfCovers(draft, { id: 'd', pick: 3 }), draft);
    const next = { id: 'd', pick: 4 };
    assert.equal(keepIfCovers(draft, next), next);
  });
});

/** A fake database: counts every lookup so the tests can see when the network would be touched. */
function fixture({ isPublic = false, failProfiles = false } = {}) {
  const calls = { isPublic: 0, profiles: [], withEmail: [] };
  const state = { failProfiles };
  const people = {
    u1: { id: 'u1', email: 'one@example.test', avatar_url: 'one.png' },
    u2: { id: 'u2', email: 'two@example.test', avatar_url: null },
    u3: { id: 'u3', email: 'three@example.test', avatar_url: 'three.png' },
  };
  const enrich = createParticipantEnricher({
    isPublicTable: async () => { calls.isPublic += 1; return isPublic; },
    fetchProfiles: async (ids, withEmail) => {
      calls.profiles.push([...ids]);
      calls.withEmail.push(withEmail);
      if (state.failProfiles) return null;
      return ids.filter((id) => people[id]).map((id) => ({
        id, email: withEmail ? people[id].email : undefined, avatar_url: people[id].avatar_url,
      }));
    },
  });
  return { enrich, calls, state };
}

const row = (user_id, extra = {}) => ({ user_id, draft_id: 'draft-1', participant_name: user_id ?? 'bot', ...extra });

describe('adding emails and avatars to the people in a draft', () => {
  test('the first load looks people up once; every later reload makes no network calls at all', async () => {
    const { enrich, calls } = fixture();
    const people = [row('u1'), row('u2'), row(null, { is_ai: true })];
    const first = await enrich(people);
    assert.equal(calls.profiles.length, 1);
    assert.deepEqual(calls.profiles[0].sort(), ['u1', 'u2']);
    assert.equal(first[0].email, 'one@example.test');
    assert.equal(first[0].avatar_url, 'one.png');
    assert.equal(first[1].avatar_url, null);

    for (let i = 0; i < 5; i++) await enrich(people);
    assert.equal(calls.profiles.length, 1, 'five more reloads, still one lookup');
    assert.equal(calls.isPublic, 1, 'and the public-table question is asked once too');
  });

  test('a person who joins later is the only one looked up', async () => {
    const { enrich, calls } = fixture();
    await enrich([row('u1'), row('u2')]);
    const later = await enrich([row('u1'), row('u2'), row('u3')]);
    assert.equal(calls.profiles.length, 2);
    assert.deepEqual(calls.profiles[1], ['u3']);
    assert.equal(later[2].email, 'three@example.test');
    assert.equal(later[0].email, 'one@example.test');
  });

  test('the result keeps the rows in order and keeps every other field', async () => {
    const { enrich } = fixture();
    const out = await enrich([row('u2', { is_host: true }), row(null, { is_ai: true }), row('u1')]);
    assert.deepEqual(out.map((p) => p.participant_name), ['u2', 'bot', 'u1']);
    assert.equal(out[0].is_host, true);
    assert.equal(out[1].email, null);
    assert.equal(out[1].avatar_url, null);
  });

  test('a public table never loads emails (avatars only), and never shows one', async () => {
    const { enrich, calls } = fixture({ isPublic: true });
    const out = await enrich([row('u1'), row('u2')]);
    assert.deepEqual(calls.withEmail, [false]);
    assert.equal(out[0].email, null);
    assert.equal(out[0].avatar_url, 'one.png');
  });

  test('different drafts do not share what they know', async () => {
    const { enrich, calls } = fixture();
    await enrich([row('u1')]);
    await enrich([{ user_id: 'u1', draft_id: 'draft-2', participant_name: 'x' }]);
    assert.equal(calls.profiles.length, 2);
  });

  test('a draft with nobody signed in needs no lookup and comes back as it was', async () => {
    const { enrich, calls } = fixture();
    const guests = [row(null, { is_ai: true }), row(null)];
    assert.equal(await enrich(guests), guests);
    assert.equal(calls.profiles.length, 0);
    assert.equal(calls.isPublic, 0);
  });

  test('the same person twice is looked up once', async () => {
    const { enrich, calls } = fixture();
    await enrich([row('u1'), row('u1')]);
    assert.deepEqual(calls.profiles, [['u1']]);
  });

  test('a lookup that fails shows the rows as they are and is tried again next reload', async () => {
    const { enrich, calls, state } = fixture({ failProfiles: true });
    const people = [row('u1')];
    assert.equal(await enrich(people), people, 'nothing to add yet: the rows come back unchanged');
    state.failProfiles = false;
    const out = await enrich(people);
    assert.equal(calls.profiles.length, 2, 'it asked again');
    assert.equal(out[0].email, 'one@example.test');
  });

  test('if a later lookup fails, what we already know is still shown', async () => {
    const { enrich, state } = fixture();
    await enrich([row('u1')]);
    state.failProfiles = true;
    const out = await enrich([row('u1'), row('u3')]);
    assert.equal(out[0].email, 'one@example.test');
    assert.equal(out[1].email, null);
  });

  test('someone with no profile row is remembered as having none (not looked up on every reload)', async () => {
    const { enrich, calls } = fixture();
    await enrich([row('ghost')]);
    await enrich([row('ghost')]);
    assert.equal(calls.profiles.length, 1);
  });
});
