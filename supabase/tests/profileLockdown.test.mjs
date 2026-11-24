// Tests for the email lockdown: the three safe read functions, closing the profiles table, and the rule that
// stops anyone from adding themselves to someone else's league.
//
//   supabase/migrations/20261123130000_profile_read_functions.sql   (the functions)
//   supabase/migrations/20261123140000_league_members_creator_only_insert.sql
//   supabase/migrations/20261123150000_profiles_read_own_row_only.sql   (closes the table)
//
// The tables, row-level rules and grants below copy what the LIVE database has (read from the live policies on
// 2026-11-23), so the "before" tests show the real problem and the "after" tests show it gone.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newDb, makePlayer, makeDraft, actAs, rpc, uuid, readMigration, extractAnyFunction,
} from './helpers.mjs';

const FUNCTIONS = '20261123130000_profile_read_functions.sql';
const LEAGUE_JOIN = '20261123140000_league_members_creator_only_insert.sql';
const TIGHTEN = '20261123150000_profiles_read_own_row_only.sql';

// ── A copy of the live league tables, policies and grants ───────────────────────────────────────────────────────

const LEAGUE_SCHEMA = `
  CREATE TYPE league_member_role AS ENUM ('admin', 'member');
  CREATE TYPE league_invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

  CREATE TABLE public.leagues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    admin_id uuid NOT NULL
  );
  CREATE TABLE public.league_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    role league_member_role NOT NULL DEFAULT 'member',
    joined_at timestamptz DEFAULT now(),
    UNIQUE (league_id, user_id)
  );
  CREATE TABLE public.league_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    content text NOT NULL DEFAULT 'hi',
    created_at timestamptz DEFAULT now()
  );
  CREATE TABLE public.league_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    invited_by uuid,
    invited_email text,
    invited_user_id uuid,
    status league_invite_status NOT NULL DEFAULT 'pending',
    expires_at timestamptz DEFAULT now() + interval '7 days'
  );
`;

// The live rules (policy names and tests copied from pg_policies), and the table grants Supabase gives by default.
const LEAGUE_RULES = `
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can view any profile" ON public.profiles FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

  ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = admin_id);
  CREATE POLICY "League admin can view leagues they created" ON public.leagues FOR SELECT USING (admin_id = auth.uid());
  CREATE POLICY "League members can view their leagues" ON public.leagues FOR SELECT USING (public.is_league_member(id));

  ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "League members can view other members" ON public.league_members FOR SELECT USING (public.is_league_member(league_id));
  CREATE POLICY "Users can insert themselves as members" ON public.league_members FOR INSERT WITH CHECK (user_id = auth.uid());

  ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Invited user can view their own invites" ON public.league_invites FOR SELECT USING (
    invited_user_id = auth.uid()
    OR invited_email = (SELECT profiles.email FROM public.profiles WHERE profiles.id = auth.uid())
    OR invited_by = auth.uid()
    OR public.is_league_member(league_id)
  );

  -- The two live standings views belong to the table owner and are not security_invoker, so they read profiles
  -- as the owner. (A trimmed copy: names only.)
  CREATE VIEW public.league_standings AS
    SELECT lm.league_id, lm.user_id, p.name AS display_name, p.avatar_url AS photo_url
    FROM public.league_members lm JOIN public.profiles p ON p.id = lm.user_id;
  GRANT SELECT ON public.league_standings TO anon, authenticated;
`;

async function setup() {
  const db = await newDb({ publicPlay: true });
  await db.exec(LEAGUE_SCHEMA);
  const leagueSql = readMigration('20260513140000_fix_leagues_rls_recursion.sql');
  await db.exec(extractAnyFunction(leagueSql, 'is_league_member'));
  await db.exec(LEAGUE_RULES);
  await db.exec(readMigration(FUNCTIONS));
  return db;
}

/** Run something as the signed-in database role (so the row-level rules apply), as this person. */
async function asUser(db, who, fn, role = 'authenticated') {
  await actAs(db, who);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
  }
}

const q = (db, sql, args = []) => db.query(sql, args).then((r) => r.rows);

async function person(db, name, extra = {}) {
  const p = await makePlayer(db, { name, email: `${name.toLowerCase().replace(/\W+/g, '.')}.${uuid().slice(0, 4)}@example.test`, ...extra });
  if (extra.avatar) await q(db, `UPDATE public.profiles SET avatar_url = $2 WHERE id = $1`, [p.id, extra.avatar]);
  return p;
}

