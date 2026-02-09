# Movie Draft Oracle

A web application for creating and participating in movie drafts with friends.

## How can I edit this code?

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

The app will be available at **http://localhost:8080** (or http://127.0.0.1:8080). To stop the server, press `Ctrl+C` in the terminal.

**Running localhost in the future (after the first setup):**
1. Open a terminal in the project folder.
2. Run: `npm run dev`
3. Open http://localhost:8080 in your browser.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Deploying to Vercel (Production + Preview/Staging)

This app is a Vite + React SPA. We've added `vercel.json` for SPA routing.

### 1) Import the repository in Vercel
- Go to your Vercel dashboard → "Add New Project" → "Import Git Repository".
- Select this repository.

### 2) Set Build & Output
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### 3) Environment Variables
Set these for both Production and Preview environments:
- `VITE_SUPABASE_URL` = your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
- Optional: `VITE_GOOGLE_ADSENSE_CLIENT_ID`

Tip: Ensure these keys match the Supabase project you want the deployment to use.

### 4) Supabase configuration for Auth and Functions
- Authentication → URL Configuration:
  - Site URL: your Production Vercel domain
  - Redirect URLs: add both your Production and Preview domains
- Edge Functions (if used): Project Settings → API → CORS → Allowed origins: add both your Production and Preview domains.

**Deploying Supabase Edge Functions** (e.g. after changing `supabase/functions/*`):
1. Log in: `npx supabase login` (or set `SUPABASE_ACCESS_TOKEN`).
2. Link the project if needed: `npx supabase link --project-ref <your-project-ref>`.
3. Deploy all functions: `npm run deploy:functions`  
   Or deploy only the category-analysis function: `npm run deploy:functions:analyze`.
   - **If you get "Bundle generation timed out"** (e.g. when Docker isn’t running): use the Management API to bundle: `npm run deploy:functions:use-api`. To deploy only `fetch-movies`: `npm run deploy:functions:fetch-movies`.
4. **Academy Awards JSON (required for correct Oscar counts):** The `fetch-movies` function loads Oscar data from a URL. You must set the secret `ACADEMY_AWARDS_JSON_URL` to the public URL of `data/academy-awards.json` (e.g. after uploading it to Supabase Storage) for Academy Award category counts to work correctly. See `docs/category-count-flow.md` for steps. If unset, the Academy Awards map stays empty and Oscar counts rely only on `oscar_cache` and OMDb (counts may be wrong or missing).

### 5) Preview deployments as staging
- Every PR or push to a non-main branch gets a Preview deployment with its own URL.
- Use this Preview URL as your "staging" for testing multiplayer joins.

### 6) Test
- Open the Preview or Production URL on two devices/browsers.
- Create a draft and join via invite code.

If auth redirect fails or Realtime doesn't connect, double-check:
- Env vars are present on Vercel (Preview and Production)
- Supabase Auth Redirect URLs include the current domain
- Using HTTPS URLs

### 7) Production Branch and Domain Configuration

**Production Branch:**
- In Vercel dashboard → Project Settings → Git
- Set the Production Branch (typically `main` or `master`)
- This branch will trigger production deployments

**Custom Domain (Cloudflare):**
- In Vercel dashboard → Project Settings → Domains
- Add your custom domain (`moviedrafter.com` and `www.moviedrafter.com`)
- Vercel will provide DNS records to configure
- In Cloudflare dashboard:
  1. Go to your domain → DNS → Records
  2. For apex domain (`moviedrafter.com`):
     - Find the existing record for `@` (or root domain)
     - **CRITICAL:** Click the orange cloud icon to turn it GRAY (DNS only)
     - Type: Should be `CNAME` or `A` record pointing to Vercel
     - Target: Should match what Vercel provided
     - Proxy status: **MUST be DNS only (gray cloud)** - Orange cloud causes SSL errors
  3. For www subdomain (`www.moviedrafter.com`):
     - Type: `CNAME`
     - Name: `www`
     - Target: The value Vercel provides
     - Proxy status: **DNS only (gray cloud)** - Should already be working
  4. Wait 5-10 minutes for DNS propagation
  5. Verify in Vercel dashboard that both domains show "Valid Configuration"

**Troubleshooting SSL Errors:**
- If you get `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` on apex domain:
  - The apex domain has Cloudflare proxy enabled (orange cloud)
  - Go to Cloudflare DNS → Click the orange cloud icon next to `@` record → Turn it gray
  - Wait 5-10 minutes for changes to propagate
  - Clear browser cache and try again

**Important:** Cloudflare proxy (orange cloud) conflicts with Vercel's SSL certificates. Always use DNS only (gray cloud) for Vercel domains.
