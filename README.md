# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/964f15f1-a644-4dc2-849a-48e1e55bfa91

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/964f15f1-a644-4dc2-849a-48e1e55bfa91) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

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

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/964f15f1-a644-4dc2-849a-48e1e55bfa91) and click on Share -> Publish.

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

### 5) Preview deployments as staging
- Every PR or push to a non-main branch gets a Preview deployment with its own URL.
- Use this Preview URL as your "staging" for testing multiplayer joins.

### 6) Test
- Open the Preview or Production URL on two devices/browsers.
- Create a draft and join via invite code.

If auth redirect fails or Realtime doesn’t connect, double-check:
- Env vars are present on Vercel (Preview and Production)
- Supabase Auth Redirect URLs include the current domain
- Using HTTPS URLs

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