async function newLeague(db, admin, name = 'The League', members = []) {
  const id = uuid();
  await q(db, `INSERT INTO public.leagues (id, name, admin_id) VALUES ($1, $2, $3)`, [id, name, admin.id]);
  await q(db, `INSERT INTO public.league_members (league_id, user_id, role) VALUES ($1, $2, 'admin')`, [id, admin.id]);
  for (const m of members) await q(db, `INSERT INTO public.league_members (league_id, user_id) VALUES ($1, $2)`, [id, m.id]);
  return id;
}

// ── 1. get_league_profiles ──────────────────────────────────────────────────────────────────────────────────────

describe('get_league_profiles: people in a league you are in', () => {
  let db;
  before(async () => { db = await setup(); });

  test('a member sees every member: name, avatar and email, and nothing else', async () => {
    const a = await person(db, 'Ann', { avatar: 'https://img/ann.png' });
    const b = await person(db, 'Ben');
    const c = await person(db, 'Cy');
    const league = await newLeague(db, a, 'Trio', [b, c]);

    const rows = await asUser(db, b, () => rpc(db, 'get_league_profiles', league));
    assert.equal(rows.length, 3);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['avatar_url', 'email', 'name', 'user_id'], 'only the columns the screens need');
    const ann = rows.find((r) => r.user_id === a.id);
    assert.equal(ann.name, 'Ann');
    assert.equal(ann.avatar_url, 'https://img/ann.png');
    assert.equal(ann.email, a.email, 'league mates keep each other emails: the draft invite screens need them');
  });

  test('a signed-in stranger gets nothing, for a real league or one that does not exist', async () => {
    const a = await person(db, 'Ann2');
    const stranger = await person(db, 'Stranger');
    const league = await newLeague(db, a, 'Private league');
    assert.deepEqual(await asUser(db, stranger, () => rpc(db, 'get_league_profiles', league)), []);
    assert.deepEqual(await asUser(db, stranger, () => rpc(db, 'get_league_profiles', uuid())), []);
  });

  test('signed out: nothing, and the signed-out database role cannot call it at all', async () => {
    const a = await person(db, 'Ann3');
    const league = await newLeague(db, a);
    assert.deepEqual(await asUser(db, null, () => rpc(db, 'get_league_profiles', league)), []);
    await assert.rejects(asUser(db, null, () => rpc(db, 'get_league_profiles', league), 'anon'), /permission denied/);
  });

  test('only that league: people in your other leagues are not included', async () => {
    const a = await person(db, 'Ann4');
    const b = await person(db, 'Ben4');
    const other = await person(db, 'Other4');
    const mine = await newLeague(db, a, 'Mine', [b]);
    await newLeague(db, other, 'Theirs', [b]);
    const rows = await asUser(db, a, () => rpc(db, 'get_league_profiles', mine));
    assert.deepEqual(rows.map((r) => r.user_id).sort(), [a.id, b.id].sort());
  });

  test('someone who posted and then left keeps their name and picture on old messages, with no email', async () => {
    const a = await person(db, 'Ann5');
    const left = await person(db, 'Lefty', { avatar: 'https://img/lefty.png' });
    const quiet = await person(db, 'Quiet');
    const league = await newLeague(db, a, 'Chatty', [left, quiet]);
    await q(db, `INSERT INTO public.league_messages (league_id, user_id) VALUES ($1, $2)`, [league, left.id]);
    await q(db, `DELETE FROM public.league_members WHERE league_id = $1 AND user_id = ANY($2)`, [league, [left.id, quiet.id]]);

    const rows = await asUser(db, a, () => rpc(db, 'get_league_profiles', league));
    const lefty = rows.find((r) => r.user_id === left.id);
    assert.equal(lefty.name, 'Lefty');
    assert.equal(lefty.avatar_url, 'https://img/lefty.png');
    assert.equal(lefty.email, null, 'a person who is no longer in the league is a name and a picture, never an email');
    assert.ok(!rows.some((r) => r.user_id === quiet.id), 'someone who left without posting is not listed at all');
  });

  test('a person who has left cannot keep reading the league', async () => {
    const a = await person(db, 'Ann6');
    const gone = await person(db, 'Gone');
    const league = await newLeague(db, a, 'Closed', [gone]);
    await q(db, `DELETE FROM public.league_members WHERE league_id = $1 AND user_id = $2`, [league, gone.id]);
    assert.deepEqual(await asUser(db, gone, () => rpc(db, 'get_league_profiles', league)), []);
  });
});

