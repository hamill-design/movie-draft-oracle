# Movie Drafter — mobile app

The native (iOS + Android) app for Movie Drafter, built with Expo. It talks to the
same Supabase backend as the web app. See [`../docs/mobile-app-plan.md`](../docs/mobile-app-plan.md)
for the full plan and roadmap.

## Run it

```bash
cd mobile
npm install            # first time only
npx expo start         # then press 'i' (iOS), 'a' (Android), or 'w' (web)
```

To run on your own phone, install **Expo Go** from the App Store / Play Store and
scan the QR code that `npx expo start` prints.

## What's here so far (Phase 1 — walking skeleton)

- Expo Router navigation (`app/` folder)
- NativeWind for styling (Tailwind classes in React Native)
- Supabase client with session stored on-device (`lib/supabase.ts`)
- Email/password sign in + sign up (`app/login.tsx`)
- "Your leagues" list pulled from the live database (`app/leagues.tsx`)

## Config

- Supabase keys live in `.env` (`EXPO_PUBLIC_*`). Same project as the web app.

## Not done yet (next steps)

- Google sign-in (needs native deep-link / OAuth setup — the known hard part)
- The rest of the core loop (create/join league, the draft, scoring, voting)
- Push notifications, app icon + splash, store submission

## Stack

Expo · Expo Router · NativeWind · Supabase · EAS (for builds/submission later)
