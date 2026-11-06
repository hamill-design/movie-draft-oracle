import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, makePlayer, actAs, setMode, rpcJson, uuid } from './helpers.mjs';

let n = 0;
const nm = (b) => `${b} ${++n}`;

/**
 * Invite people to a draft. An open seat is a button; the host adds an email and the invitation HOLDS the seat.
 * On a public table the held seat shows as "Invited" (never the email), strangers can't take it, the invited
 * person takes it by joining, and any seat still held when the host starts the draft is released (bots take it). Private drafts use the same function.
 */
async function fresh() {
  const db = await newDb({ publicPlay: true });
  await setMode(db, 'on');
  const mk = (b = 'Player', opts = {}) => makePlayer(db, { publicName: nm(b), ...opts });
  const call = async (who, fn, ...args) => { await actAs(db, who); return rpcJson(db, fn, ...args); };
  const people = async (id) => (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 ORDER BY joined_at NULLS LAST, created_at`, [id])).rows;
  const held = async (id) => (await people(id)).filter((p) => !p.user_id && !p.is_ai);
  const humans = async (id) => (await people(id)).filter((p) => p.user_id && !p.is_ai);
  const bots = async (id) => (await people(id)).filter((p) => p.is_ai);
  const draft = async (id) => (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];
  const started = async (id) => Array.isArray((await draft(id)).turn_order) && (await draft(id)).turn_order.length > 0;
  const notes = async (uid, type) => (await db.query(`SELECT * FROM public.notifications WHERE user_id = $1 AND type = $2`, [uid, type])).rows;
  const here = (id, who) => db.query(`UPDATE public.draft_participants SET last_seen_at = now() WHERE draft_id = $1 AND user_id = $2`, [id, who.id]);
  const ageInvites = (id, mins = 6) => db.query(`UPDATE public.draft_participants SET created_at = now() - ($2 || ' minutes')::interval WHERE draft_id = $1 AND user_id IS NULL AND NOT is_ai`, [id, String(mins)]);
  const sweepQuick = () => rpcJson(db, 'referee_sweep_quick_match');

  async function quickPlay(who) {
    const j = await call(who, 'quick_join');
    const id = j.found ? j.draft_id : (await call(who, 'quick_start')).draft_id;
    await here(id, who);
    return id;
  }
  async function lobbyOf(count) {
    const players = [];
    let id;
    for (let i = 0; i < count; i++) { const p = await mk(); players.push(p); id = await quickPlay(p); }
    return { players, id };
  }
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
  /** A private draft the host owns, with `others` already in it. */
  async function privateDraft(host, others = []) {
    const id = uuid();
    await db.query(`INSERT INTO public.drafts (id, user_id, title) VALUES ($1, $2, 'Friends draft')`, [id, host.id]);
    await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, is_host, joined_at) VALUES ($1, $2, $3, 'joined', true, now())`, [id, host.id, 'Host']);
    for (const o of others) {
      await db.query(`INSERT INTO public.draft_participants (draft_id, user_id, participant_name, status, joined_at) VALUES ($1, $2, $3, 'joined', now())`, [id, o.id, `Guest ${++n}`]);
    }
    return id;
  }
  return { db, mk, call, people, held, humans, bots, draft, started, notes, here, ageInvites, sweepQuick, quickPlay, lobbyOf, openTable, privateDraft };
}