// ── 2. get_draft_people ─────────────────────────────────────────────────────────────────────────────────────────

describe('get_draft_people: the people in a draft you are in', () => {
  let db;
  before(async () => { db = await setup(); });

  async function draftOf(names, { isPublic = false } = {}) {
    const d = await makeDraft(db, { players: names.map((name) => ({ name })), referee: false });
    for (const p of d.players) {
      await q(db, `UPDATE public.profiles SET email = $2, avatar_url = $3 WHERE id = $1`,
        [p.userId, `${p.name.toLowerCase()}@example.test`, `https://img/${p.name}.png`]);
    }
    // A public table must have the referee on and a clock (a rule of the live database).
    if (isPublic) {
      await q(db, `UPDATE public.drafts SET lobby_visibility = 'public', referee_enabled = true, pick_clock_seconds = 60 WHERE id = $1`, [d.draftId]);
    }
    return d;
  }
  const asPlayer = (d, name) => ({ id: d.players.find((p) => p.name === name).userId });

  test('a private draft: the people in it get each other\'s avatar and email, and nothing else', async () => {
    const d = await draftOf(['Pat', 'Quinn', 'Rae']);
    const rows = await asUser(db, asPlayer(d, 'Quinn'), () => rpc(db, 'get_draft_people', d.draftId));
    assert.equal(rows.length, 3);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['avatar_url', 'email', 'user_id']);
    const pat = rows.find((r) => r.user_id === asPlayer(d, 'Pat').id);
    assert.equal(pat.email, 'pat@example.test');
    assert.equal(pat.avatar_url, 'https://img/Pat.png');
  });

  test('a public table never returns an email: avatars only, decided by the server', async () => {
    const d = await draftOf(['Sam', 'Tia'], { isPublic: true });
    const rows = await asUser(db, asPlayer(d, 'Sam'), () => rpc(db, 'get_draft_people', d.draftId));
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.email, null, 'strangers must not see each other\'s addresses');
      assert.ok(r.avatar_url);
    }
  });

  test('someone who is not in the draft gets nothing, even though they are signed in', async () => {
    const d = await draftOf(['Uma', 'Vic']);
    const stranger = await person(db, 'Nosy');
    assert.deepEqual(await asUser(db, stranger, () => rpc(db, 'get_draft_people', d.draftId)), []);
    const pub = await draftOf(['Wes', 'Xan'], { isPublic: true });
    assert.deepEqual(await asUser(db, stranger, () => rpc(db, 'get_draft_people', pub.draftId)), []);
  });

  test('the owner can read it even when not seated, and bots (no account) are not listed', async () => {
    const d = await draftOf(['Zed', 'Ann7']);
    await q(db, `INSERT INTO public.draft_participants (draft_id, participant_name, is_ai) VALUES ($1, 'Robo2', true)`, [d.draftId]);
    const rows = await asUser(db, asPlayer(d, 'Zed'), () => rpc(db, 'get_draft_people', d.draftId));
    assert.equal(rows.length, 2, 'the two people, not the bot');

    // Take the owner's own seat away: they still own the draft, so they can still read who is in it.
    await q(db, `DELETE FROM public.draft_participants WHERE draft_id = $1 AND user_id = $2`, [d.draftId, d.ownerId]);
    const owned = await asUser(db, { id: d.ownerId }, () => rpc(db, 'get_draft_people', d.draftId));
    assert.deepEqual(owned.map((r) => r.user_id), [asPlayer(d, 'Ann7').id]);
  });

  test('signed out: nothing, and the signed-out database role cannot call it', async () => {
    const d = await draftOf(['Abe', 'Bea']);
    assert.deepEqual(await asUser(db, null, () => rpc(db, 'get_draft_people', d.draftId)), []);
    await assert.rejects(asUser(db, null, () => rpc(db, 'get_draft_people', d.draftId), 'anon'), /permission denied/);
  });
});

// ── 3. get_my_league_inviters ───────────────────────────────────────────────────────────────────────────────────

