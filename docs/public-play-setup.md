# Public play: setup, test and rollout

> Covers Phases 1–4 of [public-matchmaking-plan.md](public-matchmaking-plan.md). Updated 2026-11-06.
> The referee piece has its own detail in [referee-setup.md](referee-setup.md); this guide is the one to follow end to end.

## What's built

| Phase | What players get |
|---|---|
| **1. Referee** | A pick clock. If someone runs out of time the server picks for them (as strong as a bot). Bots are played by the server, so a closed host tab no longer freezes them. "Your turn" notification for slow games. |
| **2. Open Tables** | A **Play** page. Host a table (format, seats, clock, rated or casual, optional start time) or join one. The host starts the draft. Live tables get a 15-second ready check. Bots can fill seats. If the host doesn't show, the next player takes over. Players can report and block each other. |
| **3. Quick Match** | One button: a live 4-player draft with a random year, actor or special draft, 90 seconds per pick. Bots join after a short wait. A lone player can play against bots (unrated). |
| **4. Ranked play** | Rated games earn leaderboard points (10/7/5/3/2/1). Anti-cheating rules, a leaderboard (this quarter / all time), player hover cards, and a points panel on the Final Scores page. |
| **5. Open games + Quick Play** (added 2026-11-04) | Any online multiplayer draft can be **open to the public**: on the draft setup page (people/year and special drafts) a "Who can join?" choice offers *Friends I invite* (the old email flow) or *Open to the public* (seats, time per pick, rated or casual, optional start time). Open games are listed on the homepage and the Play page. **Quick Play** is one button: it joins the live game closest to full if there is one, and otherwise opens a lobby for you, so the next person to press it lands in yours. It never says "no games". Every lobby lists its categories (Quick Play lobbies get five chosen by rule, see migration 12). The host starts every draft; nothing starts by itself (see entry 8). |
| **Guests see it too** (added 2026-11-04) | Signed-out visitors see the homepage band, the open games and the Quick Play button (and the Play page's full hub) **when the switch is on Everyone**, as a reason to sign up. Trying to join a game, start one, or open one from draft setup opens a prompt: *Sign in* or *Create a free account*. After signing in they land back on exactly what they clicked (Quick Play runs by itself, a game they chose shows its Join card, the setup page they were on reopens). Guests can't actually do anything: every action function refuses them. |
| **6. One lobby for every draft** (added 2026-11-05) | The public waiting room and the normal pre-draft screen are now **one screen** (`DraftLobbyStatusParticipants`), so a Quick Play lobby, an open game and a private draft all look and behave alike: a call to action on top, then a Draft Status card (format, pick clock, game, categories) and a card with the join code or invite link and everyone's avatar, name, online dot and ready state. Ready is now also available in **private** drafts as an optional signal (a green ring and "Ready" under the player; the host still starts whenever they like, nothing waits on it). Public tables gained the **online dot** the private screen already had. Private drafts load, start and run exactly as before; the two new functions are separate from them (migration 13). Until migration 13 is applied the private Ready button simply does not show and public tables show no online dots. |
| **7. One draft, same hosting rules** (added 2026-11-05) | A Quick Play lobby is now an ordinary public draft the system fills in for you. **The first player is its host** (can start early, owns voting, cancels the lobby); **if the host leaves, the next player who is still here takes over**, and so on. (The "start when everyone is ready" and "fill empty seats with bots" switches this row first introduced are gone: see entry 8.) "Here" still means their page checked in within 45 seconds. Every lobby shows an **Invite Link**. The pick clock is a row in Draft Status that any private-draft host can change until the draft starts (it defaults to No clock, and every new private draft now has the referee on, so bots are played by the server). Private drafts show the host's chosen name instead of "Host". The call to action sits under the two cards and the Leave buttons are gone. |
| **8. One simple lobby, and host controls** (added 2026-11-06) | **The host starts every draft; nothing ever starts by itself** (Quick Play included). The lobby's call to action is one heading, one sentence and **Start Draft** with a quieter **Cancel** button under it. **Empty seats always fill with bots** when the host starts; to play with fewer people the host takes seats away. **Being in the lobby is being ready**: there is no I'm Ready button or ready ticks any more. When the host starts a live draft, everyone whose page is open counts as ready and it starts at once; only someone who has wandered off gets the 15-second "are you here?" check (and is replaced by a bot if they don't answer). A slow draft (hours per pick) never asks. **Edit settings** (a pencil icon at the top right of the Draft Status card, host only, until the draft starts) opens one window for every draft: **seats** (2 to 6, never fewer than the people and held seats already there), **pick clock**, **Casual or Rated**, and **categories**, using the same picker as the setup page (green / yellow / red movie counts on filmography drafts, none on year drafts, categories with too few movies can't be ticked, and an actor's own categories are offered). A special draft keeps its own categories. Private drafts get the same window with the pick clock and categories only (they are never rated and have no seat count; they have no bots at the start). |
| Extras | Copy an invite link for a table. "Find another game" after a game. |
| **Where it shows up** | **Homepage:** one big **Quick Play** button right under the headline, on the first screen (`src/components/home/PublicPlayStrip.tsx`; it joins an open game if there is one, otherwise starts one, and asks a guest to sign in first), and lower down the full "Play with others" band (`src/components/home/PublicPlaySection.tsx`) with the separate Quick Join / Quick Start buttons and the list of open games. **Draft setup:** the "Who can join?" choice under Online Multiplayer. **Header:** a "Play" link (and "Play with others" in the mobile menu). All appear **only when public play is open to that visitor**, so with the switch on "Just me" only you see them (the band carries an "Only you can see this" tag), and with "Off" nobody does. |

**The on/off switch.** A switch in the database (`off` / `admin_only` / `on`) decides who can use public play. It started on `admin_only`; **since 2026-11-05 it is on `on` (Everyone)** on the main database, set from chat so the guest view can be seen. The new screens exist only on the `Staging` branch and localhost, so real visitors on `main` still see nothing. To change it, say so in chat (the yellow panel at the top of the Play page does the same thing).

## Step 0: where this runs (decided 2026-11-04)

There is **one Supabase project** (`zduruulowyopdstihfwk`): the repo has no `.env` files, so `localhost` falls back to it (`src/integrations/supabase/client.ts`), the CLI is linked to it (`supabase/config.toml`), and the live site's own `index.html` connects to it. That is why public play was invisible on localhost until the migrations ran: the page asks the database `public_play_status()`, got "function not found", and (by design) showed nothing.

**The plan:** the migrations and the `referee-tick` function go onto this main Supabase project. The new screens stay on the `Staging` branch and are **not merged to `main` until they're ready**. Until then:

- The live site (`main`) doesn't know the new tables exist, so nothing changes for visitors.
- The switch starts on **Just me**, so even localhost / Staging shows the band, the Play link and the Play page only when you're signed in as the admin account.
- Anything you create while testing (tables, games, scores) is real rows in the real database. Only the admin account can create them while the switch is on "Just me". Test games count in the real leaderboard tables, so don't leave test data behind (see "Turning things off").

What the migrations do to tables you already use: they add columns with safe defaults to `drafts`, `draft_picks`, `draft_participants` and `profiles`, add a few `CHECK` rules that every existing row already satisfies, add triggers (which do nothing for any draft that isn't a public table or doesn't have the referee switched on), and widen the allowed notification types (a superset of your three existing ones). **None of them edits or deletes an existing row when run.** They add 11 new tables and seed one settings row, a starter bad-word list and the Quick Match pool (all switched off).

## Setup, in order

### 1. Apply seventeen migrations
Supabase dashboard (project `zduruulowyopdstihfwk`) → **SQL Editor** → paste the **entire contents** of each file, run it, then the next. In this order:

1. `20261104120000_referee_foundation.sql`
2. `20261104121000_referee_your_turn_notifications.sql`
3. `20261105100000_public_play_foundation.sql`
4. `20261105110000_public_tables.sql`
5. `20261105120000_public_table_write_guards.sql`
6. `20261106100000_quick_match.sql`
7. `20261107100000_ranked_results.sql`
8. `20261108100000_open_games.sql` (Quick Join, Quick Start and the homepage list: four new functions, no new tables, nothing existing changed. The homepage list is the only function a signed-out visitor may call; it follows the on/off switch and returns only public names and the details shown on a card. Needs 1–7 first.)

9. `20261109100000_claim_public_name.sql` (the player name for public play now comes from the name in the player's **settings** automatically, so nobody is asked twice. One new function, `claim_public_name()`, signed-in players only. It cleans the name up to fit the public rules (drops apostrophes and emoji, simplifies accents, cuts long names at a word, adds "2", "3" if taken), never uses anything that looks like an email address or fails the word filter, never falls back to the email, and never overwrites a name a player chose. Players are asked for a name only when their settings name can't be used. Needs 1–8 first.)

10. `20261110100000_guest_quick_play.sql` (lets signed-out guests ask "is Quick Start available?" so the guest view matches what a player sees. It replaces `quick_match_available()` with a version that never raises, follows the on/off switch, hides it for suspended accounts, and reveals only that one yes/no. Needs 1–9 first.)
11. `20261111100000_quick_play_lobby.sql` (Quick Play always finds a lobby, and everyone in a lobby can ready up. Years and actors are switched on by default, and if everything is switched off Quick Play falls back to every year and actor; special drafts stay off until approved. Adds `set_lobby_ready()`; a Quick Play game starts when 2+ players are all ready; the 15-second ready check no longer asks players who already readied up; a host's Start goes straight in when everyone else is ready. Needs 1–10 first.)
12. `20261112100000_quick_play_categories.sql` (each new Quick Play lobby gets five categories picked by rule instead of the same fixed five: a year gets 4 of the 7 most-played categories at random, an actor gets Drama/Romance, Action/Adventure and Comedy plus one of Academy Award / Blockbuster, a special draft keeps its own, and Wild Card is always last. One new internal function and a replaced `quick_start()`. Needs 1–11 first.)
13. `20261113100000_lobby_merge.sql` (the one-lobby merge: public tables report who is **online** (one extra field in `get_table_info`), and private drafts get an optional **I'm ready** through two new functions, `set_participant_ready()` and `get_lobby_ready()`. They work for signed-in players, email invitees and guests the same way the presence heartbeat does, can only change your own row, refuse public tables (those keep `set_lobby_ready`) and never touch how a private draft loads or starts. Needs 1–12 first.)
14. `20261114100000_one_draft_hosting.sql` (the hosting rules above: two new settings on a draft (`auto_start`, `fill_bots`), the first Quick Play player becomes host (existing Quick Play lobbies get their first player as host), "start when everyone who is here is ready", the host role passing to someone who is here (a player who is here is chosen before one who has wandered off), and the minute sweeps re-checking all of it. One new function for the host's switches, `set_lobby_options()`, and `get_table_info()` now says how the draft starts. Needs 1–13 first.)
15. `20261115100000_table_invites.sql` (inviting people from an open seat: the plus on an empty seat opens a window where the host adds email addresses, or, in a league draft, taps league members. Each invitation **holds a seat**: on a public table it shows as "Invited" to everyone (never the email or name; the host sees who), Quick Match and the open-games list count it as taken, and the invited person swaps it for a real seat by joining (the invite links to `/play?join=<table>`). A table that starts by itself waits for friends invited in the last 5 minutes; the host can always press Start. When the draft starts any seat still held is released (bots fill it if bots are on, and anyone with an account is told). The host can take an unused invitation back. Private drafts use the same function (six players at most; the address goes on the draft's invite list so a new sign-up can claim the seat). New functions `invite_to_draft()`, `revoke_draft_invite()`, `_waiting_for_invited()`; `join_public_table()`, `_do_start()`, `_start_if_all_ready()`, the Quick Play sweep and `get_table_info()` changed. Needs 1–14 first.)
16. `20261116100000_host_controls.sql` (the host starts every draft and chooses how it runs: nothing starts by itself any more, so the Quick Play countdown, the start-when-everyone-is-ready rule, the ready-up button (public and private) and the two lobby switches are removed. Empty seats always fill with bots at the host's Start. On a live draft everyone in the lobby counts as ready and only people who have wandered off get the 15-second check. Adds `set_table_settings()` (host only, before the start: seats, pick clock, rated, categories) and `set_draft_categories()` (a private draft's owner). It also retires the oldest Quick Match search and practice functions. Run after 15.)
17. `20261117100000_join_public_by_code.sql` (the join code now works for public tables. Every table already had the 8-character code private drafts show as **Join Code**, and the homepage's **Join a Draft** box takes it, but that box used the private-draft join, which skipped every table rule: a full table took one more person, blocks were ignored, signed-out guests could sit at a public table under any name, and the join limits didn't apply. This replaces `join_draft_by_invite_code_guest()` with the same function plus one step: a code that belongs to a public table goes through the same `join_public_table()` the Play page uses (an account, a public name made from the settings name if there isn't one yet, a free seat, blocks, join limits, the seat held for an invited email). Signed-out visitors are told to sign in. Private drafts are unchanged. One replaced function, no new tables. Run after 16.)

All are safe to run twice. If one fails, stop and send me the error message; the later ones depend on it.

### 2. Deploy the function
```bash
npx supabase login
```
```bash
npx supabase functions deploy referee-tick --project-ref zduruulowyopdstihfwk
```

### 3. Give it a secret
```bash
openssl rand -hex 24
```
```bash
npx supabase secrets set REFEREE_SECRET=<the-random-string> --project-ref zduruulowyopdstihfwk
```

### 4. Schedule the sweep (every minute)
This one job does everything that needs to happen without a player present: moving slow drafts along, reminders, host no-shows, Quick Match bots and ready checks, and scoring finished rated games.

Dashboard → **Database → Extensions**: switch on **pg_cron** and **pg_net**. Then run this in the SQL Editor, filling in the three `<...>` values (the anon key is the public one under Project Settings → API):

```sql
select cron.schedule(
  'referee-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://zduruulowyopdstihfwk.supabase.co/functions/v1/referee-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key>',
      'x-referee-secret', '<the-random-string>'
    ),
    body := '{"sweep": true}'::jsonb
  );
  $$
);
```
To stop it: `select cron.unschedule('referee-sweep');`

### 5. Deploy the Staging site (optional, only to share it)
Push the `Staging` branch as usual. (Pushed 2026-11-06 as commit `42334f2`. The mobile app folder, the admin content-timers widget and the spec-draft title backfill migration were left out of that commit on purpose.)

## The test (on localhost or the Staging site, against the main Supabase)

Sign in as the admin account (`contact@roberthamill.design`).

1. **Find it.** On the homepage scroll past the draft form to the **Play with others** band (it has an "Only you can see this" tag), or use the **Play** link in the header. Both open `/play`. The yellow admin panel says "Just me (testing)". Your player name is taken from your settings name automatically (the Play page says "Playing as …" with a **Change name** link; a name with an apostrophe loses it, e.g. "Tim Allen's Nose" becomes "Tim Allens Nose"). You are only asked for a name if your settings name is empty or can't be used. In a private window you should see **neither** the band nor the link.
2. **Open Tables.** Host a slow table (12 hours) and a live one (60 seconds). Open a private window as a second account, temporarily set the switch to **Everyone**, and join. Start a live table and go through the ready check. Let a clock run out and watch the auto-pick appear.
3. **Handoff.** Leave as the host and check the next player becomes host. Report a player; block a player.
4. **Reports.** `/admin/reports` should show the report. Try Dismiss, Warn and Ban.
5. **Quick Play draws from years and actors.** They are all on by default, so there is nothing to approve. `/admin/quick-match` lists them (and your special drafts, which stay **off** until you switch them on) if you ever want to switch some off.
6. **Quick Play.** From two accounts press **Quick Play** (homepage button or the Play page). The first lands in a new lobby and is its host; the second lands in the same lobby. The lobby shows a **Categories** section (five for Quick Play, with Wild Card last). The host sees one button, **Start Draft**; the two empty seats fill with bots when it is pressed. Nothing starts by itself, however long you wait. With both pages open press the button: the draft starts at once with the two bots. Run it again and close the second account's tab for a minute before the host presses Start: the host gets a 15-second check, the second account is asked to confirm, and if they don't a bot takes their seat.
6e. **Host and hand-over.** After applying migrations 14 and 16: on one account press **Quick Play**; you are the **host** (crown on your avatar, **Start Draft** and **Cancel** buttons, and **Edit settings** in the Draft Status card). On a second account press Quick Play and land in your lobby: that account sees "Waiting on the Host" and no buttons. Close the first account's tab for about a minute with the second still open: within a minute the second account gets "You're now the host".
6g. **Edit settings.** After applying migration 16: as the host press the **pencil** at the top right of the Draft Status card. Change the seats (try going below the number of people there: the minus stops), the pick clock, Casual or Rated and the categories, then Save: the card and the seat circles update for the other account within a few seconds, and the empty seats shown are the ones bots will take. In a **private** draft the same window offers only the pick clock and the categories (there is no Rated, no seat count and no ready button; the host sees **Ready To Start?** and one Start Draft button).
6h. **Join with the code.** After applying migration 17: in a Quick Play lobby or an open game the **Join Code** card at the top of the participants shows the table's code and a **Copy** button (it shows while there is an open seat). On a second signed-in account go to the homepage, open **Join a Draft**, type the code (any name) and join: you land in the same lobby as a real player under your public name. Try it with a full table (it says the table is full), with a table that has started (already started), and signed out (it asks you to sign in). A private draft's code still works as before, including for a guest.
6f. **Invite from an open seat.** After applying migration 15: in a Quick Play lobby (or any draft you host) press the **plus** on an open seat. As the host the window has an email box (and, in a league draft, the league's members with an Invite button each); a player who isn't the host just gets the invite link. Invite a second account's email: the seat shows **Invited** (you see the address, other players only see "Friend"), and a stranger can't take that seat. Open the emailed link on the second account and take the seat: it turns into a real player with no extra seat used. Press the small cross on an invited seat to take the invitation back. Press Start with a seat still held: it is released and bots fill it.
6d. **One lobby.** After applying migration 13: start a normal **private** draft with a friend (or a second account). The waiting room should look like the Quick Play lobby: a heading and button on top, a **Draft Status** card (format, game, categories), and the **Join Code** card with everyone's avatar and name. The friend sees **Waiting on the Host** and an **I'm Ready** button; pressing it puts a green ring and "Ready" under their avatar on the host's screen within a few seconds, and the host's heading shows "1 of 1 ready". The host can press **Start Draft** whether or not anyone is ready. In a Quick Play lobby, a player who closes their tab loses their green online dot within about 30 seconds.
6c. **Guest view.** Public play is on **Everyone** (it is now). Open a private window (signed out). The big Quick Play button, the lower band and the open games should all show. Press Quick Play or **Join game** on a card: a prompt offers *Sign in* / *Create a free account*. Sign in from the prompt on Quick Play and you land on `/play` and drop straight into a lobby; from a game's Join card you land on the Play page with that game's invitation. On a draft setup page choose **Online Multiplayer → Open to the public** as a guest: same prompt, and signing in brings you back to that setup page.
6b. **Open game from setup.** Open a people or year draft setup (for example `/draft/year/1999/setup`) and a special draft setup, choose **Online Multiplayer → Open to the public**, pick seats and a clock, choose at least 3 categories and press **Open the game**. It should land on the table lobby and show up on the homepage band and the Play page within about 20 seconds. Turn on "Part of a league" and the open option should switch off with a note. In a private window (signed out, switch on **Everyone**) the homepage should list the game; **Join game** should ask you to sign in.
7. **Ranked.** Finish a rated game with two real accounts, making your own picks. Within about a minute the **Leaderboard points** panel appears on its Final Scores page and the **Leaderboard** tab fills in. Hover a player's portrait or name (both do the same thing) to see the player card.
8. **Anti-cheat.** Let the clock run out on every pick for one account in a rated game: it should earn no points and not take anyone's place.

Then set the switch back to **Just me**.

## Rolling out to everyone

The database part is already live after setup (switch on **Just me**). The rest is merging the `Staging` branch into `main` when the screens are ready. Before that, and before switching to **Everyone**:

- [ ] You've cleaned up test data from the run above (cancel any open test tables; test rated games count toward the leaderboard).

- [ ] You've decided who reviews `/admin/reports` and how quickly.
- [ ] **Extend the bad-word list.** The name filter is a small starter list in the `blocked_name_terms` table. Add terms in the SQL Editor: `insert into blocked_name_terms (term, whole_word) values ('...', false);`
- [ ] **Review the Quick Match actors list.** It's my starting suggestion of 50, and all are off until you approve them.
- [ ] Terms of Service and Privacy Policy reviewed for strangers playing each other (I can't judge that for you).
- [ ] **Decide on the profile-email problem** (next section).

## A security problem that already exists (not caused by this work)

Any signed-in user can read **every other user's email address** through the API, because the profile table is readable by all signed-in users (a rule added so league pages could show names and avatars). Public play makes this much more important because players are strangers. Public tables never show or load emails, but the underlying exposure remains. Fixing it means moving every profile read (leagues, profile page, mobile app) onto a safe function, then restricting the table. It touches many screens, so it's set up as its own separate task. **Do it before opening public play to everyone.**

## Turning things off

| To stop… | Do this |
|---|---|
| Everyone using public play, immediately | `/play` → yellow panel → **Off**. Or SQL: `update public.public_play_settings set mode = 'off';` |
| Quick Match only | `/admin/quick-match` → switch everything off (the button disappears). |
| Open tables already running | `update public.drafts set cancelled_at = now(), cancel_reason = 'host_cancelled' where lobby_visibility = 'public' and turn_order is null and cancelled_at is null;` |
| The scheduled job | `select cron.unschedule('referee-sweep');` |
| The referee on private drafts | `update public.drafts set referee_enabled = false where lobby_visibility = 'private';` |

## How well is it tested?

**441 automated tests** in `supabase/tests/` (`cd supabase/tests && npm install && npm test`). They run against an in-memory database loaded with **your real start, pick and access functions** from the migration history. They cover the switch, names, blocks, reports and bans; creating, joining and leaving tables; the ready check; bots; starting; host handoff; reminders; Quick Match matching, fill timers and practice games; the write guards; scoring, points, ties, the idle-account and win-farming guards, cooldowns; the leaderboard and player cards; permissions; the online flag; the host and handing the host role on; nothing starting by itself; the host's Start (bots always fill, people in the lobby count as ready, the 15-second check only for people who are away); the host's settings (seats, clock, rated, categories, who may change them and when, a private draft's categories); inviting people (held seats, who sees what, capacity, taking a seat, releasing seats on start, private drafts, who may call it); joining with a code (a public table's code follows every table rule, a held seat is taken by its invited friend, guests are turned away, private drafts and guests unchanged); the helpers that reload a draft after each pick as one update (people looked up once, unchanged data left alone); and the scheduled function itself. I also **broke the code on purpose** in about 80 different ways to confirm the tests notice each one.

**What they can't prove, and the test above is for**
- That the migrations apply cleanly to your real database. My test database copies the columns your code relies on, but your live tables may differ in small ways.
- Real sign-in, the real API permissions layer, realtime updates, and the real movie-data service (the tests use a fake one).
- The screens were checked visually with fake data, not against real tables. The admin Quick Match and Reports pages were only type-checked.

## Not built

- **Mobile app** support, push notifications and email for turns. For now "your turn" and the other notifications show in the website's notification bell only. Slow games work best once email or push is added.
- Player hover cards in the live draft room's roster (they're in the table lobby, leaderboard and results).
- Scheduled "featured" drafts run by the site, spectating, and rematch buttons beyond "Find another game".
