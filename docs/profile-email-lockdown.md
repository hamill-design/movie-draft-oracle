# Profile email lockdown: inventory, what changed, and the safe rollout order

> Written 2026-11-23. This is the fix for "A security problem that already exists" in
> [public-play-setup.md](public-play-setup.md). Nothing here has been applied to the live database.

## The problem in one paragraph

`public.profiles` has a rule, **"Authenticated users can view any profile"** (`USING (true)`), added so league pages
could show names and avatars. It lets every signed-in user read every row, including `email`, the marketing opt-in
flags, and the ban and cooldown columns. Public play makes this serious because players are strangers. Public tables
already never show or load emails; the exposure is the table itself.

## What was changed (three migrations, in this order)

| # | File | What it does | When to run |
|---|------|--------------|-------------|
| 1 | `supabase/migrations/20261123130000_profile_read_functions.sql` | **Adds** three safe read functions. Changes nothing that exists. | **First**, any time. Zero effect on the live site. |
| 2 | `supabase/migrations/20261123140000_league_members_creator_only_insert.sql` | Stops anyone adding **themselves** to someone else's league (see "The league back door"). | Any time after #1, recommended before public play opens. Independent of the code. |
| 3 | `supabase/migrations/20261123150000_profiles_read_own_row_only.sql` | **Closes the table**: a signed-in user can read only their own row. | **Last. Only after the new code is live on production (`main`).** It refuses to run if #1 is missing. |

### The three functions (all `SECURITY DEFINER`, fixed `search_path`, signed-in callers only, signed-out role denied)

| Function | Who may call it successfully | Returns |
|---|---|---|
| `get_league_profiles(league_id)` | Members of that league | `user_id, name, avatar_url, email` for current members; `user_id, name, avatar_url` (email empty) for people who posted in that league's chat and have since left. Not a member: no rows. |
| `get_draft_people(draft_id)` | The draft's owner or anyone seated in it (the same door the draft room uses, `can_access_draft`) | `user_id, avatar_url, email` for the signed-in people in that draft. **Email is always empty for public tables**, decided on the server (the screen used to decide this, and a failed lookup showed emails). |
| `get_my_league_inviters()` | You, about yourself | `user_id, name` of people with a pending league invite to you. Names only. |

## Inventory: every place that reads another person's profile

### Website (`src/`)

| Where | What it needs | Whose profile | Now goes through |
|---|---|---|---|
| `src/hooks/useLeagues.ts` `useLeagueMembers` | id, name, avatar, email | league members | `get_league_profiles` |
| `src/hooks/useLeagues.ts` `useLeagueMessages` | id, name, avatar | chat authors (can be ex-members) | `get_league_profiles` |
| `src/hooks/useLeagues.ts` `usePendingLeagueInvites` | id, name | the person who invited you | `get_my_league_inviters` |
| `src/pages/LeagueSettings.tsx` (admin line) | name, email | the league admin | taken from the member list (`get_league_profiles`) |
| `src/hooks/useMultiplayerDraft.ts` + `src/utils/draftReload.ts` | id, email, avatar | people in a draft | `get_draft_people` |
| `src/pages/LeagueSettings.tsx` `handleUserSearch` | id, name, avatar by name search | anyone | **Left as is: it is switched off** (`SHOW_INVITE_BY_DISPLAY_NAME = false`). Once the table is closed it finds nobody. If it is ever brought back it needs its own purpose-built function; a comment in the file says so. |

Own-row reads and writes (unchanged, they keep working under "own row only"): `AppHeader.tsx`, `useProfile.ts`,
`useProfileFixer.ts`, `Profile.tsx`, `utils/avatarUpload.ts`.

Where league members' emails are *used* (so they still come through `get_league_profiles`): the draft setup pages
(`LeagueSetupSection.tsx` add league mates to a draft by email), `useDraftLeague.ts` and the invite window
(`InviteSeatDialog.tsx`), `HomeDraftSection.tsx`, `LeagueSettings.tsx` (member names), and the mobile new-draft screen.

### Mobile app (`mobile/`)

| Where | Whose | Now |
|---|---|---|
| `mobile/hooks/useLeagues.ts` (a copy of the website file, only the imports differ) | members, authors, inviters | same three changes as the website. A test checks the two copies stay identical. |
| `mobile/hooks/useDraftRoom.ts` | people in a draft (email, avatar) | `get_draft_people` (this also fixes the mobile app showing emails in public tables, which the website already avoided) |
| `mobile/app/draft/new.tsx`, `mobile/lib/avatar.ts` | your own name / your own avatar | unchanged |

### Edge functions (`supabase/functions/`)

`send-league-invitations`, `resend-marketing-webhook`, `sync-marketing-audience`, `user-data-deletion` all read
`profiles` with the **service key**, which ignores the table's rules. Not affected.

### Database (checked against the live database, read-only, 2026-11-23)

- All 29 functions that mention `profiles` are `SECURITY DEFINER` (they run as the owner and ignore the table's
  rules), including every public-play function, the leaderboard, player cards, invites by email, notifications and
  the admin tools. Not affected. None outside the `public` schema; no materialized views.
- The two standings views (`league_standings`, `league_season_standings`) are owned by `postgres` and are not
  `security_invoker`, so they keep working.
- One rule elsewhere reads `profiles`: `league_invites` "Invited user can view their own invites" looks up **your
  own** email (`WHERE id = auth.uid()`). Own row, so it keeps working. (This is why the fix is a row rule and not
  "hide the email column": hiding the column would have broken this rule.)
