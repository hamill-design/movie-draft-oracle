// The list the minute job uses to score picks while a draft is still going.
// Migration under test: 20261124130000_score_picks_as_they_are_made.sql

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makeDraft, startDraft, humanPick, getPicks, actAs, readMigration } from './helpers.mjs';

describe('referee_list_unscored_picks (what the minute job scores next)', () => {
  let db;
  before(async () => { db = await newDb({ publicPlay: true }); });

  const list = async (limit = 12) =>
    (await db.query(`SELECT * FROM public.referee_list_unscored_picks($1)`, [limit])).rows;
  const twoPickDraft = async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }], categories: ['Comedy', 'Drama/Romance'] });
    await startDraft(db, d);
    await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy');
    await humanPick(db, d, d.turnOrder[1].participant_name, 'Comedy');
    return d;
  };

  test('lists the films picked recently that still have no score, one row per film', async () => {
    const d = await twoPickDraft();
    const picks = await getPicks(db, d.draftId);
    const rows = await list();
    for (const p of picks) {
      const row = rows.find((r) => r.movie_id === p.movie_id);
      assert.ok(row, `${p.movie_title} is listed`);
      assert.equal(row.movie_title, p.movie_title);
    }
    assert.equal(new Set(rows.map((r) => r.movie_id)).size, rows.length, 'one row per film');
  });

  test('a film picked in two drafts is listed once, and a scored film is not listed', async () => {
    const d = await twoPickDraft();
    const [first, second] = await getPicks(db, d.draftId);
    await db.query(`UPDATE public.draft_picks SET calculated_score = 77 WHERE draft_id = $1 AND movie_id = $2`, [d.draftId, first.movie_id]);
    const rows = await list(50);
    assert.ok(!rows.some((r) => r.movie_id === first.movie_id), 'scored: not listed');
    assert.equal(rows.filter((r) => r.movie_id === second.movie_id).length, 1);
  });

  test('picks older than 6 hours are not retried every minute', async () => {
    const d = await twoPickDraft();
    const picks = await getPicks(db, d.draftId);
    await db.query(`UPDATE public.draft_picks SET created_at = now() - interval '7 hours' WHERE draft_id = $1`, [d.draftId]);
    const rows = await list(50);
    for (const p of picks) assert.ok(!rows.some((r) => r.movie_id === p.movie_id && r.movie_title === p.movie_title), `${p.movie_title} is too old`);
  });

  test('newest first, and the limit is respected (and capped at 50)', async () => {
    await twoPickDraft();
    const some = await list(1);
    assert.equal(some.length, 1);
    const all = await list(500);
    assert.ok(all.length <= 50);
  });

  test('only the scheduled job (service role) may call it: players and visitors may not', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Cy' }, { name: 'Di' }] });
    await actAs(db, { id: d.players[0].userId, email: 'cy@example.test' });
    for (const role of ['authenticated', 'anon']) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await assert.rejects(db.query(`SELECT * FROM public.referee_list_unscored_picks(5)`), /permission denied/, role);
      } finally {
        await db.exec('RESET ROLE');
      }
    }
    await db.exec('SET ROLE service_role');
    try {
      await db.query(`SELECT * FROM public.referee_list_unscored_picks(5)`); // does not throw
    } finally {
      await db.exec('RESET ROLE');
    }
  });

  test('running the migration again is harmless', async () => {
    await db.exec(readMigration('20261124130000_score_picks_as_they_are_made.sql'));
    await list();
  });
});
