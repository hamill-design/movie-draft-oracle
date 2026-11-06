import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpc, rpcJson, uuid } from './helpers.mjs';
import { gameKit } from './gameKit.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

describe('leaderboard, standings and player cards', () => {
  let db, kit, mk;
  beforeEach(async () => {
    db = await newDb({ publicPlay: true });
    await setMode(db, 'on');
    kit = gameKit(db);
    mk = (b, extra = {}) => makePlayer(db, { publicName: nm(b), ...extra });
  });

  /** A, B, C play twice: A wins game 1, B wins game 2. */
  async function threeWayRivalry() {
    const [a, b, c] = [await mk('Lead A'), await mk('Lead B'), await mk('Lead C')];
    const g1 = await kit.playGame([a, b, c], { perPick: [30, 20, 10] }); await kit.finalize(g1.id); // A10 B7 C5
    const g2 = await kit.playGame([b, c, a], { perPick: [30, 20, 10] }); await kit.finalize(g2.id); // B10 C7 A5
    return { a, b, c, g1, g2 };
  }

  describe('the leaderboard', () => {
    test('totals points across games, with wins and games played, best first', async () => {
      const { a, b, c } = await threeWayRivalry();
      await actAs(db, a);
      const board = await rpc(db, 'get_leaderboard', 'quarter', 50);
      assert.equal(board.length, 3);
      // B: 7 + 10 = 17, A: 10 + 5 = 15, C: 5 + 7 = 12. A and B each won one game.
      assert.deepEqual(board.map((r) => [r.user_id, Number(r.rank), Number(r.points), Number(r.rated_games), Number(r.wins)]), [
        [b.id, 1, 17, 2, 1], [a.id, 2, 15, 2, 1], [c.id, 3, 12, 2, 0],
      ]);
    });

    test('players on the same points share a rank, and the next rank is skipped', async () => {
      const [a, b] = [await mk('Even A'), await mk('Even B')];
      const g1 = await kit.playGame([a, b], { perPick: [20, 10] }); await kit.finalize(g1.id); // A10 B7
      const g2 = await kit.playGame([b, a], { perPick: [20, 10] }); await kit.finalize(g2.id); // B10 A7  -> 17 each
      const c = await mk('Even C');
      const g3 = await kit.playGame([c, await mk('Even D')], { perPick: [20, 10] }); await kit.finalize(g3.id); // C10 D7
      await actAs(db, a);
      const board = await rpc(db, 'get_leaderboard', 'all', 50);
      assert.deepEqual(board.map((r) => [Number(r.rank), Number(r.points)]), [[1, 17], [1, 17], [3, 10], [4, 7]]);
    });

    test('shows public names and avatars only, never an email', async () => {
      await threeWayRivalry();
      const [x] = [await mk('Viewer X', { email: 'viewer.x@example.test', name: 'Real Viewer' })];
      await actAs(db, x);
      const json = JSON.stringify(await rpc(db, 'get_leaderboard', 'all', 50));
      assert.ok(!json.includes('@') && !json.includes('Real Viewer'));
      assert.deepEqual(Object.keys((await rpc(db, 'get_leaderboard', 'all', 1))[0]).sort(), ['avatar_url', 'points', 'public_name', 'rank', 'rated_games', 'user_id', 'wins']);
    });

    test('"this quarter" leaves out games from earlier quarters; "all time" keeps them', async () => {
      const { a, g1 } = await threeWayRivalry();
      await db.query(`UPDATE public.drafts SET results_finalized_at = date_trunc('quarter', now()) - interval '1 day' WHERE id = $1`, [g1.id]);
      await actAs(db, a);
      const quarter = await rpc(db, 'get_leaderboard', 'quarter', 50);
      const all = await rpc(db, 'get_leaderboard', 'all', 50);
      assert.equal(Number(quarter.find((r) => r.user_id === a.id).points), 5, 'only game 2 counts this quarter');
      assert.equal(Number(all.find((r) => r.user_id === a.id).points), 15);
    });

    test('banned players are hidden; idle players earn no games; the limit is honoured', async () => {
      const { a, b } = await threeWayRivalry();
      await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [b.id]);
      await actAs(db, a);
      const board = await rpc(db, 'get_leaderboard', 'all', 50);
      assert.ok(!board.some((r) => r.user_id === b.id));
      assert.equal((await rpc(db, 'get_leaderboard', 'all', 1)).length, 1);
    });

    test('an empty board is empty, not an error', async () => {
      const p = await mk('Nobody Yet');
      await actAs(db, p);
      assert.deepEqual(await rpc(db, 'get_leaderboard', 'quarter', 50), []);
    });
  });

  describe('my standing', () => {
    test('shows my rank and totals, even though others tie; unranked players are told so', async () => {
      const { c } = await threeWayRivalry();
      await actAs(db, c);
      const me = await rpcJson(db, 'get_my_standing', 'quarter');
      assert.equal(me.ranked, true);
      assert.equal(Number(me.rank), 3);
      assert.equal(Number(me.points), 12);
      assert.equal(Number(me.players), 3);

      const newcomer = await mk('Brand New');
      await actAs(db, newcomer);
      const none = await rpcJson(db, 'get_my_standing', 'quarter');
      assert.equal(none.ranked, false);
    });
  });

  describe('player cards (the profile hover)', () => {
    test('stats for a player: games, wins, points, public games and reliability', async () => {
      const { a } = await threeWayRivalry();
      await actAs(db, a);
      const card = await rpcJson(db, 'get_player_card', a.id);
      assert.equal(card.public_name.startsWith('Lead A'), true);
      assert.equal(Number(card.rated_games), 2);
      assert.equal(Number(card.wins), 1);
      assert.equal(Number(card.points_all_time), 15);
      assert.equal(Number(card.points_this_quarter), 15);
      assert.equal(Number(card.public_games), 2);
      assert.equal(Number(card.reliability), 100, 'they made all their own picks');
    });

    test('reliability drops when the referee has to pick for you', async () => {
      const [a, b, c] = [await mk('Rel A'), await mk('Rel B'), await mk('Rel C')];
      const g = await kit.playGame([a, b, c], { perPick: [10, 20, 30], manual: [Infinity, 1, Infinity] }); // B: 1 of 2 by hand
      await kit.finalize(g.id);
      await actAs(db, a);
      const card = await rpcJson(db, 'get_player_card', b.id);
      assert.equal(Number(card.reliability), 50);
      assert.equal(Number((await rpcJson(db, 'get_player_card', a.id)).reliability), 100);
    });

    test('never reveals an email or a real name, and refuses people without a public name', async () => {
      const real = await mk('Card Real', { email: 'card.real@example.test', name: 'Cardigan Realname' });
      const nameless = await makePlayer(db, { name: 'Hidden Person' });
      await actAs(db, real);
      const json = JSON.stringify(await rpcJson(db, 'get_player_card', real.id));
      assert.ok(!json.includes('@') && !json.includes('Cardigan'));
      await assert.rejects(rpcJson(db, 'get_player_card', nameless.id), /Player not found/);
      await assert.rejects(rpcJson(db, 'get_player_card', uuid()), /Player not found/);
    });
  });

  describe('permissions', () => {
    test('the scoring functions are server-only; the boards need a signed-in player', async () => {
      const p = await mk('Perm Pia');
      await actAs(db, p);
      try {
        await db.exec('SET ROLE authenticated');
        await assert.rejects(db.query(`SELECT public.finalize_draft_results($1)`, [uuid()]), /permission denied/);
        await assert.rejects(db.query(`SELECT * FROM public.referee_list_unscored_drafts(5)`), /permission denied/);
        await assert.rejects(db.query(`SELECT * FROM public._draft_human_stats($1)`, [uuid()]), /permission denied/);
        await db.query(`SELECT * FROM public.get_leaderboard('quarter', 5)`); // fine for a signed-in player
        await assert.rejects(db.query(`SELECT * FROM public.draft_results`), /permission denied/);
        await db.exec('RESET ROLE');
        await actAs(db, null);
        await db.exec('SET ROLE anon');
        await assert.rejects(db.query(`SELECT * FROM public.get_leaderboard('quarter', 5)`), /permission denied/);
        await assert.rejects(db.query(`SELECT public.get_player_card($1)`, [uuid()]), /permission denied/);
      } finally {
        await db.exec('RESET ROLE');
      }
    });
  });
});
