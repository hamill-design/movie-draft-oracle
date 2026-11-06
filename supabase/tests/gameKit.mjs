// Plays complete rated games through the real flow, for the results/leaderboard tests:
// create a public table, join, start, make every pick (people by hand, bots and idle players via the
// referee), then (optionally) score the picks. Works on whichever database it is given.

import assert from 'node:assert/strict';
import { actAs, rpcJson, expireClock, refereeResolve, nextMovie } from './helpers.mjs';

export function gameKit(db) {
  let counter = 0;
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const results = async (id) =>
    (await db.query(
      `SELECT r.*, p.public_name FROM public.draft_results r JOIN public.profiles p ON p.id = r.user_id
       WHERE r.draft_id = $1 ORDER BY r.final_rank NULLS LAST, r.raw_score DESC`, [id])).rows;
  const finalize = (id) => rpcJson(db, 'finalize_draft_results', id);
  const nameOf = async (p) => (await db.query(`SELECT public_name FROM public.profiles WHERE id = $1`, [p.id])).rows[0].public_name;

  /**
   * perPick[i]: the score each of person i's picks is given afterwards (default 10).
   * manual[i]:  how many picks person i makes themselves (default all); the rest are auto-picks.
   * bots:       extra bot seats (they always play through the referee).
   */
  async function playGame(people, { bots = 0, categories = ['Comedy', 'Drama/Romance'], perPick = [], manual = [], rated = true, botScore = 50, score = true } = {}) {
    const host = people[0];
    await actAs(db, host);
    const size = Math.min(people.length + bots, 6);
    const { draft_id: id } = await rpcJson(db, 'create_public_table', `Ranked test ${++counter}`, 'year', '1999', categories, size, 3600, rated, null);
    for (const p of people.slice(1)) {
      await actAs(db, p);
      await rpcJson(db, 'join_public_table', id);
    }
    await actAs(db, host);
    await rpcJson(db, 'start_public_table', id, bots > 0);

    const names = await Promise.all(people.map(nameOf));
    const left = people.map((_, i) => manual[i] ?? Infinity);
    const filled = {};
    const d = await draft(id);
    for (let i = 0; i < d.turn_order.length; i++) {
      const turn = d.turn_order[i];
      const idx = names.indexOf(turn.participant_name);
      if (idx >= 0 && left[idx] > 0) {
        left[idx] -= 1;
        const done = (filled[idx] ??= []);
        const category = categories.find((c) => !done.includes(c));
        done.push(category);
        const m = nextMovie();
        await actAs(db, people[idx]);
        const res = (await db.query(
          `SELECT * FROM public.make_multiplayer_pick_unified($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [id, people[idx].id, m.id, m.title, m.year, m.genre, category])).rows[0];
        assert.equal(res.success, true, res.message);
      } else {
        await expireClock(db, id);
        const { applied } = await refereeResolve(db, { draftId: id });
        assert.equal(applied.applied, true);
      }
    }
    assert.equal((await draft(id)).is_complete, true);

    if (score) {
      const picks = (await db.query(`SELECT id, player_name FROM public.draft_picks WHERE draft_id = $1`, [id])).rows;
      for (const pk of picks) {
        const idx = names.indexOf(pk.player_name);
        const value = idx >= 0 ? (perPick[idx] ?? 10) : botScore;
        await db.query(`UPDATE public.draft_picks SET calculated_score = $1 WHERE id = $2`, [value, pk.id]);
      }
    }
    return { id, names };
  }

  return { playGame, draft, results, finalize, nameOf };
}