describe('get_my_league_inviters: who invited me', () => {
  let db;
  before(async () => { db = await setup(); });

  test('returns the names (only the names) of people with a pending invite to you', async () => {
    const inviter = await person(db, 'Inviter');
    const other = await person(db, 'Bystander');
    const me = await person(db, 'Me');
    const league = await newLeague(db, inviter, 'Invite league');
    await q(db, `INSERT INTO public.league_invites (league_id, invited_by, invited_user_id) VALUES ($1, $2, $3)`, [league, inviter.id, me.id]);
    // an invite meant for somebody else, and one that was already answered
    await q(db, `INSERT INTO public.league_invites (league_id, invited_by, invited_user_id) VALUES ($1, $2, $3)`, [league, other.id, uuid()]);
    const answered = await person(db, 'AnsweredInviter');
    await q(db, `INSERT INTO public.league_invites (league_id, invited_by, invited_user_id, status) VALUES ($1, $2, $3, 'declined')`, [league, answered.id, me.id]);

    const rows = await asUser(db, me, () => rpc(db, 'get_my_league_inviters'));
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['name', 'user_id']);
    assert.equal(rows[0].name, 'Inviter');
    assert.equal(rows[0].user_id, inviter.id);
  });

  test('signed out or never invited: nothing; signed-out role cannot call it', async () => {
    const me = await person(db, 'Lonely');
    assert.deepEqual(await asUser(db, me, () => rpc(db, 'get_my_league_inviters')), []);
    assert.deepEqual(await asUser(db, null, () => rpc(db, 'get_my_league_inviters')), []);
    await assert.rejects(asUser(db, null, () => rpc(db, 'get_my_league_inviters'), 'anon'), /permission denied/);
  });
});

// ── 4. closing the profiles table ───────────────────────────────────────────────────────────────────────────────

describe('closing the profiles table', () => {
  let db, ann, ben, cy, league, draft;
  before(async () => {
    db = await setup();
    ann = await person(db, 'AnnT', { avatar: 'https://img/annT.png' });
    ben = await person(db, 'BenT');
    cy = await person(db, 'CyT');
    league = await newLeague(db, ann, 'Tight league', [ben]);
    draft = await makeDraft(db, { players: [{ name: 'DrafterOne' }, { name: 'DrafterTwo' }], referee: false });
    await q(db, `UPDATE public.profiles SET email = 'drafter.one@example.test' WHERE id = $1`, [draft.players[0].userId]);
  });

  const emailsSeenBy = (who) => asUser(db, who, () => q(db, `SELECT id, email FROM public.profiles`));

  test('BEFORE: any signed-in stranger can read everyone\'s email straight from the table (the problem)', async () => {
    const rows = await emailsSeenBy(cy);
    assert.ok(rows.length >= 4);
    assert.ok(rows.some((r) => r.id === ann.id && r.email === ann.email), 'a stranger reads Ann\'s email');
  });

  test('the migration refuses to run before the read functions exist', async () => {
    const bare = await newDb({ referee: false });
    await assert.rejects(bare.exec(readMigration(TIGHTEN)), /Run 20261123130000_profile_read_functions\.sql first/);
  });

  test('AFTER: a signed-in person reads only their own row, and no one else\'s email', async () => {
    await db.exec(readMigration(TIGHTEN));
    const mine = await emailsSeenBy(cy);
    assert.deepEqual(mine.map((r) => r.id), [cy.id]);
    assert.equal(mine[0].email, cy.email);

    const asked = await asUser(db, cy, () => q(db, `SELECT email FROM public.profiles WHERE id = $1`, [ann.id]));
    assert.deepEqual(asked, [], 'asking for a specific person by id finds nothing');
    const byEmail = await asUser(db, cy, () => q(db, `SELECT id FROM public.profiles WHERE email = $1`, [ann.email]));
    assert.deepEqual(byEmail, [], 'and so does searching by their email');
    const byName = await asUser(db, cy, () => q(db, `SELECT id FROM public.profiles WHERE name ILIKE '%Ann%'`));
    assert.deepEqual(byName, [], 'or by their name');
  });

  test('AFTER: the signed-out role still sees nothing', async () => {
    assert.deepEqual(await asUser(db, null, () => q(db, `SELECT id FROM public.profiles`), 'anon'), []);
  });

  test('AFTER: the three functions still work for the people who should see things', async () => {
    const members = await asUser(db, ben, () => rpc(db, 'get_league_profiles', league));
    assert.deepEqual(members.map((r) => r.name).sort(), ['AnnT', 'BenT']);
    assert.equal(members.find((r) => r.user_id === ann.id).email, ann.email);

    const people = await asUser(db, { id: draft.players[1].userId }, () => rpc(db, 'get_draft_people', draft.draftId));
    assert.equal(people.length, 2);
    assert.equal(people.find((r) => r.user_id === draft.players[0].userId).email, 'drafter.one@example.test');

    // a stranger still gets nothing from them
    assert.deepEqual(await asUser(db, cy, () => rpc(db, 'get_league_profiles', league)), []);
    assert.deepEqual(await asUser(db, cy, () => rpc(db, 'get_draft_people', draft.draftId)), []);
  });

  test('AFTER: your own profile still reads and saves, and you cannot edit someone else\'s', async () => {
    await asUser(db, ben, () => q(db, `UPDATE public.profiles SET name = 'Benny' WHERE id = $1`, [ben.id]));
    assert.equal((await q(db, `SELECT name FROM public.profiles WHERE id = $1`, [ben.id]))[0].name, 'Benny');
    await asUser(db, ben, () => q(db, `UPDATE public.profiles SET name = 'Hacked' WHERE id = $1`, [ann.id]));
    assert.equal((await q(db, `SELECT name FROM public.profiles WHERE id = $1`, [ann.id]))[0].name, 'AnnT');
  });

  test('AFTER: a league invite sent to your email address is still matched to you (that rule reads only your own row)', async () => {
    const invitee = await person(db, 'EmailInvitee');
    await q(db, `INSERT INTO public.league_invites (league_id, invited_by, invited_email) VALUES ($1, $2, $3)`, [league, ann.id, invitee.email]);
    const mine = await asUser(db, invitee, () => q(db, `SELECT id FROM public.league_invites`));
    assert.equal(mine.length, 1);
    const stranger = await asUser(db, cy, () => q(db, `SELECT id FROM public.league_invites`));
    assert.equal(stranger.length, 0);
  });

  test('AFTER: the standings views (owned by the table owner) still show names for league members', async () => {
    const rows = await asUser(db, ben, () => q(db, `SELECT display_name FROM public.league_standings WHERE league_id = $1`, [league]));
    assert.ok(rows.some((r) => r.display_name === 'AnnT'));
  });

  test('running it a second time changes nothing and does not fail', async () => {
    await db.exec(readMigration(TIGHTEN));
    const policies = await q(db, `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT' ORDER BY 1`);
    assert.deepEqual(policies.map((p) => p.policyname), ['Users can view their own profile']);
  });
});

