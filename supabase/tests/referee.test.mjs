import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDb, makeDraft, startDraft, getDraft, getPicks, getParticipant, expireClock,
  humanPick, refereeResolve, setAuth, nextMovie, uuid,
} from './helpers.mjs';

const secondsFromNow = (d) => (new Date(d).getTime() - Date.now()) / 1000;
const TWO_HUMANS = [{ name: 'Ann' }, { name: 'Ben' }];

describe('referee foundation migration', () => {
  let db;
  before(async () => { db = await newDb(); });

  test('is idempotent: running it a second time changes nothing and does not error', async () => {
    // Uses its own database so re-applying the migration can't hide problems in the shared one.
    const { readMigration } = await import('./helpers.mjs');
    const own = await newDb();
    await own.exec(readMigration('20261104120000_referee_foundation.sql'));
    await own.exec(readMigration('20261104120000_referee_foundation.sql'));
    const cols = await own.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'drafts' AND column_name IN ('referee_enabled','pick_clock_seconds','current_turn_deadline_at')`
    );
    assert.equal(cols.rows.length, 3);
  });

  describe('legacy drafts (referee OFF) are untouched', () => {
    test('a normal draft plays through the real pick function exactly as before', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy'], referee: false });
      await startDraft(db, d);

      let draft = await getDraft(db, d.draftId);
      assert.equal(draft.referee_enabled, false);
      assert.equal(draft.current_turn_deadline_at, null, 'no deadline on a legacy draft');

      const first = d.turnOrder[0].participant_name;
      const second = d.turnOrder[1].participant_name;
      const r1 = await humanPick(db, d, first, 'Comedy');
      assert.equal(r1.success, true);
      const r2 = await humanPick(db, d, second, 'Comedy');
      assert.equal(r2.success, true);

      draft = await getDraft(db, d.draftId);
      assert.equal(draft.is_complete, true);
      assert.equal(draft.current_turn_deadline_at, null);
      const picks = await getPicks(db, d.draftId);
      assert.deepEqual(picks.map((p) => p.pick_source), ['player', 'player']);
    });

    test('a stale pick order is NOT blocked on legacy drafts (guard only applies to referee drafts)', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy'], referee: false });
      await startDraft(db, d);
      await db.query(
        `INSERT INTO public.draft_picks (draft_id, player_id, player_name, movie_id, movie_title, category, pick_order)
         VALUES ($1, 1, 'Ann', $2, 'x', 'Comedy', 99)`,
        [d.draftId, nextMovie().id]
      );
      assert.equal((await getPicks(db, d.draftId)).length, 1);
    });

    test('bot picks through the old host-browser path are labelled "bot"', async () => {
      const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Robo', ai: true }], categories: ['Comedy'], referee: false });
      await startDraft(db, d);
      const botTurn = d.turnOrder.find((t) => t.participant_name === 'Robo');
      const humanTurn = d.turnOrder.find((t) => t.participant_name === 'Ann');
      const order = d.turnOrder.map((t) => t.participant_name);
      // play in turn order; bots are picked by the owner on their behalf
      for (const name of order) {
        if (name === 'Robo') {
          const bot = d.players.find((p) => p.ai);
          await setAuth(db, d.ownerId);
          const m = nextMovie();
          const res = await db.query(
            `SELECT * FROM public.make_multiplayer_pick_unified($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [d.draftId, bot.participantId, m.id, m.title, m.year, m.genre, 'Comedy', null, d.ownerId]
          );
          assert.equal(res.rows[0].success, true, res.rows[0].message);
        } else {
          assert.equal((await humanPick(db, d, name, 'Comedy')).success, true);
        }
      }
      assert.ok(botTurn && humanTurn);
      const picks = await getPicks(db, d.draftId);
      assert.equal(picks.find((p) => p.player_name === 'Robo').pick_source, 'bot');
      assert.equal(picks.find((p) => p.player_name === 'Ann').pick_source, 'player');
    });
  });

  describe('set_draft_referee', () => {
    test('owner can enable it with a clock before the draft starts', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, referee: false });
      await setAuth(db, d.ownerId);
      const res = (await db.query(`SELECT public.set_draft_referee($1, $2, true, 90) AS r`, [d.draftId, d.ownerId])).rows[0].r;
      assert.deepEqual(res, { referee_enabled: true, pick_clock_seconds: 90 });
      const draft = await getDraft(db, d.draftId);
      assert.equal(draft.referee_enabled, true);
      assert.equal(draft.pick_clock_seconds, 90);
    });

    test('disabling clears the clock', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, clock: 120 });
      await setAuth(db, d.ownerId);
      await db.query(`SELECT public.set_draft_referee($1, $2, false, 120)`, [d.draftId, d.ownerId]);
      const draft = await getDraft(db, d.draftId);
      assert.equal(draft.referee_enabled, false);
      assert.equal(draft.pick_clock_seconds, null);
    });

    test('a non-owner cannot change it', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, referee: false });
      const ben = d.players.find((p) => p.name === 'Ben');
      await setAuth(db, ben.userId);
      await assert.rejects(
        db.query(`SELECT public.set_draft_referee($1, $2, true, 60)`, [d.draftId, ben.userId]),
        /Only the draft owner/
      );
    });

    test('cannot be changed after the draft has started', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await setAuth(db, d.ownerId);
      await assert.rejects(
        db.query(`SELECT public.set_draft_referee($1, $2, true, 45)`, [d.draftId, d.ownerId]),
        /after the draft has started/
      );
    });

    test('rejects a clock under 30 seconds or over 24 hours', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, referee: false });
      await setAuth(db, d.ownerId);
      await assert.rejects(db.query(`SELECT public.set_draft_referee($1, $2, true, 29)`, [d.draftId, d.ownerId]), /between 30 seconds and 24 hours/);
      await assert.rejects(db.query(`SELECT public.set_draft_referee($1, $2, true, 86401)`, [d.draftId, d.ownerId]), /between 30 seconds and 24 hours/);
    });

    test('the database itself also enforces the 30s-24h range', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, referee: false });
      await assert.rejects(db.query(`UPDATE public.drafts SET pick_clock_seconds = 5 WHERE id = $1`, [d.draftId]), /drafts_pick_clock_range/);
    });
  });

  describe('turn deadlines', () => {
    test('starting the draft sets the first deadline from the clock', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, clock: 90 });
      assert.equal((await getDraft(db, d.draftId)).current_turn_deadline_at, null, 'no deadline before start');
      await startDraft(db, d);
      const draft = await getDraft(db, d.draftId);
      const left = secondsFromNow(draft.current_turn_deadline_at);
      assert.ok(left > 85 && left <= 90, `expected ~90s, got ${left}`);
    });

    test('a manual pick moves the deadline forward for the next player', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, clock: 60 });
      await startDraft(db, d);
      await db.query(`UPDATE public.drafts SET current_turn_deadline_at = clock_timestamp() + interval '5 seconds' WHERE id = $1`, [d.draftId]);
      const res = await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy');
      assert.equal(res.success, true);
      const left = secondsFromNow((await getDraft(db, d.draftId)).current_turn_deadline_at);
      assert.ok(left > 55, `deadline should reset to ~60s, got ${left}`);
    });

    test('a bot turn gets a short ~3 second deadline, not the human clock', async () => {
      const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Robo', ai: true }], clock: 3600 });
      await startDraft(db, d);
      const draft = await getDraft(db, d.draftId);
      const turnName = d.turnOrder[0].participant_name;
      const left = secondsFromNow(draft.current_turn_deadline_at);
      if (turnName === 'Robo') assert.ok(left <= 3.5 && left > 0, `bot deadline ~3s, got ${left}`);
      else assert.ok(left > 3500, `human deadline ~1h, got ${left}`);
    });

    test('a referee draft with NO clock has no human deadline (waits, like today)', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, referee: false });
      await setAuth(db, d.ownerId);
      await db.query(`SELECT public.set_draft_referee($1, $2, true, NULL)`, [d.draftId, d.ownerId]);
      await startDraft(db, d);
      assert.equal((await getDraft(db, d.draftId)).current_turn_deadline_at, null);
    });
  });

  describe('overdue turns', () => {
    test('nothing happens before the deadline', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      const { claim } = await refereeResolve(db, d);
      assert.equal(claim.claimed, false);
      assert.equal(claim.reason, 'not_overdue');
    });

    test('claiming returns what the picker needs and blocks a second claimer', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy', 'Drama/Romance'] });
      await startDraft(db, d);
      await expireClock(db, d.draftId);

      const first = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
      assert.equal(first.claimed, true);
      assert.equal(first.pick_number, 1);
      assert.equal(first.is_bot, false);
      assert.equal(first.participant.name, d.turnOrder[0].participant_name);
      assert.deepEqual(first.open_categories, ['Comedy', 'Drama/Romance']);
      assert.deepEqual(first.picked_movie_ids, []);
      assert.equal(first.draft.theme, 'year');

      const second = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
      assert.equal(second.claimed, false);
      assert.equal(second.reason, 'claim_in_progress');
    });

    test('an auto-pick is recorded as "auto", advances the turn, and gives a strike', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, clock: 60 });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      const idler = d.turnOrder[0].participant_name;

      const { applied } = await refereeResolve(db, d);
      assert.equal(applied.applied, true);
      assert.equal(applied.source, 'auto');

      const picks = await getPicks(db, d.draftId);
      assert.equal(picks.length, 1);
      assert.equal(picks[0].pick_source, 'auto');
      assert.equal(picks[0].player_name, idler);

      const draft = await getDraft(db, d.draftId);
      assert.equal(draft.current_pick_number, 2);
      assert.equal(draft.current_turn_participant_id, d.turnOrder[1].participant_id);
      assert.equal(draft.referee_claim_until, null);
      assert.ok(secondsFromNow(draft.current_turn_deadline_at) > 55, 'next player gets a fresh clock');

      const p = await getParticipant(db, d.draftId, idler);
      assert.equal(p.auto_pick_count, 1);
      assert.equal(p.consecutive_auto_picks, 1);
      assert.equal(p.is_away, false);
    });

    test('the same turn cannot be resolved twice', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      const claim = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
      const m1 = nextMovie();
      const args = (m) => [d.draftId, claim.pick_number, m.id, m.title, m.year, m.genre, 'Comedy', m.poster];
      const a = (await db.query(`SELECT public.referee_apply_pick($1,$2,$3,$4,$5,$6,$7,$8) AS r`, args(m1))).rows[0].r;
      assert.equal(a.applied, true);
      const b = (await db.query(`SELECT public.referee_apply_pick($1,$2,$3,$4,$5,$6,$7,$8) AS r`, args(nextMovie()))).rows[0].r;
      assert.equal(b.applied, false);
      assert.equal(b.reason, 'turn_already_resolved');
      assert.equal((await getPicks(db, d.draftId)).length, 1);
    });

    test('if the human picked first, the referee backs off (no double pick)', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      const claim = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
      // ...meanwhile the human's pick lands first
      assert.equal((await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy')).success, true);
      const m = nextMovie();
      const res = (await db.query(`SELECT public.referee_apply_pick($1,$2,$3,$4,$5,$6,$7,$8) AS r`,
        [d.draftId, claim.pick_number, m.id, m.title, m.year, m.genre, 'Comedy', m.poster])).rows[0].r;
      assert.equal(res.applied, false);
      assert.equal(res.reason, 'turn_already_resolved');
      const picks = await getPicks(db, d.draftId);
      assert.equal(picks.length, 1);
      assert.equal(picks[0].pick_source, 'player');
    });

    test('a human pick that arrives after the referee resolved the turn is rejected cleanly', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      const idler = d.turnOrder[0];
      await refereeResolve(db, d); // referee picks for the idler
      // The idler's stale click: tries to insert for the SAME pick_order
      await assert.rejects(
        db.query(
          `INSERT INTO public.draft_picks (draft_id, player_id, player_name, movie_id, movie_title, category, pick_order)
           VALUES ($1, 1, $2, $3, 'late', 'Drama/Romance', 1)`,
          [d.draftId, idler.participant_name, nextMovie().id]
        ),
        /already resolved/
      );
      assert.equal((await getPicks(db, d.draftId)).length, 1);
    });

    test('a duplicate movie is reported, not applied, and leaves the draft unchanged', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      const dup = nextMovie();
      assert.equal((await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy', dup)).success, true);
      await expireClock(db, d.draftId);
      const { applied } = await refereeResolve(db, d, { movie: dup, category: 'Comedy' });
      assert.equal(applied.applied, false);
      assert.equal(applied.reason, 'duplicate_movie');
      const draft = await getDraft(db, d.draftId);
      assert.equal(draft.current_pick_number, 2);
      assert.equal((await getPicks(db, d.draftId)).length, 1);
    });

    test('a player\'s open categories shrink as they fill them', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy', 'Drama/Romance'] });
      await startDraft(db, d);
      await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy');
      await humanPick(db, d, d.turnOrder[1].participant_name, 'Drama/Romance');
      // snake: round 2 starts with the player who went second, then the first player again
      await expireClock(db, d.draftId);
      const claim = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
      assert.equal(claim.claimed, true);
      assert.equal(claim.participant.name, d.turnOrder[2].participant_name);
      assert.equal(claim.open_categories.length, 1);
      assert.equal(claim.picked_movie_ids.length, 2);
    });
  });

  describe('strikes and Away', () => {
    test('two auto-picks in a row marks a player Away, and their next turn is fast (~5s)', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy', 'Drama/Romance', "90's"], clock: 600 });
      await startDraft(db, d);
      const ann = 'Ann';
      // Walk until Ann has been auto-picked twice, with Ben picking normally in between.
      let annAuto = 0;
      let safety = 0;
      while (annAuto < 2 && safety++ < 6) {
        const draft = await getDraft(db, d.draftId);
        const turn = d.turnOrder.find((t) => t.pick_number === draft.current_pick_number);
        if (turn.participant_name === ann) {
          await expireClock(db, d.draftId);
          const { applied } = await refereeResolve(db, d);
          assert.equal(applied.applied, true);
          annAuto++;
        } else {
          const claim = (await db.query(`SELECT public.referee_claim_turn($1)`, [d.draftId]));
          void claim;
          const open = ['Comedy', 'Drama/Romance', "90's"];
          const done = (await getPicks(db, d.draftId)).filter((p) => p.player_name === 'Ben').map((p) => p.category);
          assert.equal((await humanPick(db, d, 'Ben', open.find((c) => !done.includes(c)))).success, true);
        }
      }
      const p = await getParticipant(db, d.draftId, ann);
      assert.equal(p.consecutive_auto_picks, 2);
      assert.equal(p.is_away, true);

      // If it is Ann's turn again, her deadline is the short Away deadline.
      const draft = await getDraft(db, d.draftId);
      if (!draft.is_complete) {
        const turn = d.turnOrder.find((t) => t.pick_number === draft.current_pick_number);
        if (turn.participant_name === ann) {
          const left = secondsFromNow(draft.current_turn_deadline_at);
          assert.ok(left <= 5.5, `Away deadline should be ~5s, got ${left}`);
        }
      }
    });

    test('a pick the player makes themselves clears their strikes and Away flag', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      const first = d.turnOrder[0].participant_name;
      await db.query(
        `UPDATE public.draft_participants SET consecutive_auto_picks = 2, auto_pick_count = 2, is_away = true
          WHERE draft_id = $1 AND participant_name = $2`,
        [d.draftId, first]
      );
      assert.equal((await humanPick(db, d, first, 'Comedy')).success, true);
      const p = await getParticipant(db, d.draftId, first);
      assert.equal(p.consecutive_auto_picks, 0);
      assert.equal(p.is_away, false);
      assert.equal(p.auto_pick_count, 2, 'lifetime auto-pick count is kept for the reliability record');
    });
  });

  describe('bots', () => {
    test('the referee makes a bot\'s pick after its short deadline, labelled "bot", with no strike', async () => {
      const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Robo', ai: true }], categories: ['Comedy'] });
      await startDraft(db, d);
      // Make sure it is the bot's turn: if Ann is first, she picks normally.
      if (d.turnOrder[0].participant_name === 'Ann') await humanPick(db, d, 'Ann', 'Comedy');
      await expireClock(db, d.draftId);
      const { claim, applied } = await refereeResolve(db, d);
      assert.equal(claim.is_bot, true);
      assert.equal(applied.source, 'bot');
      const robo = await getParticipant(db, d.draftId, 'Robo');
      assert.equal(robo.auto_pick_count, 0);
      assert.equal(robo.is_away, false);
    });

    test('a bot works even when the draft has no human clock (this is the "host closed the tab" fix)', async () => {
      const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Robo', ai: true }], categories: ['Comedy'], referee: false });
      await setAuth(db, d.ownerId);
      await db.query(`SELECT public.set_draft_referee($1, $2, true, NULL)`, [d.draftId, d.ownerId]);
      await startDraft(db, d);
      if (d.turnOrder[0].participant_name === 'Ann') await humanPick(db, d, 'Ann', 'Comedy');
      assert.ok((await getDraft(db, d.draftId)).current_turn_deadline_at, 'bot turn still gets a deadline');
      await expireClock(db, d.draftId);
      const { applied } = await refereeResolve(db, d);
      assert.equal(applied.applied, true);
      assert.equal(applied.is_complete, true);
    });
  });

  describe('finishing a draft', () => {
    test('the last pick completes the draft and clears the deadline', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy'] });
      await startDraft(db, d);
      await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy');
      await expireClock(db, d.draftId);
      const { applied } = await refereeResolve(db, d);
      assert.equal(applied.is_complete, true);
      const draft = await getDraft(db, d.draftId);
      assert.equal(draft.is_complete, true);
      assert.equal(draft.current_turn_deadline_at, null);
      assert.equal(draft.current_turn_participant_id, null);
      const again = await refereeResolve(db, d);
      assert.equal(again.claim.claimed, false);
      assert.equal(again.claim.reason, 'complete');
    });

    test('REFEREE PATH == MANUAL PATH: both leave the draft and picks in the same state', async () => {
      const run = async (viaReferee) => {
        const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }, { name: 'Cy' }], categories: ['Comedy', 'Drama/Romance'], referee: viaReferee });
        await startDraft(db, d);
        const total = d.turnOrder.length;
        const cats = {};
        for (let i = 1; i <= total; i++) {
          const turn = d.turnOrder.find((t) => t.pick_number === i);
          const done = cats[turn.participant_name] ?? (cats[turn.participant_name] = []);
          const cat = ['Comedy', 'Drama/Romance'].find((c) => !done.includes(c));
          done.push(cat);
          const movie = { id: 5000 + i, title: `M${i}`, year: 1999, genre: 'Comedy', poster: null };
          if (viaReferee) {
            await expireClock(db, d.draftId);
            const { applied } = await refereeResolve(db, d, { category: cat, movie });
            assert.equal(applied.applied, true, `pick ${i}`);
          } else {
            assert.equal((await humanPick(db, d, turn.participant_name, cat, movie)).success, true, `pick ${i}`);
          }
        }
        const draft = await getDraft(db, d.draftId);
        const picks = (await getPicks(db, d.draftId)).map((p) => ({
          player_id: p.player_id, player_name: p.player_name, movie_id: p.movie_id,
          category: p.category, pick_order: p.pick_order,
        }));
        return {
          picks,
          is_complete: draft.is_complete,
          current_pick_number: draft.current_pick_number,
          current_turn_participant_id: draft.current_turn_participant_id,
        };
      };

      const manual = await run(false);
      const referee = await run(true);
      // names/ids differ per draft only in the uuids, which are not part of the comparison
      assert.deepEqual(referee.picks, manual.picks);
      assert.equal(referee.is_complete, manual.is_complete);
      assert.equal(referee.current_pick_number, manual.current_pick_number);
      assert.equal(referee.current_turn_participant_id, manual.current_turn_participant_id);
      assert.equal(referee.is_complete, true);
    });
  });

  describe('sweep and permissions', () => {
    test('referee_list_overdue_drafts lists only overdue, unclaimed, referee-enabled drafts', async () => {
      const overdue = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, overdue);
      await expireClock(db, overdue.draftId);

      const fresh = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, fresh);

      const claimed = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, claimed);
      await expireClock(db, claimed.draftId);
      await db.query(`SELECT public.referee_claim_turn($1)`, [claimed.draftId]);

      const legacy = await makeDraft(db, { players: TWO_HUMANS, referee: false });
      await startDraft(db, legacy);

      const ids = (await db.query(`SELECT draft_id FROM public.referee_list_overdue_drafts(200)`)).rows.map((r) => r.draft_id);
      assert.ok(ids.includes(overdue.draftId));
      assert.ok(!ids.includes(fresh.draftId));
      assert.ok(!ids.includes(claimed.draftId));
      assert.ok(!ids.includes(legacy.draftId));
    });

    test('an expired claim (the picker crashed) can be taken over', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      await db.query(`SELECT public.referee_claim_turn($1)`, [d.draftId]);
      await db.query(`UPDATE public.drafts SET referee_claim_until = clock_timestamp() - interval '1 second' WHERE id = $1`, [d.draftId]);
      const again = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
      assert.equal(again.claimed, true);
    });

    test('regular users cannot call the referee-only functions', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      try {
        await db.exec(`SET ROLE authenticated`);
        await assert.rejects(db.query(`SELECT public.referee_claim_turn($1)`, [d.draftId]), /permission denied/);
        await assert.rejects(db.query(`SELECT public.referee_list_overdue_drafts(5)`), /permission denied/);
        await assert.rejects(
          db.query(`SELECT public.referee_apply_pick($1, 1, 1, 'x', 1999, 'Comedy', 'Comedy', NULL)`, [d.draftId]),
          /permission denied/
        );
        await db.exec(`SET ROLE anon`);
        await assert.rejects(db.query(`SELECT public.referee_claim_turn($1)`, [d.draftId]), /permission denied/);
      } finally {
        await db.exec(`RESET ROLE`);
      }
    });

    test('the service role can call them', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      try {
        await db.exec(`SET ROLE service_role`);
        const r = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
        assert.equal(r.claimed, true);
      } finally {
        await db.exec(`RESET ROLE`);
      }
    });
  });

  describe('get_draft_clock (what the draft screen reads)', () => {
    test('returns the deadline, server time, Away flags and which picks were auto/bot', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS, clock: 120 });
      await startDraft(db, d);
      await expireClock(db, d.draftId);
      await refereeResolve(db, d);

      const viewer = d.players[0];
      await setAuth(db, viewer.userId);
      const c = (await db.query(`SELECT public.get_draft_clock($1, $2) AS r`, [d.draftId, viewer.participantId])).rows[0].r;
      assert.equal(c.referee_enabled, true);
      assert.equal(c.pick_clock_seconds, 120);
      assert.ok(c.deadline_at);
      assert.ok(c.server_now);
      assert.equal(c.participants.length, 2);
      assert.deepEqual(c.pick_sources, { '1': 'auto' });
    });

    test('refuses people who are not in the draft', async () => {
      const d = await makeDraft(db, { players: TWO_HUMANS });
      const outsider = uuid();
      await db.query(`INSERT INTO auth.users (id) VALUES ($1)`, [outsider]);
      await setAuth(db, outsider);
      await assert.rejects(db.query(`SELECT public.get_draft_clock($1, $2)`, [d.draftId, outsider]), /Access denied/);
    });
  });
});
