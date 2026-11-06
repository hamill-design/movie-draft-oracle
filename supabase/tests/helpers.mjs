// Test helpers for the referee SQL.
//
// Builds an in-memory Postgres (PGlite) that looks like the parts of the
// Supabase project the referee touches, then loads:
//   - the REAL can_access_draft()                (from the migration history)
//   - the REAL make_multiplayer_pick_unified()   (from the migration history)
//   - the referee migrations under test
// so the tests prove the referee works alongside the live pick logic.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

export function readMigration(name) {
  return readFileSync(new URL(name, MIGRATIONS), 'utf8');
}

/** Pull one `CREATE OR REPLACE FUNCTION public.<name>(...) ... $function$;` block out of a migration. */
export function extractFunction(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  const open = sql.indexOf('$function$', start);
  const close = sql.indexOf('$function$', open + 10);
  if (open === -1 || close === -1) throw new Error(`could not find body of ${name}`);
  return sql.slice(start, close + '$function$'.length) + ';';
}

const FIXTURE_SCHEMA = `
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;

  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;

  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text, name text, avatar_url text
  );
  CREATE TABLE public.guest_sessions (id uuid PRIMARY KEY);
  CREATE FUNCTION public.set_guest_session_context(uuid) RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;
  CREATE FUNCTION public.generate_invite_code() RETURNS text LANGUAGE sql AS $$
    SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
  $$;

  CREATE TABLE public.drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    guest_session_id uuid,
    title text NOT NULL DEFAULT 'Test draft',
    theme text NOT NULL DEFAULT 'year',
    option text NOT NULL DEFAULT '1999',
    participants text[] NOT NULL DEFAULT '{}',
    categories text[] NOT NULL DEFAULT '{}',
    is_complete boolean DEFAULT false,
    is_multiplayer boolean DEFAULT true,
    current_pick_number integer DEFAULT 1,
    current_turn_user_id uuid,
    current_turn_participant_id uuid,
    turn_order jsonb,
    invite_code text,
    draft_order text[],
    voting_ends_at timestamptz,
    allow_public_voting boolean DEFAULT false,
    is_public boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  CREATE TABLE public.draft_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
    user_id uuid,
    guest_participant_id uuid,
    participant_name text NOT NULL,
    status text DEFAULT 'joined',
    is_host boolean DEFAULT false,
    is_ai boolean DEFAULT false,
    joined_at timestamptz,
    created_at timestamptz DEFAULT now(),
    last_seen_at timestamptz,
    invited_email text,
    UNIQUE (draft_id, participant_name)
  );

  CREATE TABLE public.draft_picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
    player_id integer NOT NULL,
    player_name text NOT NULL,
    movie_id integer NOT NULL,
    movie_title text NOT NULL,
    movie_year integer,
    movie_genre text,
    category text NOT NULL,
    pick_order integer NOT NULL,
    poster_path text,
    calculated_score numeric,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_movie_per_draft UNIQUE (draft_id, movie_id)
  );

  CREATE TABLE public.spec_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    is_hidden boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('draft_invite', 'league_invite', 'upcoming_draft')),
    title text NOT NULL,
    body text,
    link text,
    reference_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}',
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`;

/** A fresh database with the fixture schema, real live functions, and (optionally) the referee migrations. */
export async function newDb({ referee = true, notifications = false, publicPlay = false } = {}) {
  const db = new PGlite();
  await db.exec(FIXTURE_SCHEMA);

  const accessSql = readMigration('20260210104237_add_ai_participants.sql');
  await db.exec(extractFunction(accessSql, 'can_access_draft'));
  const pickSql = readMigration('20260212120000_deterministic_player_id_and_load_draft_order.sql');
  await db.exec(extractFunction(pickSql, 'make_multiplayer_pick_unified'));

  if (publicPlay) { referee = true; notifications = true; }
  if (referee) await db.exec(readMigration('20261104120000_referee_foundation.sql'));
  if (notifications) await db.exec(readMigration('20261104121000_referee_your_turn_notifications.sql'));
  if (publicPlay) await loadPublicPlay(db);
  // Test-the-tests hook: deliberately break the setup (e.g. drop a trigger) and confirm tests fail.
  if (process.env.MUTATE_SQL) await db.exec(process.env.MUTATE_SQL);
  return db;
}

export const uuid = () => crypto.randomUUID();

export async function setAuth(db, userId) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
}

/**
 * Create a draft with players. players: [{ name, ai?: true }]. The first human is the owner.
 * Returns { draftId, ownerId, players: [{ name, rowId, userId, participantId, ai }] }.
 */