// ── 5. only a league's creator can add themselves ───────────────────────────────────────────────────────────────

describe('league_members: nobody can add themselves to someone else\'s league', () => {
  let db, owner, stranger, league;
  before(async () => {
    db = await setup();
    owner = await person(db, 'Owner');
    stranger = await person(db, 'Intruder');
    league = await newLeague(db, owner, 'Locked league');
  });

  const joinAs = (who, leagueId, role = 'member') =>
    asUser(db, who, () => q(db, `INSERT INTO public.league_members (league_id, user_id, role) VALUES ($1, $2, $3)`, [leagueId, who.id, role]));

  test('BEFORE: any signed-in person can add themselves to any league (the back door)', async () => {
    await joinAs(stranger, league);
    const rows = await asUser(db, stranger, () => rpc(db, 'get_league_profiles', league));
    assert.equal(rows.length, 2, 'and so reads the whole league, emails included');
    await q(db, `DELETE FROM public.league_members WHERE league_id = $1 AND user_id = $2`, [league, stranger.id]);
  });

  test('AFTER: the intruder is turned away, and still sees nothing', async () => {
    await db.exec(readMigration(LEAGUE_JOIN));
    await assert.rejects(joinAs(stranger, league), /row-level security/);
    await assert.rejects(joinAs(stranger, league, 'admin'), /row-level security/);
    assert.deepEqual(await asUser(db, stranger, () => rpc(db, 'get_league_profiles', league)), []);
  });

  test('AFTER: a league\'s creator can still add themselves as its first member (what createLeague does)', async () => {
    const creator = await person(db, 'Founder');
    const id = uuid();
    await asUser(db, creator, async () => {
      await q(db, `INSERT INTO public.leagues (id, name, admin_id) VALUES ($1, 'New league', $2)`, [id, creator.id]);
      await q(db, `INSERT INTO public.league_members (league_id, user_id, role) VALUES ($1, $2, 'admin')`, [id, creator.id]);
    });
    const rows = await asUser(db, creator, () => rpc(db, 'get_league_profiles', id));
    assert.equal(rows.length, 1);
  });

  test('AFTER: even in their own league, the creator cannot add somebody else directly', async () => {
    const someoneElse = await person(db, 'Pal');
    await assert.rejects(
      asUser(db, owner, () => q(db, `INSERT INTO public.league_members (league_id, user_id) VALUES ($1, $2)`, [league, someoneElse.id])),
      /row-level security/,
    );
  });

  test('AFTER: joining through the invite functions (which run as the database owner) is not affected', async () => {
    // Same shape as accept_league_invite / accept_league_invite_by_token: SECURITY DEFINER, so the rule above is not applied.
    await db.exec(`
      CREATE FUNCTION public.fake_accept_invite(p_league uuid) RETURNS void
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        INSERT INTO public.league_members (league_id, user_id) VALUES (p_league, auth.uid());
      $$;
      GRANT EXECUTE ON FUNCTION public.fake_accept_invite(uuid) TO authenticated;
    `);
    const invited = await person(db, 'Invited');
    await asUser(db, invited, () => q(db, `SELECT public.fake_accept_invite($1)`, [league]));
    const rows = await asUser(db, invited, () => rpc(db, 'get_league_profiles', league));
    assert.ok(rows.some((r) => r.user_id === invited.id));
  });

  test('running it a second time does not fail and leaves one insert rule', async () => {
    await db.exec(readMigration(LEAGUE_JOIN));
    const rules = await q(db, `SELECT policyname FROM pg_policies WHERE tablename = 'league_members' AND cmd = 'INSERT'`);
    assert.deepEqual(rules.map((r) => r.policyname), ['League creators can add themselves as first member']);
  });
});

