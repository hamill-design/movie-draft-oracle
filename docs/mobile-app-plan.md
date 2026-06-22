# Movie Drafter — Native Mobile App Plan

> Living document. Last updated 2026-06-19.
> This is the reference for building the Movie Drafter native mobile app. Check boxes off as we go.

## 1. The decision

We're building a **native mobile app** for Movie Drafter using **React Native + Expo**, shipping to **both the Apple App Store and Google Play**.

We chose the full native rebuild over Capacitor (a webview wrapper) deliberately: we want true native feel and performance, and we accept that it's a multi-month effort built one piece at a time.

## 2. Scope — the app is the product, not the website

The mobile app is **not** a 1:1 copy of moviedrafter.com. The website does a lot of work that an app doesn't need (marketing, SEO, content). The app is only the **core product loop**.

**In the native app:**
- Sign in / sign up (email + Google)
- Your leagues & active drafts (a logged-in home/dashboard — new, not the marketing homepage)
- Create or join a league
- Draft lobby
- The live draft — search, board, roster *(the heart of the app)*
- Draft setup (by year, filmography, theme, spec)
- Final scores & results
- Voting
- Profile
- Notifications

**Stays on the web (moviedrafter.com):**
- Marketing homepage (the Spline 3D scene — not needed in-app)
- Blog & news
- About, FAQ, how-to, learn more
- Contact
- Privacy & terms
- Admin dashboard

The app can link out to these web pages (e.g. privacy policy) when required by the stores.

## 3. What carries over vs. what gets rebuilt

Going native rebuilds the **visual layer only**. The logic comes with us.

| Comes with you (logic) | Gets rebuilt (visual) |
|---|---|
| Supabase backend — auth, database, realtime, edge functions (unchanged) | Every screen & component: Radix/shadcn → React Native components |
| Data layer — TanStack Query + the data hooks | Styling: Tailwind → NativeWind (same class names, native engine) |
| Forms & validation — react-hook-form + Zod (both run in RN) | Navigation: react-router → Expo Router (file-based) |
| TypeScript types — Supabase types regenerate identically | Drag-to-reorder draft board: @dnd-kit → native gestures |
| Business rules — scoring, draft order, validation | Share-results image: html2canvas → react-native-view-shot |
| | Spline 3D homepage: dropped in-app |

## 4. Tech stack

- **Expo** (managed workflow) — handles the painful native build plumbing.
- **Expo Router** — file-based screens; same mental model as the web `pages/` folder.
- **NativeWind** — Tailwind for React Native (we already know Tailwind).
- **React Native Reusables** — shadcn-style component kit for RN, so the rebuild feels familiar.
- **Supabase JS** + `@react-native-async-storage/async-storage` for session storage.
- **EAS** (Expo Application Services) — cloud builds, store submission, and over-the-air JS updates.

## 5. Project structure

The Expo app lives in a `mobile/` subfolder of this repo (kept separate from the Vite web app — two different toolchains).

```
movie-draft-oracle/
  src/            ← existing web app (Vite)
  mobile/         ← the new Expo app
    app/          ← Expo Router screens
    lib/          ← supabase client, helpers
    contexts/     ← auth context
    components/    ← shared RN components
```

Backend is **shared**: the mobile app talks to the same Supabase project as the web app. Supabase types are regenerated into `mobile/` (no duplicated backend). We deliberately avoid a web+mobile monorepo for now — it adds real setup pain in React Native. We can graduate to shared packages later if duplication starts to hurt.

## 6. Roadmap (vertical slices)

We build one working flow at a time, so there's always something real on a phone.

### Phase 1 — Walking skeleton (~1–2 weeks)
- [x] Expo project scaffolded with Expo Router + NativeWind
- [x] Supabase client wired with AsyncStorage session persistence
- [x] Email/password login + sign-up screen (verified: live Supabase auth round-trip works)
- [ ] Verify session persists across app restarts (test on device)
- [~] "Your leagues" screen — built, mirrors the web query; verify once signed in on a device
- [~] Google sign-in — built (in-app browser + deep-link, PKCE); needs the redirect URL added in Supabase + a dev build to test end-to-end

### Phase 2 — The core loop (~4–8 weeks)
- [ ] Create / join a league
- [ ] Draft lobby
- [ ] The live draft: movie search, draft board, roster (the big one)
- [ ] Draft setup modes (year, filmography, theme, spec)
- [ ] Final scores & results
- [ ] Voting

### Phase 3 — Native polish (~2–3 weeks)
- [ ] Push notifications (expo-notifications) wired to the existing notification system
- [ ] Realtime reconnect when the app returns from background
- [ ] App icon & splash screen
- [ ] Safe areas (notch / home indicator)
- [ ] Share-results image (react-native-view-shot)
- [ ] Loading / empty / offline states

### Phase 4 — Store launch (~1–2 weeks + review)
- [ ] EAS Build for iOS + Android
- [ ] Apple Developer account ($99/yr)
- [ ] Google Play Developer account ($25 one-time)
- [ ] Store listings + screenshots + app icon
- [ ] Privacy nutrition labels / data safety forms
- [ ] Submit for review
- [ ] EAS Update set up for future JS-only updates (no re-review)

## 7. Known hard parts (budget extra time)

1. **Google sign-in (the #1 item).** On the web it's a simple redirect. In a native app the OAuth result has to come *back into the app* via a deep link (custom URL scheme / universal link), and the redirect URL must be registered in the Supabase dashboard. Email/password is easy; Google needs this native plumbing.
2. **Live drafts + app backgrounding.** Supabase realtime channels must reconnect when the app resumes from the background, or a live draft silently desyncs.
3. **Draft board drag-to-reorder.** `@dnd-kit` is web-only; this becomes a native gesture rebuild (react-native-gesture-handler + reanimated).
4. **Share image.** `html2canvas` doesn't exist in RN; rebuild with `react-native-view-shot`.

## 8. How to run it (once scaffolded)

```bash
cd mobile
npm install              # first time only
npx expo start           # then scan the QR code with the Expo Go app on your phone
```

- Install **Expo Go** from the App Store / Play Store to run it on your own phone instantly.
- `npx expo start --web` runs it in a browser (handy for quick checks).
- Environment variables live in `mobile/.env` (Supabase URL + anon key), prefixed `EXPO_PUBLIC_`.

## 9. Costs & accounts checklist

- [ ] Apple Developer Program — $99/year (required to ship to the App Store)
- [ ] Google Play Developer — $25 one-time
- [ ] Expo account — free tier is fine to start (EAS has paid tiers for heavier build usage)
