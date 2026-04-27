# Resend marketing segment (automated from profile opt-in)

Users who turn on **product / marketing email** in **Profile** (or at signup) are synced to your **Resend segment** automatically. The app database (`profiles.marketing_emails_opt_in`) stays the source of truth; Resend receives create/update contact + **add to segment** calls.

## How it works

1. User toggles marketing on in **`/profile`** (or checks the box at signup → profile row created via trigger).
2. The client calls **`sync-marketing-audience`** (`src/lib/marketingAudienceSync.ts`).
3. Edge Function **`sync-marketing-audience`** (`supabase/functions/sync-marketing-audience/index.ts`):
   - Requires a **logged-in session** (Bearer JWT).
   - If opted **out**: deletes the Resend **contact** (global) for that email.
   - If opted **in** and email is **confirmed**:
     - `POST /contacts` (or `PATCH` if duplicate),
     - then `POST /contacts/{email}/segments/{segmentId}` so they appear in your marketing **segment** in Resend.
4. After **email confirmation**, `AuthContext` runs a one-time **`syncMarketingAudience()`** so signup opt-in propagates without opening Profile.

## What you configure (Supabase + Resend)

| Item | Where |
|------|--------|
| `RESEND_API_KEY` | Supabase Edge Function secrets |
| `RESEND_MARKETING_AUDIENCE_ID` | Same — use your **segment** UUID from the Resend dashboard (Audiences map to segments) |
| `sync-marketing-audience` deployed | `npx supabase functions deploy sync-marketing-audience --no-verify-jwt` |
| `verify_jwt = false` for this function | Already in `supabase/config.toml` so browser **OPTIONS** preflight succeeds |

No JWT “marketing link” secret is required for this path.

## Operational checks

- **Profile toggle** → Network: `POST .../sync-marketing-audience` returns **200** with `action: created` / `updated` / `removed_or_absent`.
- **Resend** → segment shows the contact after opt-in.
- **Unsubscribe** from a marketing email: **`resend-marketing-webhook`** can set `marketing_emails_opt_in` false when Resend sends the webhook (configure URL + `RESEND_WEBHOOK_SECRET`).

## Marketing broadcast email (optional)

Use **`docs/email-templates/marketing-opt-in-resend.html`** for styled broadcasts. CTAs can point to **`https://moviedrafter.com/profile`** so people sign in and enable the toggle; no per-user token is required.