- `profiles` has no triggers. Storage rules do not use it.

## Decisions worth knowing about

1. **League mates still see each other's emails; people in the same private draft still see each other's.** The
   league and draft-invite screens add people **by email** (the participant's "name" is their email, and invites
   are emailed), so removing the emails would break those screens. What changed is *who* can see them: only people
   in the same league or the same private draft, never any signed-in stranger, and never in a public table.
   Getting to zero (invite by user id instead of by email) is a bigger change to the setup pages; it can be a
   follow-up if you want it.
2. **The league back door (migration #2).** `league_members` allowed any signed-in user to insert themselves into
   *any* league (`WITH CHECK (user_id = auth.uid())`), and league ids are listed in the standings views for everyone,
   even signed-out visitors. Without migration #2 someone could join a league they were never invited to and read its
   members' emails through `get_league_profiles` (and its chat). The only place the apps insert into `league_members`
   directly is `createLeague()` (the creator adds themselves as admin), which still works; everyone else joins through
   the accept-invite functions, which run as the owner and are not affected.
3. The server now decides whether a draft is public. Before, the screen asked, and if that lookup failed it assumed
   "private" and asked for emails.

## Safe rollout order (this matters: production shares this database)

1. **Paste migration #1** (`20261123130000_profile_read_functions.sql`). It only adds functions, so production
   behaves exactly as before. Check: `select proname from pg_proc where proname in ('get_league_profiles','get_draft_people','get_my_league_inviters');` returns three rows.
2. *(Recommended)* **Paste migration #2** (`20261123140000_league_members_creator_only_insert.sql`). Check by creating a
   league on the site: it should still create and show you as admin.
3. **Get the new code live on `main`** (production) **and Staging**, by cherry-picking commits in a separate temp
   worktree (never merge Staging, never stash or reset). Production only needs two pieces:
   - the **league screens**: `src/hooks/useLeagues.ts` and `src/pages/LeagueSettings.tsx` (identical on main and
     Staging, so the same commit applies cleanly to both; checked with a dry run on `main`);
   - the **draft room**: `main` has an older, simpler version of `useMultiplayerDraft.ts` than Staging, so it needs its
     own small change (a ready-made, type-checked patch is in the shared notes folder:
     `main-version-profile-reads.patch`). The Staging version (`useMultiplayerDraft.ts`, `utils/draftReload.ts`,
     `mobile/hooks/useDraftRoom.ts`, `mobile/hooks/useLeagues.ts`) is Staging only.
   Wait for the production deploy to finish, then open a league page, a league chat, a pending invite and a draft room
   on the live site and confirm names, avatars and the invite window still show.
4. **Only now paste migration #3** (`20261123150000_profiles_read_own_row_only.sql`). Re-check the same four screens, plus your
   Profile page. The migration prints a warning if some other rule on the table still lets people read other
   people's rows.

**Why the order:** if #3 runs while production still reads the table directly, league member lists, chat authors,
invite senders and draft-room avatars go blank on the live site. If #1 is missing when the new code ships, the same
screens go blank. A browser tab opened before the deploy keeps the old code until it is reloaded, so a few people
may see blanks for a moment after step 4.

**To undo #3** (if a screen turns out to still need the table):
`CREATE POLICY "Authenticated users can view any profile" ON public.profiles FOR SELECT TO authenticated USING (true);`

**Not covered:** any copy of the mobile app already installed on a phone from an older build still reads the table
directly and will show blank names after #3. (The mobile app is not on the stores yet.)

## Tests

`supabase/tests/profileLockdown.test.mjs` (31 tests, `cd supabase/tests && node --test *.test.mjs`, now 486 pass).
It uses a copy of the live tables, rules and grants, and shows each problem *before* the fix and gone *after*: a
stranger reads everyone's email from the table, then only their own row; the three functions refuse strangers,
signed-out visitors and the signed-out database role; public tables never return an email; the standings views,
the invite-by-email rule, your own profile and joining by invite still work after the table is closed; the league
back door is open, then shut. It also checks that only a known list of files touch `profiles` directly (all
own-row), so a new direct read of other people's profiles fails the tests. Each migration was also broken on purpose
(nine ways) to confirm the tests notice.

## Found along the way, not fixed (separate follow-ups)

- **Anyone can edit their own `is_banned`, `banned_until`, `ban_reason` and `public_play_cooldown_until`.** The rule
  "Users can update their own profile" has no column limit, `authenticated` has UPDATE on the whole table, and
  `profiles` has no trigger. A banned player could un-ban themselves, and anyone can change `public_name` directly,
  skipping the name rules. Worth fixing before public play opens (column-level privileges or a guard trigger).
  Not tested against the live database (that would be a write).
- **`league_standings` / `league_season_standings` are readable by signed-out visitors.** They list every league's
  id, every member's user id, display name and avatar. No emails, but it is how league ids can be discovered.
- `set_participant_name_from_profile()` is `SECURITY DEFINER` with no fixed `search_path`.

## Suggested replacement for the paragraph in `public-play-setup.md`

(`docs/public-play-setup.md` has uncommitted edits in the main checkout, so this branch does not touch it.)

> **Profile emails: fixed in three migrations, see [profile-email-lockdown.md](profile-email-lockdown.md).** Run them
> in that order, and run the last one only after the new code is live on production. **Do it before opening public
> play to everyone.**