export async function makeDraft(db, { players, categories = ['Comedy', 'Drama/Romance'], referee = true, clock = 60 }) {
  const draftId = uuid();
  const rows = players.map((p, i) => ({
    name: p.name,
    ai: !!p.ai,
    userId: p.ai ? null : uuid(),
    rowId: uuid(),
    order: i,
  }));
  const owner = rows.find((r) => !r.ai);

  for (const r of rows) {
    if (r.userId) {
      await db.query(`INSERT INTO auth.users (id) VALUES ($1)`, [r.userId]);
      // The live name trigger (loaded for public-play tests) takes each player's name from their profile.
      await db.query(`INSERT INTO public.profiles (id, name) VALUES ($1, $2)`, [r.userId, r.name]);
    }
  }
  await db.query(
    `INSERT INTO public.drafts (id, user_id, categories, participants) VALUES ($1, $2, $3, $4)`,
    [draftId, owner.userId, categories, rows.map((r) => r.name)]
  );
  for (const r of rows) {
    await db.query(
      `INSERT INTO public.draft_participants (id, draft_id, user_id, participant_name, is_ai, is_host, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval)`,
      [r.rowId, draftId, r.userId, r.name, r.ai, r === owner, String(r.order)]
    );
  }

  if (referee) {
    await setAuth(db, owner.userId);
    await db.query(`SELECT set_draft_referee($1, $2, true, $3)`, [draftId, owner.userId, clock]);
  }

  return {
    draftId,
    ownerId: owner.userId,
    players: rows.map((r) => ({
      name: r.name,
      ai: r.ai,
      userId: r.userId,
      rowId: r.rowId,
      // The id used in turn_order / current_turn_participant_id
      participantId: r.userId ?? r.rowId,
    })),
    categories,
  };
}

/** Do what the real start function does: build a snake turn order and set the first turn. */
export async function startDraft(db, d) {
  const n = d.players.length;
  const order = [];
  let pick = 1;
  d.categories.forEach((_, round) => {
    const idxs = [...Array(n).keys()];
    if (round % 2 === 1) idxs.reverse();
    for (const i of idxs) {
      const p = d.players[i];
      order.push({
        pick_number: pick++,
        round: round + 1,
        participant_id: p.participantId,
        user_id: p.participantId,
        participant_name: p.name,
        player_id: i + 1,
      });
    }
  });
  d.turnOrder = order;
  await db.query(
    `UPDATE public.drafts
       SET turn_order = $2::jsonb, current_pick_number = 1,
           current_turn_user_id = $3, current_turn_participant_id = $3
     WHERE id = $1`,
    [d.draftId, JSON.stringify(order), order[0].participant_id]
  );
}

export const getDraft = async (db, id) =>
  (await db.query(`SELECT * FROM public.drafts WHERE id = $1`, [id])).rows[0];

export const getPicks = async (db, id) =>
  (await db.query(`SELECT * FROM public.draft_picks WHERE draft_id = $1 ORDER BY pick_order`, [id])).rows;

export const getParticipant = async (db, id, name) =>
  (await db.query(`SELECT * FROM public.draft_participants WHERE draft_id = $1 AND participant_name = $2`, [id, name])).rows[0];

/** Push the current turn's deadline into the past, as if the clock ran out. */
export async function expireClock(db, draftId) {
  await db.query(
    `UPDATE public.drafts SET current_turn_deadline_at = clock_timestamp() - interval '1 second' WHERE id = $1`,
    [draftId]
  );
}

let movieSeq = 1000;
export const nextMovie = () => {
  const id = movieSeq++;
  return { id, title: `Movie ${id}`, year: 1999, genre: 'Comedy', poster: `/p${id}.jpg` };
};

/** A normal pick by a human, through the REAL live pick function. */
export async function humanPick(db, d, playerName, category, movie = nextMovie()) {
  const p = d.players.find((x) => x.name === playerName);
  await setAuth(db, p.userId);
  const res = await db.query(
    `SELECT * FROM public.make_multiplayer_pick_unified($1, $2, $3, $4, $5, $6, $7, $8)`,
    [d.draftId, p.participantId, movie.id, movie.title, movie.year, movie.genre, category, movie.poster]
  );
  return res.rows[0];
}

/** The referee making the pick for whoever's turn it is (claim, then apply). */
export async function refereeResolve(db, d, { category, movie = nextMovie() } = {}) {
  const claim = (await db.query(`SELECT public.referee_claim_turn($1) AS r`, [d.draftId])).rows[0].r;
  if (!claim.claimed) return { claim };
  const cat = category ?? claim.open_categories[0];
  const applied = (
    await db.query(`SELECT public.referee_apply_pick($1, $2, $3, $4, $5, $6, $7, $8) AS r`, [
      d.draftId,
      claim.pick_number,
      movie.id,
      movie.title,
      movie.year,
      movie.genre,
      cat,
      movie.poster,
    ])
  ).rows[0].r;
  return { claim, applied };
}

// ── Public play (Phase 2+) ─────────────────────────────────────────────

/**
 * Loads what the public-play migrations rely on, using the REAL live functions where possible:
 *   - _current_auth_email()                 (from the migration history)
 *   - start_multiplayer_draft_unified()     (the live start function: public tables must start like any draft)
 *   - the live name trigger behaviour       (BEFORE INSERT: name := profile name, else EMAIL)
 */