// ── 6. the apps: no new direct reads of other people's profiles ─────────────────────────────────────────────────

describe('the apps do not read other people\'s profiles from the table', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    if (f === 'node_modules' || f.startsWith('.')) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'mobile'))]
    .filter((f) => !f.endsWith('integrations/supabase/types.ts'));
  const readsProfiles = (text) => /\.from\(\s*['"`]profiles['"`]\s*\)/.test(text);

  // Every place that still touches the table directly, and why that is fine. A new file showing up here must be
  // a read of YOUR OWN row (or a write); anything about other people goes through a function (see
  // supabase/migrations/20261123130000_profile_read_functions.sql).
  const ALLOWED = new Map([
    ['src/utils/avatarUpload.ts', 'saves your own avatar'],
    ['src/components/AppHeader.tsx', 'your own name and avatar for the header'],
    ['src/hooks/useProfile.ts', 'your own profile'],
    ['src/hooks/useProfileFixer.ts', 'your own name'],
    ['src/pages/Profile.tsx', 'your own profile page'],
    ['src/pages/LeagueSettings.tsx', 'the hidden (switched off) find-people-by-name box; finds nobody once the table is closed'],
    ['mobile/lib/avatar.ts', 'saves your own avatar'],
    ['mobile/app/draft/new.tsx', 'your own name for the host label'],
  ]);

  test('only the known own-row files touch the profiles table', () => {
    const found = files.filter((f) => readsProfiles(readFileSync(f, 'utf8'))).map((f) => relative(root, f)).sort();
    assert.deepEqual(found, [...ALLOWED.keys()].sort());
  });

  test('the league, invite and draft-room screens use the safe functions', () => {
    const read = (p) => readFileSync(join(root, p), 'utf8');
    for (const p of ['src/hooks/useLeagues.ts', 'mobile/hooks/useLeagues.ts']) {
      const t = read(p);
      assert.match(t, /rpc\('get_league_profiles'/, `${p} loads members and authors through get_league_profiles`);
      assert.match(t, /rpc\('get_my_league_inviters'/, `${p} loads inviter names through get_my_league_inviters`);
    }
    assert.match(read('src/hooks/useMultiplayerDraft.ts'), /rpc\('get_draft_people'/);
    assert.match(read('mobile/hooks/useDraftRoom.ts'), /rpc\("get_draft_people"/);
  });

  test('the website and mobile copies of the league hooks stay identical apart from their imports', () => {
    const strip = (t) => t.split('\n').filter((l) => !/^import .* from /.test(l)).join('\n');
    assert.equal(strip(readFileSync(join(root, 'src/hooks/useLeagues.ts'), 'utf8')), strip(readFileSync(join(root, 'mobile/hooks/useLeagues.ts'), 'utf8')));
  });
});
