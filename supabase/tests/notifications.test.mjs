import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makeDraft, startDraft, humanPick, readMigration, expireClock, refereeResolve } from './helpers.mjs';

const notesFor = async (db, userId) =>
  (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 ORDER BY created_at`, [userId])).rows;

describe('"your turn" notifications', () => {
  let db;
  before(async () => { db = await newDb({ notifications: true }); });

  test('migration is idempotent', async () => {
    const own = await newDb({ notifications: true });
    await own.exec(readMigration('20261104121000_referee_your_turn_notifications.sql'));
  });

  test('the older notification types are still allowed; garbage types are not', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }] });
    const uid = d.players[0].userId;
    for (const t of ['draft_invite', 'league_invite', 'upcoming_draft', 'your_turn']) {
      await db.query(`INSERT INTO public.notifications (user_id, type, title) VALUES ($1, $2, 't')`, [uid, t]);
    }
    await assert.rejects(db.query(`INSERT INTO public.notifications (user_id, type, title) VALUES ($1, 'bogus', 't')`, [uid]));
  });

  test('slow draft: the player whose turn it is gets one notification linking to the draft', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }], clock: 3600 });
    await startDraft(db, d);
    const first = d.players.find((p) => p.name === d.turnOrder[0].participant_name);
    const notes = (await notesFor(db, first.userId)).filter((n) => n.type === 'your_turn');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].link, `/draft/${d.draftId}`);
    assert.equal(notes[0].reference_id, d.draftId);
    assert.equal(notes[0].metadata.pick_number, 1);
  });

  test('after a pick, the NEXT player is notified (the picker gets no new notice)', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }], clock: 86400 });
    await startDraft(db, d);
    await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy');
    const second = d.players.find((p) => p.name === d.turnOrder[1].participant_name);
    const picker = d.players.find((p) => p.name === d.turnOrder[0].participant_name);
    assert.equal((await notesFor(db, second.userId)).filter((n) => n.type === 'your_turn').length, 1);
    assert.equal((await notesFor(db, picker.userId)).filter((n) => n.type === 'your_turn').length, 1, 'only their own earlier turn notice');
  });

  test('an unread notice for the same draft is replaced, not piled up', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }], categories: ['Comedy', 'Drama/Romance'], clock: 3600 });
    await startDraft(db, d);
    // snake order: pick 2 and 3 both belong to the second player in turn order
    await humanPick(db, d, d.turnOrder[0].participant_name, 'Comedy');
    await humanPick(db, d, d.turnOrder[1].participant_name, 'Comedy');
    const p = d.players.find((x) => x.name === d.turnOrder[1].participant_name);
    const unread = (await notesFor(db, p.userId)).filter((n) => n.type === 'your_turn' && !n.is_read);
    assert.equal(unread.length, 1, 'one unread "your turn" per draft');
    assert.equal(unread[0].metadata.pick_number, 3, 'and it is the latest one');
  });

  test('live draft (short clock): no notification, the player is already at the screen', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Ben' }], clock: 90 });
    await startDraft(db, d);
    for (const p of d.players) assert.equal((await notesFor(db, p.userId)).length, 0);
  });

  test('bots never get notifications, and a finished draft sends none', async () => {
    const d = await makeDraft(db, { players: [{ name: 'Ann' }, { name: 'Robo', ai: true }], categories: ['Comedy'], clock: 3600 });
    await startDraft(db, d);
    if (d.turnOrder[0].participant_name === 'Ann') await humanPick(db, d, 'Ann', 'Comedy');
    await expireClock(db, d.draftId);
    const { applied } = await refereeResolve(db, d);
    assert.equal(applied.is_complete, true);
    const total = (await db.query(`SELECT count(*)::int AS n FROM public.notifications WHERE reference_id = $1`, [d.draftId])).rows[0].n;
    // exactly the human's opening/only turn notice if they were first; nothing after completion
    assert.ok(total <= 1);
  });

  test('a notification failure can NEVER block a pick', async () => {
    const own = await newDb({ notifications: true });
    await own.exec(`ALTER TABLE public.notifications ADD CONSTRAINT nope CHECK (type <> 'your_turn')`);
    const d = await makeDraft(own, { players: [{ name: 'Ann' }, { name: 'Ben' }], categories: ['Comedy'], clock: 3600 });
    await startDraft(own, d); // trigger tries to notify, fails, is swallowed
    const res = await humanPick(own, d, d.turnOrder[0].participant_name, 'Comedy');
    assert.equal(res.success, true);
    const n = (await own.query(`SELECT count(*)::int AS n FROM public.notifications WHERE type = 'your_turn'`)).rows[0].n;
    assert.equal(n, 0);
  });
});
