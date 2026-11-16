import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDb, makeDraft, startDraft, getDraft, getParticipant, humanPick, setAuth, readMigration, uuid,
} from './helpers.mjs';

const secondsFromNow = (d) => (new Date(d).getTime() - Date.now()) / 1000;
const TWO_HUMANS = [{ name: 'Ann' }, { name: 'Ben' }];

describe('return_to_draft: a player who comes back is no longer Away', () => {
  let db;
  before(async () => {
    db = await newDb();
    await db.exec(readMigration('20261120100000_return_to_draft.sql'));
  });

  /** A started draft whose first player is Away and on the short ~5 second clock. */
  async function awayOnTheirTurn({ clock = 600 } = {}) {
    const d = await makeDraft(db, { players: TWO_HUMANS, categories: ['Comedy', 'Drama/Romance', "90's"], clock });
    await startDraft(db, d);
    const first = d.turnOrder[0].participant_name;
    const me = d.players.find((p) => p.name === first);
    await db.query(
      `UPDATE public.draft_participants SET consecutive_auto_picks = 2, auto_pick_count = 2, is_away = true
        WHERE draft_id = $1 AND participant_name = $2`,
      [d.draftId, first],
    );
    await db.query(
      `UPDATE public.drafts SET current_turn_deadline_at = clock_timestamp() + interval '5 seconds' WHERE id = $1`,
      [d.draftId],
    );
    return { d, first, me };
  }

  const comeBack = async (d, me) => {
    await setAuth(db, me.userId);
    return (await db.query(`SELECT public.return_to_draft($1, $2) AS r`, [d.draftId, me.participantId])).rows[0].r;
  };

  test('clears Away and the strikes, and gives them a full clock when it is their turn', async () => {
    const { d, first, me } = await awayOnTheirTurn({ clock: 600 });
    const res = await comeBack(d, me);
    assert.deepEqual(res, { cleared: true, extended: true });

    const p = await getParticipant(db, d.draftId, first);
    assert.equal(p.is_away, false);
    assert.equal(p.consecutive_auto_picks, 0);
    assert.equal(p.auto_pick_count, 2, 'the lifetime auto-pick count is kept for the reliability record');

    const left = secondsFromNow((await getDraft(db, d.draftId)).current_turn_deadline_at);
    assert.ok(left > 590 && left <= 600.5, `expected a full 600s clock, got ${left}`);
  });

  test('after coming back they can make the pick themselves, and it counts as a normal player pick', async () => {
    const { d, first, me } = await awayOnTheirTurn();
    await comeBack(d, me);
    const r = await humanPick(db, d, first, 'Comedy');
    assert.equal(r.success, true);
    assert.equal((await getParticipant(db, d.draftId, first)).is_away, false);
  });

  test("when it is not their turn, the flags clear and the current turn's deadline is not touched", async () => {
    const { d, first } = await awayOnTheirTurn();
    const other = d.players.find((p) => p.name !== first);
    // Make the OTHER player's flags the ones under test: Ben is away but it is Ann's turn.
    await db.query(
      `UPDATE public.draft_participants SET consecutive_auto_picks = 2, is_away = true WHERE draft_id = $1 AND participant_name = $2`,
      [d.draftId, other.name],
    );
    const before = (await getDraft(db, d.draftId)).current_turn_deadline_at;
    const res = await comeBack(d, other);
    assert.deepEqual(res, { cleared: true, extended: false });
    assert.equal((await getParticipant(db, d.draftId, other.name)).is_away, false);
    assert.equal(new Date((await getDraft(db, d.draftId)).current_turn_deadline_at).getTime(), new Date(before).getTime());
  });

  test('does nothing for a player who is not Away', async () => {
    const d = await makeDraft(db, { players: TWO_HUMANS, clock: 600 });
    await startDraft(db, d);
    const first = d.players.find((p) => p.name === d.turnOrder[0].participant_name);
    const before = (await getDraft(db, d.draftId)).current_turn_deadline_at;
    const res = await comeBack(d, first);
    assert.deepEqual(res, { cleared: false, extended: false });
    assert.equal(new Date((await getDraft(db, d.draftId)).current_turn_deadline_at).getTime(), new Date(before).getTime());
  });

  test('never shortens a deadline that is already longer than a full clock', async () => {
    const { d, me } = await awayOnTheirTurn({ clock: 60 });
    await db.query(`UPDATE public.drafts SET current_turn_deadline_at = clock_timestamp() + interval '1000 seconds' WHERE id = $1`, [d.draftId]);
    const res = await comeBack(d, me);
    assert.deepEqual(res, { cleared: true, extended: false });
    const left = secondsFromNow((await getDraft(db, d.draftId)).current_turn_deadline_at);
    assert.ok(left > 900, `deadline should stay long, got ${left}`);
  });

  test('leaves the turn alone while the referee is already making that pick', async () => {
    const { d, me } = await awayOnTheirTurn();
    await db.query(`UPDATE public.drafts SET referee_claim_until = clock_timestamp() + interval '30 seconds' WHERE id = $1`, [d.draftId]);
    const before = (await getDraft(db, d.draftId)).current_turn_deadline_at;
    const res = await comeBack(d, me);
    assert.deepEqual(res, { cleared: true, extended: false });
    assert.equal(new Date((await getDraft(db, d.draftId)).current_turn_deadline_at).getTime(), new Date(before).getTime());
  });

  test('their next turns use the full clock again (not the 5 second Away clock)', async () => {
    const { d, first, me } = await awayOnTheirTurn({ clock: 600 });
    await comeBack(d, me);
    // Ann picks; Ben picks; then it is Ann's turn again (snake order: A, B, B, A, A, B).
    assert.equal((await humanPick(db, d, first, 'Comedy')).success, true);
    const other = d.players.find((p) => p.name !== first);
    assert.equal((await humanPick(db, d, other.name, 'Comedy')).success, true);
    assert.equal((await humanPick(db, d, other.name, 'Drama/Romance')).success, true);
    const draft = await getDraft(db, d.draftId);
    const turn = d.turnOrder.find((t) => t.pick_number === draft.current_pick_number);
    assert.equal(turn.participant_name, first);
    assert.ok(secondsFromNow(draft.current_turn_deadline_at) > 500, 'a returned player gets a full clock on later turns too');
  });

  test('someone who is not in the draft is refused', async () => {
    const { d } = await awayOnTheirTurn();
    const stranger = uuid();
    await setAuth(db, stranger);
    await assert.rejects(
      db.query(`SELECT public.return_to_draft($1, $2)`, [d.draftId, stranger]),
      /Access denied/,
    );
  });

  test('is idempotent: running the migration again changes nothing and does not error', async () => {
    const own = await newDb();
    await own.exec(readMigration('20261120100000_return_to_draft.sql'));
    await own.exec(readMigration('20261120100000_return_to_draft.sql'));
    const r = await own.query(`SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'return_to_draft'`);
    assert.equal(r.rows[0].n, 1);
  });
});
