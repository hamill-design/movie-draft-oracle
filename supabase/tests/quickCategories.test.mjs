import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

const YEAR_BAG = [
  'Drama/Romance', 'Action/Adventure', 'Academy Award Nominee or Winner', 'Blockbuster (minimum of $50 Mil)',
  'Comedy', 'Sci-Fi/Fantasy', 'Horror/Thriller',
];
const ANCHORS = ['Drama/Romance', 'Action/Adventure', 'Comedy'];
const ACTOR_FLEX = ['Academy Award Nominee or Winner', 'Blockbuster (minimum of $50 Mil)'];

async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const cats = async (kind) => (await db.query(`SELECT public._quick_categories($1) AS c`, [kind])).rows[0].c;
  /** Only this kind of entry can be drawn. */
  const only = async (kind) => {
    await db.query(`UPDATE public.quick_match_pool SET enabled = false`);
    await db.query(`UPDATE public.quick_match_pool SET enabled = true WHERE kind = $1`, [kind]);
  };
  const lobbyFor = async () => {
    const p = await makePlayer(db, { publicName: nm('Cat') });
    await actAs(db, p);
    const r = await rpcJson(db, 'quick_start');
    const info = await rpcJson(db, 'get_table_info', r.draft_id);
    const row = (await db.query(`SELECT categories FROM public.drafts WHERE id = $1`, [r.draft_id])).rows[0];
    return { id: r.draft_id, info, stored: row.categories };
  };
  return { db, cats, only, lobbyFor };
}

describe('Quick Play categories: years', () => {
  test('five categories: 4 of the 7 most-played, then Wild Card last, no repeats', async () => {
    const { cats } = await fresh();
    for (let i = 0; i < 40; i++) {
      const c = await cats('year');
      assert.equal(c.length, 5);
      assert.equal(c[4], 'Wild Card');
      assert.equal(new Set(c).size, 5, 'no repeats');
      assert.ok(c.slice(0, 4).every((x) => YEAR_BAG.includes(x)), `only the popular seven: ${c}`);
    }
  });

  test('the four keep the most-played-first order, and lobbies vary (every category turns up)', async () => {
    const { cats } = await fresh();
    const combos = new Set();
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const c = await cats('year');
      combos.add(c.join('|'));
      c.slice(0, 4).forEach((x) => seen.add(x));
      const idx = c.slice(0, 4).map((x) => YEAR_BAG.indexOf(x));
      assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `listed in popularity order: ${c}`);
    }
    assert.ok(combos.size >= 6, `lobbies differ (saw ${combos.size} different sets)`);
    assert.equal(seen.size, 7, 'all seven categories get used');
  });
});

describe('Quick Play categories: actors', () => {
  test('the three broad genres every career has, one of Academy Award / Blockbuster, then Wild Card', async () => {
    const { cats } = await fresh();
    const flexSeen = new Set();
    for (let i = 0; i < 60; i++) {
      const c = await cats('actor');
      assert.equal(c.length, 5);
      assert.deepEqual(c.slice(0, 3), ANCHORS);
      assert.ok(ACTOR_FLEX.includes(c[3]), `fourth is awards or box office: ${c[3]}`);
      assert.equal(c[4], 'Wild Card');
      flexSeen.add(c[3]);
    }
    assert.equal(flexSeen.size, 2, 'both flex categories get used');
  });
});

describe('Quick Play categories: other drafts', () => {
  test('a special draft (or anything unknown) gets no rule-based categories, so it keeps its own', async () => {
    const { cats } = await fresh();
    assert.equal(await cats('spec'), null);
    assert.equal(await cats('anything else'), null);
  });

  test('guests and players cannot call the picker directly', async () => {
    const { db } = await fresh();
    for (const role of ['anon', 'authenticated']) {
      const r = (await db.query(`SELECT has_function_privilege('${role}', 'public._quick_categories(text)', 'EXECUTE') AS c`)).rows[0];
      assert.equal(r.c, false, role);
    }
  });
});

describe('Quick Play categories: in the lobby', () => {
  test('a year lobby gets year-rule categories, stored on the draft and shown in the lobby view; lobbies differ', async () => {
    const { only, lobbyFor } = await fresh();
    await only('year');
    const sets = new Set();
    for (let i = 0; i < 14; i++) {
      const { info, stored } = await lobbyFor();
      assert.equal(info.theme, 'year');
      assert.deepEqual(info.categories, stored, 'the lobby view lists exactly what the draft will use');
      assert.equal(info.categories.length, 5);
      assert.equal(info.categories[4], 'Wild Card');
      sets.add(info.categories.join('|'));
    }
    assert.ok(sets.size >= 2, `not the same five every time (saw ${sets.size})`);
  });

  test('an actor lobby gets the actor rule: anchors plus awards or box office', async () => {
    const { only, lobbyFor } = await fresh();
    await only('actor');
    const flex = new Set();
    for (let i = 0; i < 14; i++) {
      const { info } = await lobbyFor();
      assert.equal(info.theme, 'people');
      assert.deepEqual(info.categories.slice(0, 3), ANCHORS);
      assert.equal(info.categories[4], 'Wild Card');
      flex.add(info.categories[3]);
    }
    assert.equal(flex.size, 2, 'both flex categories turn up across lobbies');
  });

  test('a special-draft lobby keeps the categories that draft has always had', async () => {
    const { db, only, lobbyFor } = await fresh();
    await only('spec');
    await db.query(`INSERT INTO public.quick_match_pool (kind, theme, option, label, categories, enabled)
                    VALUES ('spec', 'spec-draft', 'spec-1', 'Stop Motion', ARRAY['Claymation', 'Puppets', 'Cut-out'], true)`);
    const { info } = await lobbyFor();
    assert.equal(info.theme, 'spec-draft');
    assert.deepEqual(info.categories, ['Claymation', 'Puppets', 'Cut-out']);
  });
});
