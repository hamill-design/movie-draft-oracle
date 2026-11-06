# Referee: setup, rollout and rollback

> Phase 1 of [public-matchmaking-plan.md](public-matchmaking-plan.md). Written 2026-11-04.

> **Start with [public-play-setup.md](public-play-setup.md)**: it covers the whole set of migrations in one order, and does everything on a staging Supabase project first. This page is the detail for the referee part.

**What this adds:** a pick clock for multiplayer drafts, and a server-side "referee" that makes a pick for a player whose time runs out, and plays the bots, without anyone's browser involved.

**Nothing changes for your players until step 6.** Steps 1–5 install the pieces and leave every draft behaving exactly as today. At first only your admin account can even see the "Pick clock" picker.

---

## What got built

| Piece | Where |
|---|---|
| Database: clock, deadlines, strikes, referee functions | `supabase/migrations/20261104120000_referee_foundation.sql` |
| Database: "It's your turn" notification | `supabase/migrations/20261104121000_referee_your_turn_notifications.sql` |
| The referee itself (makes the picks) | `supabase/functions/referee-tick/index.ts` |
| How it chooses a movie (same logic as the bots) | `supabase/functions/_shared/refereePick.ts` |
| Countdown + Away message on the draft screen | `src/components/draft-board/PickClockBanner.tsx` |
| Host's "Pick clock" row (every host since 2026-11-05) | `src/components/draft-board/PickClockSelect.tsx` |
| Screen ↔ server wiring | `src/hooks/useDraftClock.ts`, `src/components/MultiplayerDraftInterface.tsx` |
| The rollout switch | `src/config/referee.ts` → `REFEREE_CLOCK_VISIBLE_TO_ALL` |

## Setup, in order

### 1. Apply the two database migrations
Supabase dashboard → **SQL Editor** → New query. Paste the **entire contents** of the first file, run it. Then the second file, run it. (Same way you've applied other migrations.)

- Safe to run twice.
- The first one does not change any existing draft. It adds columns and switches that default to "off".
- Run them in this order.

### 2. Deploy the referee function
In Terminal, from the project folder:

```bash
npx supabase login
```

```bash
npx supabase functions deploy referee-tick --project-ref <your-project-ref>
```

Your project ref is the `project_id` on the first line of `supabase/config.toml`.

### 3. Give the function a secret
This stops anyone else from running the scheduled sweep. Make up a long random string:

```bash
openssl rand -hex 24
```

Then store it (replace the value with the string you just made):

```bash
npx supabase secrets set REFEREE_SECRET=<the-random-string> --project-ref <your-project-ref>
```

### 4. Schedule the sweep
The sweep is a safety net: it moves slow drafts forward when nobody has them open. (Live drafts don't need it. Players' own screens nudge the referee the moment a clock runs out.)

Dashboard → **Database → Extensions**: switch on **pg_cron** and **pg_net**. Then in the SQL Editor run this, filling in the three `<...>` values (the anon key is the public key already in `src/integrations/supabase/client.ts`):

```sql
select cron.schedule(
  'referee-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/referee-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <your-anon-key>',
      'x-referee-secret', '<the-random-string>'
    ),
    body := '{"sweep": true}'::jsonb
  );
  $$
);
```

That runs every minute. To stop it any time: `select cron.unschedule('referee-sweep');`

### 5. Check it deployed
Dashboard → **Edge Functions** → `referee-tick` should be listed. Its logs show a line for every pick the referee makes.

### 6. Try it yourself first
1. Sign in as the admin account. Create a multiplayer draft and add a **bot** and one more player (a second browser or a friend).
2. In the lobby you'll see a **Pick clock** card above "Everybody Ready?". Choose **30 seconds**.
3. Start the draft. A countdown appears for whoever is on the clock.
4. Let the clock run out on a human turn. A pick appears on its own, and after two in a row that player is marked **Away**.
5. Close the host's tab mid-draft. The bot should still pick (that's the old "bot freezes" problem).

If a bot freezes or nothing happens when a clock hits zero, the function (step 2) or the secret (step 3) is the usual cause. Check the function's logs.

### 7. Let everyone use it
`REFEREE_CLOCK_VISIBLE_TO_ALL` in `src/config/referee.ts` is now `true`, so every draft host sees the Pick clock row in the lobby's Draft Status card.

---

## Turning it off

| To stop… | Do this |
|---|---|
| The referee on every draft, immediately | SQL Editor: `update public.drafts set referee_enabled = false where referee_enabled;` Drafts go back to exactly today's behavior and the host's browser plays bots again. |
| The scheduled sweep | `select cron.unschedule('referee-sweep');` |
| Hosts choosing a clock | Set `REFEREE_CLOCK_VISIBLE_TO_ALL` back to `false`. |

## How well is it tested?

There are 90 automated tests in `supabase/tests/`. To run them:

```bash
cd supabase/tests && npm install && npm test
```

**What they prove**
- The new database code works alongside your **real, current** pick function, loaded straight from your migration history. A draft without the referee behaves exactly as before.
- Clocks, deadlines, auto-picks, bot picks, strikes/Away, turn order and finishing a draft are all correct.
- A pick can't happen twice, even if five players' screens ask at the same instant.
- A player who clicks just as time runs out gets a clean "already resolved" instead of a broken board.
- The referee function's real code was run in tests: sign-in checks, the scheduled sweep, movie-service failures, retries.
- The tests were also checked by breaking the code on purpose to confirm they notice.

**What they can't prove (needs your real Supabase project)**
- That the migrations apply cleanly to your live database. They've only run on a stand-in (your real tables may have columns or policies the stand-in doesn't).
- The live start function's exact behaviour. The tests simulate a draft start; the new code only relies on the turn fields it sets.
- Real movie lookups. The tests use a fake movie service; the spec-draft database queries in `referee-tick` mirror the browser's but haven't run against your data.
- Deploying the function and the schedule.

So step 6 (admin-only trial) is the real test. Try a year draft, a people draft and a spec draft, since each loads movies differently.

## Known gaps (not done yet)

- **No "auto-picked" tag on individual board cells yet**, and no Away badge in the player list. The countdown banner covers Away. The data for both is already available from the server (`pick_sources`, `is_away`).
- **Guests can't wake the referee** from their screen (it needs a sign-in). The scheduled sweep still covers them.
- **The strikes/Away rules and presets are the plan's defaults.** Changing them is a small edit in the migration (3s bot delay, 5s Away deadline, 2 strikes).
- Per-user reliability records and cooldowns come with the ranking phase.