describe('a held seat on a public table', () => {
  test('inviting an email holds a seat: counted, no account on it, shown to everyone as "Invited"', async () => {
    const { openTable, call, held, people } = await fresh();
    const { players: [host, guest], id } = await openTable(2, { size: 4 });
    const r = await call(host, 'invite_to_draft', id, ['friend@example.test']);
    assert.deepEqual(r.invited, [{ email: 'friend@example.test', has_account: false }]);
    assert.equal(r.seats_left, 1, '4 seats: host, one player, one held, one open');
    const [seat] = await held(id);
    assert.equal(seat.status, 'invited');
    assert.equal(seat.user_id, null);
    assert.equal(seat.invited_email, 'friend@example.test');
    assert.equal((await people(id)).length, 3);

    const asGuest = await call(guest, 'get_table_info', id);
    const tile = asGuest.participants.find((p) => p.status === 'invited');
    assert.equal(tile.name, 'Invited');
    assert.equal(tile.email, null, 'strangers never see an email');
    assert.equal(tile.participant_id, null);
    assert.ok(!JSON.stringify(asGuest).includes('friend@example.test'));
  });

  test('the host sees who the seat is held for, and can take the invitation back', async () => {
    const { openTable, call, held } = await fresh();
    const { players: [host], id } = await openTable(1);
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    const info = await call(host, 'get_table_info', id);
    const tile = info.participants.find((p) => p.status === 'invited');
    assert.equal(tile.email, 'friend@example.test');
    assert.ok(tile.participant_id);
    const r = await call(host, 'revoke_draft_invite', id, tile.participant_id);
    assert.equal(r.revoked, true);
    assert.equal((await held(id)).length, 0);
    const after = await call(host, 'get_table_info', id);
    assert.equal(after.participants.filter((p) => p.status === 'invited').length, 0);
  });

  test('only the host can invite or take an invitation back', async () => {
    const { openTable, call } = await fresh();
    const { players: [host, guest], id } = await openTable(2);
    await assert.rejects(() => call(guest, 'invite_to_draft', id, ['friend@example.test']), /Only the host/);
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    const tile = (await call(host, 'get_table_info', id)).participants.find((p) => p.status === 'invited');
    await assert.rejects(() => call(guest, 'revoke_draft_invite', id, tile.participant_id), /Only the host/);
    await assert.rejects(() => call(null, 'invite_to_draft', id, ['x@example.test']), /Sign in/);
  });

  test('a seated player cannot be "taken back", only an unused invitation', async () => {
    const { openTable, call, people } = await fresh();
    const { players: [host], id } = await openTable(2);
    const other = (await people(id)).find((p) => !p.is_host);
    await assert.rejects(() => call(host, 'revoke_draft_invite', id, other.id), /taken/);
  });

  test('strangers cannot take a held seat: joining and Quick Match both see the table as full', async () => {
    const { openTable, lobbyOf, call, mk } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 2 });
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    const stranger = await mk();
    await assert.rejects(() => call(stranger, 'join_public_table', id), /full/);

    const lobby = await lobbyOf(1);
    await call(lobby.players[0], 'invite_to_draft', lobby.id, ['a@example.test', 'b@example.test', 'c@example.test']);
    const late = await mk();
    const j = await call(late, 'quick_join');
    assert.equal(j.found, false, 'a lobby whose seats are all held is not offered');
  });

  test('more invitations than open seats: the extras are turned away with a reason', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 3 });
    const r = await call(host, 'invite_to_draft', id, ['a@example.test', 'b@example.test', 'c@example.test']);
    assert.equal(r.invited.length, 2);
    assert.deepEqual(r.rejected.map((x) => x.reason), ['full']);
    assert.equal(r.seats_left, 0);
  });

  test('bad addresses, repeats, the host and people already seated are not invited again', async () => {
    const { openTable, call, held, mk } = await fresh();
    const { players: [host, guest], id } = await openTable(2);
    const r1 = await call(host, 'invite_to_draft', id, ['not-an-email', ' Friend@Example.test ']);
    assert.deepEqual(r1.rejected, [{ email: 'not-an-email', reason: 'invalid' }]);
    assert.deepEqual(r1.invited.map((x) => x.email), ['friend@example.test'], 'cleaned up and lower-cased');
    const r2 = await call(host, 'invite_to_draft', id, ['friend@example.test', host.email, guest.email]);
    assert.deepEqual(r2.invited, []);
    assert.equal(r2.already.length, 3);
    assert.equal((await held(id)).length, 1);
    assert.ok(mk);
  });

  test('someone with an account is told, and the bell links to the table', async () => {
    const { openTable, call, mk, notes } = await fresh();
    const { players: [host], id } = await openTable(1);
    const friend = await mk('Friend');
    const r = await call(host, 'invite_to_draft', id, [friend.email]);
    assert.equal(r.invited[0].has_account, true);
    const [note] = await notes(friend.id, 'draft_invite');
    assert.ok(note.link.includes(`/play?join=${id}`));
  });

  test('a lot of invitations in an hour is slowed down', async () => {
    const { openTable, call } = await fresh();
    const { players: [host], id } = await openTable(1);
    for (let i = 0; i < 30; i++) {
      await call(host, 'invite_to_draft', id, [`f${i}@example.test`]);
      const tile = (await call(host, 'get_table_info', id)).participants.find((p) => p.status === 'invited');
      await call(host, 'revoke_draft_invite', id, tile.participant_id);
    }
    await assert.rejects(() => call(host, 'invite_to_draft', id, ['one-more@example.test']), /lot of invitations/);
  });

  test('no invitations once the draft has started', async () => {
    const { lobbyOf, call } = await fresh();
    const { players: [host], id } = await lobbyOf(1);
    await call(host, 'start_public_table', id, true);
    await assert.rejects(() => call(host, 'invite_to_draft', id, ['late@example.test']), /already started/);
  });
});

