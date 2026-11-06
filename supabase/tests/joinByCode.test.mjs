import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpc, rpcJson, uuid } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/**
 * The homepage's "Join a Draft" box takes the 8-character code every draft has. For a public table that code must
 * be just another way to find the table: same rules as the Play page (an account, a public name, a free seat,
 * blocks, join limits, the seat held for an invited email), never a back door past them. Private drafts keep
 * working exactly as before, including for guests.
 */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const mk = (b = 'Player', opts = {}) => makePlayer(db, { publicName: nm(b), ...opts });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const people = async (id) => (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at NULLS LAST, created_at`, [id])).rows;
  const held = async (id) => (await people(id)).filter((p) => !p.user_id && !p.is_ai);
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const codeOf = async (id) => (await draft(id)).invite_code;
  const here = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  /** What the homepage box does: the code, a typed name, and the browser's guest id. */
  const joinByCode = async (who, code, name = 'Anyone', guestId = null) => {
    await actAs(db, who);
    return rpc(db, 'join_draft_by_invite_code_guest', code, name, guestId);
  };
  async function openTable(count, { size = 4 } = {}) {
    const host = await mk('Host');
    await actAs(db, host);
    const r = await rpcJson(db, 'create_public_table', 'Open game', 'year', '1999', ['Comedy', 'Drama/Romance'], size, 60, true, null);
    await here(r.draft_id, host);
    const players = [host];
    for (let i = 1; i < count; i++) {
      const p = await mk();
      await call(p, 'join_public_table', r.draft_id);
      await here(r.draft_id, p);
      players.push(p);
    }
    return { players, id: r.draft_id };
  }
  /** A private draft the host owns, with its own code. */
  async function privateDraft(host, code = 'PRIVATE1') {
    const id = uuid();
    await db.query(`INSERT INTO public.drafts (id, user_id, title, invite_code) VALUES ($1, $2, 'Friends draft', $3)`, [id, host.id, code]);
    await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, is_host, joined_at) VALUES ($1, $2, $3, 'joined', true, now())`, [id, host.id, 'Host']);
    return { id, code };
  }
  return { db, mk, call, people, held, draft, codeOf, joinByCode, openTable, privateDraft };
}

describe('a public table has a code, and the code gets you a seat', () => {
  test('every public table is created with a code the homepage box accepts', async () => {
    const { openTable, codeOf } = await fresh();
    const { id } = await openTable(1);
    assert.match(await codeOf(id), /^[A-Z0-9]{8}$/);
  });

  test('a signed-in player enters the code and takes a seat under their public name', async () => {
    const { openTable, mk, joinByCode, codeOf, people } = await fresh();
    const { id } = await openTable(2, { size: 4 });
    const newcomer = await mk('Newcomer');
    const [row] = await joinByCode(newcomer, await codeOf(id), 'Whatever I typed');
    assert.equal(row.draft_id, id);
    const seats = await people(id);
    assert.equal(seats.length, 3);
    const mine = seats.find((p) => p.user_id === newcomer.id);
    assert.ok(mine);
    assert.equal(row.participant_id, mine.id);
    assert.notEqual(mine.participant_name, 'Whatever I typed', 'the typed name is not used on a public table');
    assert.ok(mine.participant_name.startsWith('Newcomer'), 'the public display name is');
  });

  test('the database wants the clean upper-case code (the page tidies what people type)', async () => {
    const { openTable, mk, joinByCode, codeOf } = await fresh();
    const { id } = await openTable(1);
    const p = await mk();
    await assert.rejects(async () => joinByCode(p, (await codeOf(id)).toLowerCase()), /Invalid invite code format/);
  });

  test('someone already at the table gets their own seat back, never a second one', async () => {
    const { openTable, joinByCode, codeOf, people } = await fresh();
    const { players: [host], id } = await openTable(2);
    const before = await people(id);
    const [row] = await joinByCode(host, await codeOf(id));
    assert.equal(row.participant_id, before.find((p) => p.user_id === host.id).id);
    assert.equal((await people(id)).length, before.length);
  });

  test('a friend whose email holds a seat takes that seat with the code (no extra seat)', async () => {
    const { openTable, mk, call, joinByCode, codeOf, people, held } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4 });
    const friend = await mk('Friend', { email: 'friend@example.test' });
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    const [seat] = await held(id);
    const total = (await people(id)).length;
    const [row] = await joinByCode(friend, await codeOf(id));
    assert.equal(row.participant_id, seat.id, 'the held seat is the one they get');
    assert.equal((await people(id)).length, total);
    assert.equal((await held(id)).length, 0);
    assert.equal((await people(id)).find((p) => p.id === seat.id).user_id, friend.id);
  });
});

