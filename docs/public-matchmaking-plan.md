# Movie Drafter — Public Multiplayer & Matchmaking Plan

> Living document. Started 2026-11-04. Status: **planning — nothing built yet.**
> Check boxes off as we go. Items marked **[DECIDE]** need a call from Robert before we build them.

## 1. The goal

Let anyone play a real movie draft against other people **without needing friends or an invite code**.
Today multiplayer is private: you create a draft and invite people you know. Public multiplayer adds a way
to *find* a game with strangers — online matchmaking — and to keep it running without anyone babysitting it.

## 2. Decisions made so far

| Decision | Choice | Date |
|---|---|---|
| Live vs. slow games | **Both.** One engine, with a *pick clock* that changes the speed. | 2026-11-04 |
| Who sets the pick clock | **The creator/host sets it** when they create a table. | 2026-11-04 |
| How a host's table starts | **The host can set an optional scheduled start time, but must press Start themselves.** The system never auto-starts a host's table. (Quick Match has no host, so the system starts that one.) | 2026-11-04 |
| Accounts | **Account required** for public play. Guests can still join private drafts by invite code. | 2026-11-04 |
| Public name | Players show their **display name**. Hovering a profile shows the **full display name + play stats** (drafts played, wins, reliability). Never a real name or email. | 2026-11-04 |
| Table size | **4 seats by default; host can choose 2–6.** | 2026-11-04 |
| Quick Match | **A random mix, same for everyone in the lobby**, drawn from three pools: the **past 50 years** (Draft by Year), the **top 50 actors** (Draft by Filmography), and the **Special Drafts** (curated themes). Players don't choose, so it stays one queue. Fixed **90-second** pick clock. | 2026-11-04 |
| Ready check | **15-second ready check** when the host presses Start on a live-clock table. | 2026-11-04 |
| Host no-show | Grace period of **15 min (live tables) / 24 hours (slow tables)** past the scheduled time. Then the **host role passes to the next player who joined**; the table cancels only if nobody can take it. | 2026-11-04 |
| Minimum to start a host table | **1 real player** (the host). Bots fill the rest. With only one real player the game is an unrated practice game. | 2026-11-04 |
| Minimum for a rated game | **2 real players.** Bots never count. | 2026-11-04 |
| Platform | **Website first**, mobile app after. | 2026-11-04 |
| Auto-pick strength | **Same as the bots.** When a player's clock runs out, the referee makes the same competitive pick a bot would. | 2026-11-04 |
| Idle-account guard | **A player must make at least half of their own picks to earn rated points.** Auto-picks and bot picks don't count as theirs. The game still counts normally for everyone else. | 2026-11-04 |
| **Quick Play always lands in a lobby; everyone can ready up** (2026-11-05, supersedes the separate Quick Join / Quick Start buttons and "an admin must approve Quick Match entries") | One **Quick Play** button. It joins an open game if there is one; otherwise it opens a lobby, and the next person to press it lands in that lobby, and so on. It never says "no games". Years and actors are on by default (and Quick Play falls back to every year and actor if everything is switched off); special drafts stay off until approved. In any lobby everyone can **ready up** (and take it back). Quick Play lobby: starts the moment 2+ real players are all ready, bots fill the empty seats; the existing timers stay as the safety net (the 15-second check only asks players who haven't readied up). Host-run live table: the host's Start goes straight in if everyone else is ready. | 2026-11-05 |
| **Guests can see Quick Play** (2026-11-05) | Signed-out visitors see the homepage band, open games, Quick Join / Quick Start and the Play page hub when public play is on **Everyone**, as an incentive to sign up. Any attempt to join, start or open a game asks them to sign in or create an account, then returns them to exactly what they clicked. Accounts stay required to play. | 2026-11-05 |
| **The player name comes from settings** (refines "Public name" above, 2026-11-04) | Players aren't asked for a second name. The first time public play is open to them, the **name in their settings** is used, cleaned up to fit the public-name rules, with a number added if taken. They're asked only when that name is empty or unusable (looks like an email or link, fails the word filter). An email is never used. A **Change name** link on the Play page remains (once a day). | 2026-11-04 |
| **Open to the public is a setup choice** (supersedes "host a table" being its own flow) | **Any online multiplayer draft can be set to *Open to the public* in the normal draft setup** (people/year and special drafts), next to the existing email-invite flow. Open games are listed on the **homepage** and the Play page. League drafts can't be open. The old "Host a table" dialog on the Play page still works as a shortcut. | 2026-11-04 |
| **Quick Play is two actions** (supersedes the single "Find a match") | **Quick Join** jumps into a live open game (a player's or a Quick Match, closest to full first, never a slow or far-off one; says so and creates nothing when there isn't one). **Quick Start** opens a new Quick Match of your own (system-picked draft, 90 s clock, bots fill after ~40 s) that others can jump into. The old `quick_match_join()` still exists but the screens no longer call it. | 2026-11-04 |

Defaults I'm assuming (not yet confirmed): bots never affect rankings · no chat between strangers in v1 ·
the host can edit the scheduled time after people have joined (everyone is notified) · clock presets as listed in section 3.

## 3. The core idea: one engine, one pick clock

Every public draft has a **pick clock** — how long a player has to make their pick before the system picks for them.

- **Short clock (seconds)** → a *live* game. Everyone's at their screen, ~10–20 minutes total.
- **Long clock (hours)** → a *slow* game. Players get a notification when it's their turn and pick whenever; takes a day or several.

It's the same draft board, the same rules — only the clock differs. That means we build **one** system, not two.

### The host sets the clock

When a host creates a public table they choose the clock from a short list of presets (final list is a design call):

| Group | Presets |
|---|---|
| Live | 30 sec · 1 min · 90 sec · 2 min |
| Slow | 1 hour · 4 hours · 12 hours · 24 hours |

Rules around it, so a host-chosen clock stays fair:
- **Locked once the draft starts.** The host can't speed it up or slow it down mid-game.
- **Always visible before you join.** Every table card shows its clock prominently with a Live / Slow badge, and the lobby can filter and sort by speed. Nobody should discover a 30-second clock after sitting down.
- **Limits enforced by the database**, not just the screen: nothing under 30 seconds or over 24 hours.
- **Quick Match has no host**, so it uses a fixed system clock (90 sec). Host-set clocks apply to Open Tables, and to private/league drafts too.
- **Private drafts keep a "No clock" option** (today's behavior — friends picking whenever). Public tables *require* a clock because strangers can't be waited on forever.

Trade-off to be aware of: more clock choices means players spread across more tables, which makes it harder to find a game
when the player base is small. We reduce this with filters and by funneling Quick Match into one fixed clock.

### What happens when the clock runs out
1. The system **auto-picks** for that player (same idea as auto-draft in fantasy sports), using the existing AI pick logic at the **same strength as the bots** (decided).
2. The player gets an **"auto-pick" strike**. After 2 in a row they're marked **Away** and the system keeps auto-picking for them so the other players aren't stuck waiting.
3. Repeated no-shows count against the player's reliability record (used later for cooldowns).

## 4. What exists today vs. what's missing

| Need | Today | Gap |
|---|---|---|
| Live board, turn order, "who's online" | ✅ Real-time updates + heartbeat presence | — |
| Turn checking | ✅ Database checks whose turn it is on each pick | — |
| Bots | ⚠️ Exist, but the **host's browser** makes their picks. Host closes the tab → bot freezes | Move bot picks to the server |
| Pick clock / auto-pick | ❌ None (only a countdown for post-draft voting) | New |
| Anything that runs on its own | ❌ Nothing scheduled in the project | A "referee" (section 5) |
| Scheduled start + host presses Start | ✅ Leagues do this today (scheduled date, "upcoming draft" notification, admin-only Start), and the draft lobby has a host-only Start button | Reuse for public tables; add reminders and host no-show handling |
| Find a game | ❌ "Public" only means finished results/voting are viewable | Lobby + matchmaking |
| Notifications | ⚠️ Bell + realtime exist, but only for draft invite, league invite, upcoming draft | Add "your turn", "match found", etc. |
| Safety for strangers | ❌ | Section 8 |
| Public ranking | ⚠️ League quarterly points (10/7/5/3/2/1) exist | Reuse for public leaderboard |

## 5. The Referee (build this first)

**In plain English:** the referee is the part of the server that keeps a draft moving on its own, like a game's clock operator and umpire.
It isn't a screen. Players only see its effects: a pick countdown, an "auto-picked" tag, an "Away" badge, a "You're now host" prompt.
Today the players' browsers do all the work, so nothing enforces time, and bots freeze if the host closes their tab.

Right now nothing watches the clock. We need a server-side **referee** that: tracks each turn's deadline, makes auto-picks and bot picks,
and starts/cancels matches. Plain-English requirements:

- Every draft stores **when the current turn expires**.
- Anyone viewing the draft can trigger "this turn is overdue — resolve it", and the server makes sure it only happens **once** even if five phones ask at the same instant. (Idempotent + row-locked.)
- A **scheduled backstop job** also sweeps for overdue turns, so slow games still advance when *nobody* has the app open. For live games, players' own screens do the nudging.
- Bot/auto-picks run on the server. The existing pick logic (`src/utils/aiPickLogic.ts`) currently runs in the browser and calls the `fetch-movies` function, so it must be ported or wrapped as a server function.
- **Who starts what:** on a host's table the *host* presses Start (the referee never starts it). On Quick Match, which has no host, the *system* starts it. Either way, once a draft is running the referee handles the clock, bots and the finish — the host has no ongoing duties.
- The referee also sweeps for **host no-shows**: when the grace period passes without a start, the host role is handed to the next player who joined, and the table is cancelled (players notified) only if nobody can take it (section 6).

Technical notes:
- Verify whether our Supabase plan supports scheduled jobs more often than once a minute. If not, live-speed turns lean on the "anyone can nudge" path and the job covers slow games only.
- `make_multiplayer_pick_unified` already completes a draft server-side after the last pick. Auto-picks should go through the same function so scoring and turn advance stay in one place.
- The multiplayer code has had recent turn/row-swap bugs (see memory). Add automated tests around turns and picks **before** building on top.

This phase also helps private drafts: league drafts stop stalling when one person goes quiet.

### Decisions needed before building the referee

What I verified in the code first: the draft already uses a **randomized snake order** (1-2-3-4, 4-3-2-1…), so first-pick fairness is handled, and
scores stay **hidden on the board until the Final Scores page**.

1. **How good should an auto-pick be?** **Decided: same as the bots.** The existing bot logic (`aiPickLogic.ts`) is deliberately competitive: it ranks movies by rating, vote count and Oscar status and picks from the top 3.
   Auto-pick reuses it. Consequence: walking away does not hurt your picks, so discouraging idling has to come from other things (strikes, the Away flag, the reliability record) and from the idle-account guard (section 2): no rated points unless you made at least half your own picks. Bots in public games use the same logic and never affect rankings.
2. **Which category does an auto-pick fill?** Players choose their category each pick, so the referee must choose for them. [Default: a random category the player hasn't filled yet]
3. **Clock rules.** Does the clock start the instant the previous pick lands? Any pauses or "time bank"? [Default: starts immediately, no pauses or time banks in v1]
4. **Does the clock reach private and league drafts in Phase 1, and who sets it?** [Default: yes, an optional setting for the draft creator, default "No clock" so nothing changes for existing drafts]
5. **Infrastructure limits.** The Supabase plan decides how often scheduled jobs can run and how many live connections we get. This needs checking in the Supabase dashboard, which I can't see from here. **[Needs Robert]**

## 6. Matchmaking: how people find a game

Everything is a **lobby**: a draft in a "forming" state that people can join until it's full. The three ways in are
just different ways of landing in a lobby.

### Quick Match (live) — system-started
One big button. There's no host here, so the system starts the match once the lobby is full (or the fill timer ends) and the ready check passes. You enter the queue and the system puts you in a forming lobby, or opens a new one.
- **Format: a random mix, the same for everyone in the lobby.** Each match draws from three pools: **Draft by Year** (the most recent 50 full years), **Draft by Filmography** (a curated top-50 actors list) and the **Special Drafts** (curated themes). Players don't choose, so mixing content does not split the queue.
- Fixed 90-second clock, 4 seats.
- **Length:** the worst case is players × rounds × 90 sec (for example 4 players × 5 rounds = 30 minutes); most games finish much faster. Default rounds per format are in section 14.
- **Only vetted pool entries are used:** an entry (a year, an actor, a themed list) is eligible only if it has enough movies for 4 players across all of the match's categories. The existing category-availability check (`analyze-category-availability`) is the likely starting point.
- **Fill timer (~30–45 sec):** when it ends, bots fill empty seats and the screen says so openly.
- **Needs at least 2 real people.** If you're alone, you're offered "keep waiting" or "practice vs bots (unrated)".
- **Ready check** once the lobby is full: "Match found — accept (15 sec)", so nobody starts with someone who walked away.

### Open Tables (browse & join) — host-started
Hosts create a public table and set: theme/format, number of seats, **pick clock**, rated/casual, and optionally a **scheduled start time**.
Others browse a list (filter by speed, theme, seats open, start time) and join. Players can leave any time before the draft starts.

**The host always starts the draft themselves.** The scheduled time is a promise to players, not a trigger — nothing begins on its own.
This reuses how leagues already work (a scheduled date, then the admin presses Start).
- **The schedule is optional.** A host can pick a date and time ("Fri 8pm ET") or leave it open ("I'll start it when it fills").
- **Players see a countdown** on the table card and in the table lobby, and get reminders (e.g. 1 hour before, and at start time).
- **The host gets a nudge** at the scheduled time: "Your table is ready — start the draft."
- **The host presses Start.** It's available as soon as the host is in; there's no minimum number of other players. Before starting, the host chooses what to do with empty seats: run a smaller draft, or fill them with bots. If the host is the only real player, bots are required and the game is automatically an **unrated practice game**.
- **Live-clock tables get a 15-second ready check** when the host presses Start, so a short clock doesn't begin while someone is away from their screen. Players who miss it are dropped, or swapped for a bot if the host chooses.
- **If the host doesn't start in time,** the table waits a grace period past the scheduled time: **15 minutes for live-clock tables, 24 hours for slow tables.** For a table with no scheduled time, "no-show" means the host has been away (no presence heartbeat) for that long.
- **Then the host role is handed over:**
  - It passes to the **player who joined next** (join order), who gets a "You're now host — start the draft" notification and the same grace period.
  - It's **automatic, in join order only.** Players can't claim host, so nobody can hijack a table.
  - If the host **leaves on purpose** before the start, the role passes right away.
  - The new host can change the schedule, but **not** the pick clock, format, seats or rated setting. Those are locked at creation, so there's no bait-and-switch.
  - The original host stays at the table as a regular player if they come back.
  - If nobody can take it (no other real players, or two handoffs go unanswered), the table **cancels** and everyone is notified.
- **Changing the schedule** after people have joined is allowed; everyone is notified of the new time.

Slow tables are more forgiving of a small player base because people can join and come back later.

### Featured drafts (later)
Scheduled community events ("Friday Night Draft, 8pm ET") to concentrate players into the same window.
Leagues already have scheduled drafts (an admin sets a date and starts it by hand), so part of the scheduling and notification machinery exists. Featured drafts would be system-run events, unlike host tables.

### The empty-room problem
With a small player base, waiting for four real humans will often mean waiting alone. Our answers:
few shared queues · bot fill after a short wait · slow tables that tolerate gaps · scheduled events.

## 7. Reliability: leavers, disconnects, bots

- A player who leaves or goes Away mid-draft is covered by auto-picks; for a clean exit the seat can be taken over by a bot.
- The existing presence heartbeat (`last_seen_at`) powers the Away badge and the ready check.
- Bots **never** earn or lose rating points; rankings only consider real players' finishes.
- Rated games lock the final results at completion so later data changes (e.g. Oscar status) can't reshuffle standings. Confirm how score data is stored (`draft_picks.calculated_score`) and snapshot results for rated games.

## 8. Safety & trust — a launch gate for anything public

Public play does not ship until these are done:
- [x] **Accounts required.** Guests stay available for private code-join only. (Enforced in the database.)
- [x] **No emails exposed at public tables.** Public tables use a player's chosen public name; the draft screen no longer loads emails for them; the table functions return names and avatars only. *(A separate, existing problem remains: see the next item.)*
- [ ] **Lock down `profiles.email` for everyone.** Found 2026-11-05: any signed-in user can read every profile row, **including email addresses**, through the API (`Authenticated users can view any profile`, added for league pages). It predates public play but matters far more with strangers. Fixing it means moving the app's profile reads to a safe view or function, then restricting the table. It touches the league screens, profile page and mobile app, so it needs its own careful change.
- [x] **Display-name rules** (length, characters, word filter, unique, never email-derived). The word list is a starter; extend it before opening wide.
- [ ] **Profile hover card** shows the full display name and play stats (drafts played, wins, reliability), and never a real name or email. *(Phase 4: needs the stats.)*
- [x] **Report and block** a player, with a review queue at `/admin/reports`.
- [x] **Ban / cooldown flags** on profiles, enforced by the database. (Automatic cooldowns arrive with Phase 4's reliability record.)
- [x] **Limits on abuse**: max 2 open tables per host, daily table/report caps, join/leave throttling.
- [x] **Write guards** so players can't edit a public table's clock, status, order, host, or picks through the API, and can't bypass seats or blocks via the invite-code route.
- [ ] **Terms & Privacy review** for public play.
- No free-text chat between strangers in v1 (emoji reactions at most).

## 9. Notifications (essential for slow games)

New notification types: **your turn**, **time running low** (e.g. 25% left), **match found**, **draft started**, **results ready**,
**table starts soon** (to players, before the scheduled time), **time to start your table** (to the host, at the scheduled time),
**schedule changed**, **you're now host** (the host role passed to you), and **table cancelled** (nobody could start it). Today's "upcoming draft" notification fires once when a date is set; public tables need reminders closer to the time.
Delivery: in-app bell (exists) → email via Resend (exists for invites; add throttling + an unsubscribe/preferences control) → mobile push (already on the mobile plan).
Transactional turn emails need their own opt-out, separate from marketing opt-in.

## 10. Competitive layer (after the core works)

- **Start simple:** points per finish like leagues (10/7/5/3/2/1) → a public **leaderboard** with seasons. We already compute quarterly seasons.
- Public **player card**: wins, drafts played, reliability, favorite genres.
- **Skill rating (Elo-style) later, only if needed.** Skill-based matching splits an already-small queue, so don't add it until there's enough traffic.
- **Decided:** a game counts as rated with **2 or more real players**; bots never count. This makes win-farming possible (two friends repeatedly playing each other plus bots), so see the guard proposed in section 14.
- **Decided:** a player earns rated points only if they made at least **half of their own picks** themselves. This needs every pick to record who made it (the player, an auto-pick, or a bot).

## 11. Screens to design

1. Play hub (Quick Match · Open Tables · My slow drafts)
2. Quick Match: searching → match found / ready check → bots-filled notice
3. Open Tables browser: card with theme, seats, **clock badge**, host; filters/sort
4. Create public table (clock picker + optional scheduled start)
5. Table lobby, host view: seats filled, **Start button**, bot-fill choice, edit schedule, cancel
6. Table lobby, player view: countdown to scheduled start, "waiting for host" state, leave
7. Draft room with the **pick clock**, auto-pick state, and Away badges
8. "Your turn" inbox for slow drafts
9. Results with points earned
10. Leaderboard, player card, and the profile **hover card** (full display name + stats)
11. Report / block flows
12. Notification preferences
13. "You're now host" handoff prompt and the "table cancelled" notice

## 12. Build phases

**Phase 0 — Decisions & design**
- [x] Core product decisions made (section 2)
- [ ] Settle the few small open items in section 14
- [ ] Design the screens in section 11, clock picker first

**Phase 1 — The Referee (foundation, also improves private drafts)**
*Built 2026-11-04 and tested (90 automated tests). **Not yet applied to the live Supabase project.** Setup, rollout and rollback: [referee-setup.md](referee-setup.md).*
- [x] Per-draft pick clock + current-turn deadline
- [x] Server-side "resolve overdue turn" (idempotent, row-locked)
- [x] Scheduled backstop sweep (SQL provided in the setup guide; needs your Supabase project)
- [x] Bot/auto-pick moved off the host's browser (`referee-tick` edge function; needs deploying)
- [x] Strikes / Away logic
- [x] Record who made each pick (player / auto-pick / bot) from day one, so rated-points rules can use it later
- [x] Clock UI in the draft room (countdown + Away message; host's picker is admin-only until `REFEREE_CLOCK_VISIBLE_TO_ALL` is flipped) and "your turn" notification
- [ ] Still to do: "auto-picked" tag on individual board cells; Away badge in the player list
- [x] Automated tests for turns, picks, and overdue resolution
- [ ] Admin-only trial on the live project (year, people and spec drafts)
- Done when: a draft with a 60 sec clock finishes with every human idle, and a host closing their tab doesn't stall the bots. (Proven in tests; to be proven live in the trial.)

**Phase 2 — Lobbies & Open Tables** *(requires section 8 gate)*

*Built 2026-11-05 and tested (206 automated tests across all suites). **Not yet applied to the live Supabase project.** Setup, trial and rollback: [public-play-setup.md](public-play-setup.md). Controlled by a database-enforced switch (`off` / `admin_only` / `on`), set to admin-only by default.*
- [x] Lobby states (forming → active → complete / cancelled) and public visibility
- [x] Create public table with host-set clock, seats, rated/casual, optional scheduled start
- [x] Browse, filter, join, leave (before start)
- [x] Host-only Start (host alone is enough; solo = unrated practice with bots), bot-fill choice, 15-second ready check for live-clock tables
- [x] Reminders to players and a "time to start" nudge to the host
- [x] Host no-show sweep (15 min live / 24 h slow): hand the host role to the next-joined player, cancel only if nobody can take it; notify everyone
- [x] Lock clock, format, seats and rated setting at creation (a new host can change only the schedule)
- [x] Schedule edits notify joined players
- [x] Public names (chosen by the player, filtered, never an email), report / block / ban, rate limits, and write guards so players can't edit tables, picks or host status through the API
- [ ] Profile hover card with play stats (needs the Phase 4 stats)
- [ ] Admin-only trial on the live project, then Terms/Privacy review and a plan for handling reports, before switching to "Everyone"

**Phase 3 — Quick Match (live)** *(built 2026-11-06, tested, not yet applied: see [public-play-setup.md](public-play-setup.md))*
- [x] Quick Match pool: the 50 most recent full years, 50 suggested actors, your Special Drafts. Every entry starts **switched off**; you approve entries (vetting for enough movies is your review).
- [x] Admin screen (`/admin/quick-match`): switch entries on/off, bulk switch, add/remove actors, sync new years and special drafts
- [x] Random draw per match (equal thirds by type; nobody gets the same entry twice in a row)
- [x] One button → forming lobby assignment (atomic: no two lobbies opened by people searching together; blocked pairs never matched)
- [x] Fill timer (40s, +15s for latecomers) + bot fill after the wait with 2+ real players + honest messaging; a lone player chooses to keep waiting or practise vs bots (unrated)
- [x] 15-second ready check; abandoned lobbies close after 3 minutes
- [x] "Find another game" after a game. (A dedicated rematch button is not built.)
- [ ] Vet pool entries automatically with `analyze-category-availability` (today the admin judges which are on)

**Phase 4 — Competitive** *(built 2026-11-06, tested, not yet applied)*
- [x] Server-side scoring of finished rated games (reuses `enrich-movie-data`; waits for scores; voided after 48 hours without them)
- [x] Points 10/7/5/3/2/1 among qualifying **real** players; ties share a place; bots never ranked
- [x] Idle-account guard (≥ half your own picks, else out of the ranking) and "2+ qualifying players needed for any points"
- [x] Win-farming guard (×0.5 after 2 earlier rated games with the same opponent in 7 days, ×0.25 after 5)
- [x] Reliability record and cooldown (3 games in a week without playing your own picks → 1-day break)
- [x] Public leaderboard (this quarter / all time), "my standing", player hover cards, points panel on Final Scores
- [ ] Hover cards in the live draft room's roster (they're in the lobby, leaderboard and results)

**Phase 5 — Mobile** *(not started: needs your Apple/Google accounts and coordination with the in-progress mobile app)*
- [ ] Push notifications for turns / matches (and email for slow-game turns on the web)
- [ ] Realtime reconnect on app resume
- [ ] Public play screens in the Expo app

**Phase 6 — Liquidity boosters**
- [x] Invite a friend into a public table (copy an invite link; `/play?join=<id>`)
- [ ] Featured scheduled drafts run by the site (needs a system "host"; design needed)
- [ ] Spectating active public drafts

## 13. Data changes (plain English)

- **drafts**: lobby visibility (new column — note `is_public` already exists and means "results/voting are public", so don't reuse that name), lobby state, pick clock seconds (database-enforced 30–86,400), current-turn deadline, seats (max, min real players), planned start time (optional; informational + drives reminders — it never starts the draft), host no-show deadline, host-handoff count, started-by-host marker, rated flag, how it was created (quick / open / private / featured).
- **draft_participants**: auto-pick count, Away flag, replaced-by-bot marker. Join order (existing `joined_at`) decides who becomes host if the host drops.
- **draft_picks**: pick source (made by the player / auto-pick / bot), which powers the idle-account guard.
- **profiles**: public-safe fields view, ban/cooldown flags.
- **New tables**: player reports, player blocks, notification preferences, and the Quick Match pool (the vetted years, actors and themed lists, editable in Admin).
- **Notification types**: extend the allowed list (currently only draft invite, league invite, upcoming draft).
- **Leaderboard**: a view built on finished rated drafts.

## 14. Still open (small items; recommended default in brackets)

The big product decisions are in section 2. **Everything below was built using the stated default** unless a note says otherwise (equal-thirds mix, "past 50 years" = the 50 most recent full years, actor list seeded as a suggestion for you to review, 5 default categories, the win-farming tiers, handoff limit 2, clock presets, Quick Match needing 2 real players). Change any of them by editing the migration or telling me. What was open:

1. **How the Quick Match mix is weighted.** [Equal thirds by type (year / actor / themed), then random within the type; never repeat an entry for the same player twice in a row]
2. **What "past 50 years" means.** [The 50 most recent *full* calendar years: 1976–2025 as of 2026, rolling forward each January]
3. **Who defines the "top 50 actors"?** [A hand-curated list you approve, seeded from popularity data, stored in an admin-editable table]
4. **Default categories and rounds per format** for Quick Match, since no host is there to choose. [Reuse each format's pre-selected defaults from the setup form; aim for ~20 minutes typical]
5. **Win-farming guard** for 2-player rated games. [Diminishing points for repeated games against the same opponents within a week]
6. **Final clock preset list** for the host's picker. [As in section 3, with 90 sec in the Live group]
7. **Handoff limit.** [At most 2 automatic handoffs per table, then cancel]
8. **Quick Match minimum.** Quick Match has no host, so it needs at least 2 real players, otherwise the player is offered "keep waiting" or "practice vs bots". [2 real players]

## 15. Risks

1. **Empty rooms** — mitigations in section 6.
2. **Double-resolving a turn** (two clients nudging at once) — solved by an idempotent, row-locked server function; needs tests.
3. **Fragile existing multiplayer code** — large hook/component with recent turn-order bugs; test first.
4. **Movie-data API limits** — many simultaneous live drafts plus server-side auto-picks all hit the movie data function.
5. **Realtime load** — fine per draft; the lobby list should not stream every change from a busy table. Poll or use lightweight broadcast.
6. **Abuse** — see section 8.
7. **Cost** — database usage and email volume from turn reminders.
8. **Host no-shows** — because hosts start their own tables, a host who forgets leaves players waiting. Mitigations: reminders to the host, a visible "waiting for host" state, automatic handoff to the next-joined player after the grace period (cancel only if nobody can take it), and a reliability record for hosts who repeatedly no-show.
9. **Win-farming in rated games** — rated needs only 2 real players, so two friends could repeatedly play each other plus bots for points. Mitigation to confirm: diminishing points against the same opponents (section 14).
10. **Privacy of the hover card** — it must only ever expose display name and play stats. Test that no real name or email can reach the public profile view.
11. **Thin movie pools** — some years, actors or themed lists won't have enough good movies for 4 players across every category. Mitigation: only vetted entries enter the Quick Match pool, re-checked when movie data changes.
12. **Idle accounts farming points** — auto-picks are as strong as bots, so an idle account still scores well. Mitigation: the idle-account guard (section 2), plus the reliability record.

## 16. Not in v1

Chat between strangers · friends lists · skill-based (Elo) matchmaking · tournaments · spectating · paid features.