async function loadPublicPlay(db) {
  const emailSql = readMigration('20260923120000_email_invitees_first_class_participants.sql');
  await db.exec(extractAnyFunction(emailSql, '_current_auth_email'));
  await db.exec(extractAnyFunction(emailSql, '_unique_participant_name'));
  await db.exec(extractFunction(emailSql, 'start_multiplayer_draft_unified'));

  // Copy of the live trigger (supabase/migrations/20250724150503_*): this is the thing that would
  // otherwise put a player's EMAIL into a public table.
  await db.exec(`
    CREATE FUNCTION public.set_participant_name_from_profile() RETURNS trigger AS $$
    BEGIN
      IF NEW.user_id IS NOT NULL THEN
        SELECT COALESCE(name, email) INTO NEW.participant_name FROM public.profiles WHERE id = NEW.user_id;
        IF NEW.participant_name IS NULL THEN NEW.participant_name = auth.email(); END IF;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;
    CREATE TRIGGER trigger_set_participant_name BEFORE INSERT ON public.draft_participants
      FOR EACH ROW EXECUTE FUNCTION public.set_participant_name_from_profile();
  `);

  await db.exec(readMigration('20261105100000_public_play_foundation.sql'));
  await db.exec(readMigration('20261105110000_public_tables.sql'));
  await db.exec(readMigration('20261105120000_public_table_write_guards.sql'));
  await db.exec(readMigration('20261106100000_quick_match.sql'));
  if (existsSync(new URL('20261107100000_ranked_results.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261107100000_ranked_results.sql'));
  }
  if (existsSync(new URL('20261108100000_open_games.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261108100000_open_games.sql'));
  }
  if (existsSync(new URL('20261109100000_claim_public_name.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261109100000_claim_public_name.sql'));
  }
  if (existsSync(new URL('20261110100000_guest_quick_play.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261110100000_guest_quick_play.sql'));
  }
  if (existsSync(new URL('20261111100000_quick_play_lobby.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261111100000_quick_play_lobby.sql'));
  }
  if (existsSync(new URL('20261112100000_quick_play_categories.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261112100000_quick_play_categories.sql'));
  }
  if (existsSync(new URL('20261113100000_lobby_merge.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261113100000_lobby_merge.sql'));
  }
  if (existsSync(new URL('20261114100000_one_draft_hosting.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261114100000_one_draft_hosting.sql'));
  }
  if (existsSync(new URL('20261115100000_table_invites.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261115100000_table_invites.sql'));
  }
  if (existsSync(new URL('20261116100000_host_controls.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261116100000_host_controls.sql'));
  }
  // Joining by code: the live private-draft join (and the invite helpers it calls), then the migration that
  // sends a public table's code through the table join.
  await db.exec(extractAnyFunction(emailSql, '_is_current_user_invited'));
  await db.exec(extractAnyFunction(emailSql, 'claim_draft_invite'));
  if (existsSync(new URL('20261117100000_join_public_by_code.sql', MIGRATIONS))) {
    await db.exec(readMigration('20261117100000_join_public_by_code.sql'));
  }
}

/** `$$`-quoted function (the live helpers use $$ rather than $function$). */
export function extractAnyFunction(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  const open = sql.indexOf('$$', start);
  const close = sql.indexOf('$$', open + 2);
  return sql.slice(start, close + 2) + ';';
}

export const ADMIN_EMAIL = 'contact@roberthamill.design';

/** A signed-up person with a profile. Returns { id, email }. */
export async function makePlayer(db, { name = null, publicName = null, email = null } = {}) {
  const id = uuid();
  const mail = email ?? `${id.slice(0, 8)}@example.test`;
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, mail]);
  await db.query(`INSERT INTO public.profiles (id, email, name) VALUES ($1, $2, $3)`, [id, mail, name]);
  if (publicName) {
    await db.query(`UPDATE public.profiles SET public_name = $2 WHERE id = $1`, [id, publicName]);
  }
  return { id, email: mail };
}

/** Act as this person for the next calls (like their sign-in token). */
export async function actAs(db, who) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [who?.id ?? '']);
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [
    who ? JSON.stringify({ sub: who.id, email: who.email }) : '',
  ]);
}

export async function setMode(db, mode) {
  await db.query(`UPDATE public.public_play_settings SET mode = $1 WHERE id`, [mode]);
}

/** Call a function that returns a table; returns the rows. */
export const rpc = async (db, fn, ...args) => {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await db.query(`SELECT * FROM public.${fn}(${placeholders})`, args)).rows;
};

/** Call a function returning a single jsonb value. */
export const rpcJson = async (db, fn, ...args) => {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await db.query(`SELECT public.${fn}(${placeholders}) AS r`, args)).rows[0].r;
};

export const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