describe('the invited person takes the seat', () => {
  test('joining swaps the held seat for a real one: no extra seat is used, and they get their public name', async () => {
    const { openTable, call, mk, people, held, humans } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 2 });
    const friend = await mk('Friend');
    await call(host, 'invite_to_draft', id, [friend.email]);
    assert.equal((await people(id)).length, 2);
    const r = await call(friend, 'join_public_table', id);
    assert.equal(r.claimed_invite, true);
    assert.equal((await people(id)).length, 2, 'still two seats');
    assert.equal((await held(id)).length, 0);
    const row = (await humans(id)).find((p) => p.user_id === friend.id);
    assert.equal(row.status, 'joined');
    assert.equal(row.invited_email, null);
    const info = await call(friend, 'get_table_info', id);
    assert.match(info.participants.find((p) => p.is_me).name, /^Friend \d+$/);
  });

  test('a seat held for someone with no account yet is theirs once they sign up with that email', async () => {
    const { openTable, call, db, held, humans } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 2 });
    await call(host, 'invite_to_draft', id, ['newbie@example.test']);
    assert.equal((await held(id)).length, 1);
    const newbie = await makePlayer(db, { publicName: nm('Newbie'), email: 'newbie@example.test' });
    const r = await call(newbie, 'join_public_table', id);
    assert.equal(r.claimed_invite, true);
    assert.equal((await held(id)).length, 0);
    assert.ok((await humans(id)).some((p) => p.user_id === newbie.id));
  });

  test('the email match ignores capital letters', async () => {
    const { openTable, call, db, humans } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 2 });
    await call(host, 'invite_to_draft', id, ['Mixed.Case@Example.test']);
    const p = await makePlayer(db, { publicName: nm('Mixed'), email: 'MIXED.case@example.TEST' });
    await call(p, 'join_public_table', id);
    assert.ok((await humans(id)).some((h) => h.user_id === p.id));
  });

  test('once the seat is taken the table is full again for strangers', async () => {
    const { openTable, call, mk } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 2 });
    const friend = await mk('Friend');
    await call(host, 'invite_to_draft', id, [friend.email]);
    await call(friend, 'join_public_table', id);
    const stranger = await mk();
    await assert.rejects(() => call(stranger, 'join_public_table', id), /full/);
  });

  test('a held seat does not let someone in who is blocked from the table', async () => {
    const { openTable, call, mk, db } = await fresh();
    const { players: [host], id } = await openTable(1, { size: 3 });
    const friend = await mk('Friend');
    await call(host, 'invite_to_draft', id, [friend.email]);
    await db.query(`INSERT INTO public.player_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [host.id, friend.id]);
    await assert.rejects(() => call(friend, 'join_public_table', id), /isn't available/);
  });
});

describe('the host starts a table that has invitations out', () => {
  test('nothing starts by itself while a friend is on their way (however old the invitation); the host\'s Start releases the held seats and bots fill them', async () => {
    const { lobbyOf, call, mk, started, held, bots, humans, notes, sweepQuick, ageInvites } = await fresh();
    const { players: [host], id } = await lobbyOf(2);
    const friend = await mk('Friend');
    await call(host, 'invite_to_draft', id, [friend.email, 'other@example.test']);
    assert.equal((await held(id)).length, 2);
    await ageInvites(id, 60);
    assert.equal((await sweepQuick()).started, 0);
    assert.equal(await started(id), false, 'a full table with friends invited still waits for its host');

    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'started', 'both people are in the lobby, so there is nobody to check');
    assert.equal(await started(id), true);
    assert.equal((await held(id)).length, 0, 'the held seats are released');
    assert.equal((await humans(id)).length, 2);
    assert.equal((await bots(id)).length, 2, 'and bots take them');
    assert.equal((await notes(friend.id, 'removed_from_table')).length, 1, 'the friend with an account is told');
  });

  test('a friend who arrives before Start has the seat, and no bot takes it', async () => {
    const { lobbyOf, call, mk, started, held, bots, humans, here } = await fresh();
    const { players: [host], id } = await lobbyOf(2);
    const friend = await mk('Friend');
    await call(host, 'invite_to_draft', id, [friend.email]);
    await call(friend, 'join_public_table', id);
    await here(id, friend);
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'started');
    assert.equal(await started(id), true);
    assert.equal((await held(id)).length, 0);
    assert.equal((await humans(id)).length, 3);
    assert.equal((await bots(id)).length, 1);
  });

  test('to play with exactly the people who came, the host takes the invitation back and the empty seat away', async () => {
    const { openTable, call, started, held, bots, humans } = await fresh();
    const { players: [host], id } = await openTable(2, { size: 4 });
    await call(host, 'invite_to_draft', id, ['friend@example.test']);
    const [seat] = await held(id);
    await assert.rejects(() => call(host, 'set_table_settings', id, 2), /can.t go below/, 'the held seat still counts');
    await call(host, 'revoke_draft_invite', id, seat.id);
    await call(host, 'set_table_settings', id, 2);
    const r = await call(host, 'start_public_table', id, true);
    assert.equal(r.status, 'started');
    assert.equal(await started(id), true);
    assert.equal((await held(id)).length, 0);
    assert.equal((await bots(id)).length, 0);
    assert.equal((await humans(id)).length, 2);
  });
});

describe('private drafts use the same invite', () => {
  test('a friend with an account gets a seat in their name; one without gets a held seat; both go on the invite list', async () => {
    const { mk, call, privateDraft, people, draft } = await fresh();
    const host = await mk('Host');
    const id = await privateDraft(host);
    const friend = await mk('Friend');
    const r = await call(host, 'invite_to_draft', id, [friend.email, 'newbie@example.test']);
    assert.equal(r.invited.length, 2);
    const rows = await people(id);
    const f = rows.find((p) => p.user_id === friend.id);
    assert.equal(f.status, 'invited');
    assert.equal(f.invited_email, friend.email);
    const held = rows.find((p) => !p.user_id);
    assert.equal(held.invited_email, 'newbie@example.test');
    assert.equal(held.participant_name, 'newbie', 'a private draft names the seat after the email, as invites always have');
    assert.deepEqual((await draft(id)).participants.sort(), [friend.email, 'newbie@example.test'].sort());
  });

  test('six at most, and only the owner can invite', async () => {
    const { mk, call, privateDraft } = await fresh();
    const host = await mk('Host');
    const others = [];
    for (let i = 0; i < 4; i++) others.push(await mk());
    const id = await privateDraft(host, others);          // five people
    const r = await call(host, 'invite_to_draft', id, ['a@example.test', 'b@example.test']);
    assert.equal(r.invited.length, 1);
    assert.deepEqual(r.rejected.map((x) => x.reason), ['full']);
    await assert.rejects(() => call(others[0], 'invite_to_draft', id, ['c@example.test']), /Only the host/);
  });

  test('taking an invitation back removes the seat and the address from the invite list', async () => {
    const { mk, call, privateDraft, people, draft } = await fresh();
    const host = await mk('Host');
    const id = await privateDraft(host);
    await call(host, 'invite_to_draft', id, ['newbie@example.test']);
    const row = (await people(id)).find((p) => p.invited_email);
    await call(host, 'revoke_draft_invite', id, row.id);
    assert.equal((await people(id)).length, 1);
    assert.deepEqual((await draft(id)).participants, []);
  });

  test('someone already in a private draft (a league member who pre-joined) is not invited again', async () => {
    const { mk, call, privateDraft, people } = await fresh();
    const host = await mk('Host');
    const member = await mk('Member');
    const id = await privateDraft(host, [member]);
    const r = await call(host, 'invite_to_draft', id, [member.email]);
    assert.deepEqual(r.invited, []);
    assert.deepEqual(r.already, [member.email]);
    assert.equal((await people(id)).length, 2);
  });
});

describe('who may call it', () => {
  test('signed-in people only: the invite functions are closed to signed-out visitors', async () => {
    const { db } = await fresh();
    for (const fn of ['invite_to_draft(uuid, text[])', 'revoke_draft_invite(uuid, uuid)']) {
      const r = (await db.query(`SELECT has_function_privilege('anon', 'public.${fn}', 'EXECUTE') AS can`)).rows[0];
      assert.equal(r.can, false, `${fn} must not be callable by anon`);
      const a = (await db.query(`SELECT has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE') AS can`)).rows[0];
      assert.equal(a.can, true);
    }
  });
});
