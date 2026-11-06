import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpc, rpcJson, uuid } from './helpers.mjs';
import { gameKit } from './gameKit.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

describe('ranked results, points and the leaderboard', () => {
  let db;
  before(async () => {
    db = await newDb({ publicPlay: true });
    await setMode(db, 'on');
  });

  const mk = (b, extra = {}) => makePlayer(db, { publicName: nm(b), ...extra });
  const nameOf = async (p) => (await db.query(`SELECT public_name FROM public.profiles WHERE id = $1`, [p.id])).rows[0].public_name;
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const results = async (id) =>
    (await db.query(
      `SELECT r.*, p.public_name FROM public.draft_results r JOIN public.profiles p ON p.id = r.user_id WHERE r.draft_id = $1 ORDER BY r.final_rank NULLS LAST, r.raw_score DESC`, [id])).rows;
  const finalize = (id) => rpcJson(db, 'finalize_draft_results', id);
  const notes = async (uid) => (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND type = 'results_ready'`, [uid])).rows;

  const { playGame } = (() => {
    // db is created in `before`, so the kit is built lazily on first use.
    let kit;
    return { playGame: (...args) => (kit ??= gameKit(db)).playGame(...args) };
  })();

  describe('when a finished game becomes eligible for results', () => {
    test('a rated game with 2+ real players waits for scores; casual and solo games never do', async () => {
      const [a, b] = [await mk('Pend A'), await mk('Pend B')];
      const rated = await playGame([a, b], { score: false });
      assert.equal((await draft(rated.id)).results_status, 'pending');
      assert.ok((await draft(rated.id)).results_pending_since);

      const casual = await playGame([await mk('Casual A'), await mk('Casual B')], { rated: false, score: false });
      assert.equal((await draft(casual.id)).results_status, null);

      const solo = await playGame([await mk('Solo A')], { bots: 3, score: false });
      assert.equal((await draft(solo.id)).rated, false);
      assert.equal((await draft(solo.id)).results_status, null);
    });
  });

  describe('ranking and points', () => {
    test('1st 10, 2nd 7, 3rd 5; bots are never ranked, however well they score', async () => {
      const [a, b, c] = [await mk('Rank A'), await mk('Rank B'), await mk('Rank C')];
      const g = await playGame([a, b, c], { bots: 1, perPick: [15, 10, 5], botScore: 100 });
      assert.equal((await finalize(g.id)).status, 'final');
      const rows = await results(g.id);
      assert.equal(rows.length, 3, 'no row for the bot');
      assert.deepEqual(rows.map((r) => [r.public_name, r.final_rank, Number(r.points)]), [
        [g.names[0], 1, 10], [g.names[1], 2, 7], [g.names[2], 3, 5],
      ]);
      assert.deepEqual(rows.map((r) => Number(r.raw_score)), [30, 20, 10]);
      assert.equal((await draft(g.id)).results_status, 'final');
    });

    test('a tie shares the place and the points; the next place is skipped', async () => {
      const [a, b, c] = [await mk('Tie A'), await mk('Tie B'), await mk('Tie C')];
      const g = await playGame([a, b, c], { perPick: [10, 10, 5] });
      await finalize(g.id);
      const rows = await results(g.id);
      assert.deepEqual(rows.map((r) => [r.final_rank, Number(r.points)]), [[1, 10], [1, 10], [3, 5]]);
    });

    test('finalizing twice does nothing the second time', async () => {
      const g = await playGame([await mk('Twice A'), await mk('Twice B')], { perPick: [20, 10] });
      assert.equal((await finalize(g.id)).status, 'final');
      assert.equal((await finalize(g.id)).status, 'already_final');
      assert.equal((await results(g.id)).length, 2);
    });
  });

  describe('waiting for scores', () => {
    test('with a score missing it waits; after 48 hours it is voided instead of ranking unfairly', async () => {
      const g = await playGame([await mk('Wait A'), await mk('Wait B')], { perPick: [20, 10] });
      await db.query(`UPDATE public.draft_picks SET calculated_score = NULL WHERE id = (SELECT id FROM public.draft_picks WHERE draft_id = $1 LIMIT 1)`, [g.id]);
      assert.equal((await finalize(g.id)).status, 'waiting');
      assert.equal((await draft(g.id)).results_status, 'pending');

      const pending = await rpc(db, 'referee_pending_scores', g.id);
      assert.equal(pending.length, 1);

      await db.query(`UPDATE public.drafts SET results_pending_since = now() - interval '49 hours' WHERE id = $1`, [g.id]);
      const out = await finalize(g.id);
      assert.equal(out.status, 'void');
      assert.equal((await results(g.id)).length, 0);
    });

    test('the server finds drafts that are waiting', async () => {
      const g = await playGame([await mk('Find A'), await mk('Find B')], { score: false });
      const ids = (await rpc(db, 'referee_list_unscored_drafts', 20)).map((r) => r.draft_id);
      assert.ok(ids.includes(g.id));
    });
  });

  describe('the idle-account guard', () => {
    test('someone who made under half their own picks is left out of the ranking, and cannot take a place', async () => {
      const [a, b, c] = [await mk('Idle A'), await mk('Idle B'), await mk('Idle C')];
      // B lets the referee make every pick and (auto-picks being strong) "scores" the best.
      const g = await playGame([a, b, c], { perPick: [10, 99, 20], manual: [Infinity, 0, Infinity] });
      await finalize(g.id);
      const rows = await results(g.id);
      const byName = Object.fromEntries(rows.map((r) => [r.public_name, r]));
      assert.equal(byName[g.names[2]].final_rank, 1, 'C wins among the people who actually played');
      assert.equal(byName[g.names[0]].final_rank, 2);
      const idle = byName[g.names[1]];
      assert.equal(idle.eligible, false);
      assert.equal(idle.final_rank, null);
      assert.equal(Number(idle.points), 0);
      assert.equal(idle.own_picks, 0);
    });

    test('exactly half is enough', async () => {
      const [a, b] = [await mk('Half A'), await mk('Half B')];
      const g = await playGame([a, b], { perPick: [10, 20], manual: [Infinity, 1] }); // B: 1 of 2 picks by hand
      await finalize(g.id);
      const b2 = (await results(g.id)).find((r) => r.public_name === g.names[1]);
      assert.equal(b2.eligible, true);
      assert.equal(b2.final_rank, 1);
    });

    test('fewer than 2 qualifying players: nobody gets points', async () => {
      const [a, b] = [await mk('Void A'), await mk('Void B')];
      const g = await playGame([a, b], { perPick: [10, 20], manual: [Infinity, 0] });
      const out = await finalize(g.id);
      assert.equal(out.status, 'void');
      assert.equal((await draft(g.id)).results_status, 'void');
      assert.ok((await results(g.id)).every((r) => Number(r.points) === 0 && r.final_rank === null));
      const note = (await notes(a.id))[0];
      assert.match(note.body, /No points/);
    });

    test('three games in a week without playing your own picks earns a 1-day break', async () => {
      const idle = await mk('Cooldown Idle');
      for (let i = 0; i < 3; i++) {
        const g = await playGame([await mk('Cd A'), await mk('Cd B'), idle], { perPick: [10, 20, 99], manual: [Infinity, Infinity, 0] });
        await finalize(g.id);
        const cd = (await db.query(`SELECT public_play_cooldown_until AS c FROM public.profiles WHERE id = $1`, [idle.id])).rows[0].c;
        if (i < 2) assert.equal(cd, null, `no break after game ${i + 1}`);
        else assert.ok(cd && new Date(cd) > new Date(), 'a break after the third');
      }
      await actAs(db, idle);
      await assert.rejects(rpc(db, 'list_public_tables').then(() => rpcJson(db, 'join_public_table', uuid())), /short break|Table not found/);
      await assert.rejects(rpcJson(db, 'create_public_table', 'x', 'year', '1999', ['Comedy'], 4, 60, true, null), /short break/);
    });
  });

  describe('the win-farming guard', () => {
    test('playing the same opponent again and again shrinks the points; old games stop counting after 7 days', async () => {
      const [a, b] = [await mk('Farm A'), await mk('Farm B')];
      const mults = [];
      const ids = [];
      for (let i = 0; i < 7; i++) {
        const g = await playGame([a, b], { perPick: [20, 10] });
        await finalize(g.id);
        const winner = (await results(g.id)).find((r) => r.final_rank === 1);
        mults.push(Number(winner.multiplier));
        ids.push(g.id);
      }
      assert.deepEqual(mults, [1, 1, 1, 0.5, 0.5, 0.5, 0.25]);
      const last = (await results(ids[6])).map((r) => Number(r.points));
      assert.deepEqual(last, [2.5, 1.75], '10 x 0.25 and 7 x 0.25');

      // A week later it's fresh again.
      await db.query(`UPDATE public.drafts SET results_finalized_at = now() - interval '8 days' WHERE id = ANY($1)`, [ids]);
      const fresh = await playGame([a, b], { perPick: [20, 10] });
      await finalize(fresh.id);
      assert.equal(Number((await results(fresh.id))[0].multiplier), 1);
    });

    test('it is per opponent: a newcomer at the table is not penalised for the others\' history', async () => {
      const [a, b, c] = [await mk('Per A'), await mk('Per B'), await mk('Per C')];
      for (let i = 0; i < 4; i++) { const g = await playGame([a, b], { perPick: [20, 10] }); await finalize(g.id); }
      const g = await playGame([c, a, b], { perPick: [30, 20, 10] }); // C beats A who has history with B
      await finalize(g.id);
      const byName = Object.fromEntries((await results(g.id)).map((r) => [r.public_name, r]));
      assert.equal(Number(byName[g.names[0]].multiplier), 1, 'C has played neither before');
      assert.equal(Number(byName[g.names[1]].multiplier), 0.5, 'A has played B 4 times this week');
    });
  });

  describe('notifications and reading results', () => {
    test('every real player is told once, and the winner hears their points', async () => {
      const [a, b] = [await mk('Note A'), await mk('Note B')];
      const g = await playGame([a, b], { perPick: [20, 10] });
      await finalize(g.id);
      assert.equal((await notes(a.id)).length, 1);
      assert.equal((await notes(b.id)).length, 1);
      assert.match((await notes(a.id))[0].body, /You earned 10 points/);
      assert.match((await notes(b.id))[0].body, /You earned 7 points/);
      assert.equal((await notes(a.id))[0].link, `/final-scores/${g.id}`);
    });

    test('get_draft_results shows public names and who is me; pending has no rows yet', async () => {
      const [a, b] = [await mk('Read A', { email: 'read.a@example.test', name: 'Real Reader' }), await mk('Read B')];
      const g = await playGame([a, b], { perPick: [20, 10], score: false });
      await actAs(db, a);
      const pending = await rpcJson(db, 'get_draft_results', g.id);
      assert.equal(pending.status, 'pending');
      assert.deepEqual(pending.rows, []);

      const picks = (await db.query(`SELECT id FROM public.draft_picks WHERE draft_id = $1`, [g.id])).rows;
      for (const p of picks) await db.query(`UPDATE public.draft_picks SET calculated_score = 5 WHERE id = $1`, [p.id]);
      await finalize(g.id);
      const done = await rpcJson(db, 'get_draft_results', g.id);
      assert.equal(done.status, 'final');
      assert.equal(done.rows.length, 2);
      assert.equal(done.rows.filter((r) => r.is_me).length, 1);
      const json = JSON.stringify(done);
      assert.ok(!json.includes('@') && !json.includes('Real Reader'));
    });

    test('it refuses private drafts', async () => {
      const a = await mk('Priv A');
      const { rows: [priv] } = await db.query(`INSERT INTO public.drafts (user_id, title, categories, is_multiplayer) VALUES ($1, 'Friends', ARRAY['Comedy'], true) RETURNING id`, [a.id]);
      await actAs(db, a);
      await assert.rejects(rpcJson(db, 'get_draft_results', priv.id), /Results not found/);
    });
  });

});