describe('the code is not a back door past the table rules', () => {
  test('a full table turns the code away and adds nobody', async () => {
    const { openTable, mk, joinByCode, codeOf, people } = await fresh();
    const { id } = await openTable(4, { size: 4 });
    const late = await mk('Late');
    await assert.rejects(async () => joinByCode(late, await codeOf(id)), /table is full/);
    assert.equal((await people(id)).length, 4);
  });

  test('a seat held for an invited friend is not free for a stranger with the code', async () => {
    const { openTable, mk, call, joinByCode, codeOf, people } = await fresh();
    const { players: [host], id } = await openTable(3, { size: 4 });
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    const stranger = await mk('Stranger');
    await assert.rejects(async () => joinByCode(stranger, await codeOf(id)), /table is full/);
    assert.equal((await people(id)).length, 4);
  });

  test('someone a player at the table has blocked (or been blocked by) cannot get in', async () => {
    const { openTable, mk, call, joinByCode, codeOf, people } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4 });
    const pest = await mk('Pest');
    await call(host, 'block_player', pest.id);
    await assert.rejects(async () => joinByCode(pest, await codeOf(id)), /isn't available to you/);
    assert.equal((await people(id)).length, 2);
  });

  test('a signed-out visitor (a guest) is asked to sign in, and no seat is made for them', async () => {
    const { openTable, joinByCode, codeOf, people } = await fresh();
    const { id } = await openTable(1);
    await assert.rejects(async () => joinByCode(null, await codeOf(id), 'Guest Gary', uuid()), /Sign in to join a public table/);
    assert.equal((await people(id)).length, 1);
  });

  test('a table that has started or been cancelled cannot be joined with its code', async () => {
    const { openTable, mk, call, joinByCode, codeOf, people } = await fresh();
    const started = await openTable(2, { size: 4 });
    await call(started.players[0], 'start_public_table', started.id);
    const late = await mk('Late');
    await assert.rejects(async () => joinByCode(late, await codeOf(started.id)), /already started/);

    const cancelled = await openTable(1, { size: 4 });
    await call(cancelled.players[0], 'cancel_public_table', cancelled.id);
    await assert.rejects(async () => joinByCode(late, await codeOf(cancelled.id)), /cancelled/);
    assert.equal((await people(cancelled.id)).length, 1);
  });

  test('when public play is switched off, the code does not work either', async () => {
    const { db, openTable, mk, joinByCode, codeOf, people } = await fresh();
    const { id } = await openTable(1);
    const p = await mk();
    await setMode(db, 'off');
    await assert.rejects(async () => joinByCode(p, await codeOf(id)), /not open yet/);
    assert.equal((await people(id)).length, 1);
  });
});

describe('a player with no public name yet', () => {
  test('gets one from the name in their settings, as on the Play page, and joins', async () => {
    const { openTable, joinByCode, codeOf, db } = await fresh();
    const { id } = await openTable(1);
    const alex = await makePlayer(db, { name: 'Alex Rivera' });
    await joinByCode(alex, await codeOf(id));
    const { rows: [profile] } = await db.query(`SELECT public_name FROM public.profiles WHERE id = $1`, [alex.id]);
    assert.equal(profile.public_name, 'Alex Rivera');
    const { rows } = await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 AND user_id = $2`, [id, alex.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].participant_name, 'Alex Rivera');
  });

  test('with no usable name is asked to choose one first, and no seat is made', async () => {
    const { openTable, joinByCode, codeOf, people, db } = await fresh();
    const { id } = await openTable(1);
    const nameless = await makePlayer(db, { name: null });
    await assert.rejects(async () => joinByCode(nameless, await codeOf(id)), /Choose a display name first/);
    assert.equal((await people(id)).length, 1);
  });
});

describe('private drafts are unchanged', () => {
  test('a signed-in player joins a private draft with its code', async () => {
    const { mk, joinByCode, privateDraft, people, draft } = await fresh();
    const host = await mk('Host');
    const { id, code } = await privateDraft(host);
    const friend = await mk('Friend');
    const [row] = await joinByCode(friend, code, 'Friend');
    assert.equal(row.draft_id, id);
    assert.equal((await people(id)).length, 2);
    assert.equal((await draft(id)).lobby_visibility, 'private');
  });

  test('a guest joins a private draft with its code, under the name they typed', async () => {
    const { mk, joinByCode, privateDraft, people } = await fresh();
    const host = await mk('Host');
    const { id, code } = await privateDraft(host);
    const guestId = uuid();
    const [row] = await joinByCode(null, code, 'Guest Gary', guestId);
    assert.equal(row.draft_id, id);
    const mine = (await people(id)).find((p) => p.guest_participant_id === guestId);
    assert.ok(mine);
    assert.equal(mine.participant_name, 'Guest Gary');
    assert.equal(mine.user_id, null);
  });

  test('a code nobody has is refused', async () => {
    const { mk, joinByCode } = await fresh();
    const p = await mk();
    await assert.rejects(async () => joinByCode(p, 'ZZZZZZZZ'), /Invalid invite code/);
  });
});
