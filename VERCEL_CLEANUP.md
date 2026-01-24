# Vercel Deployment Cleanup Guide

This guide will help you completely reset and fix your Vercel deployments.

## Step 1: Clean Up Vercel Dashboard

### Option A: Delete and Recreate Project (Recommended for Clean Slate)

1. **Go to Vercel Dashboard**
   - Navigate to https://vercel.com/dashboard
   - Find your project

2. **Delete the Project**
   - Go to Project Settings → General
   - Scroll to bottom → "Delete Project"
   - Confirm deletion

3. **Recreate the Project**
   - Click "Add New Project"
   - Import your Git repository
   - Configure:
     - Framework Preset: **Vite**
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Install Command: `npm install` (explicitly set this)

4. **Set Environment Variables**
   - Add all your environment variables again
   - Make sure they're set for both Production and Preview

### Option B: Clear Build Cache (Less Invasive)

1. **Go to Project Settings**
   - Navigate to your project in Vercel dashboard
   - Go to Settings → General

2. **Clear Build Cache**
   - Scroll to "Build & Development Settings"
   - Click "Clear Build Cache"
   - Confirm

3. **Redeploy**
   - Go to Deployments tab
   - Click "..." on latest deployment → "Redeploy"
   - Or push a new commit

## Step 2: Verify Local Configuration

### Check These Files Are Correct:

✅ **`.vercelignore`** - Should ignore all Python files
✅ **`vercel.json`** - Should have `installCommand: "npm install"`
✅ **No `requirements.txt` in root** - Should be in `scripts/letterboxd/`

### Verify Python Files Are Ignored:

```bash
# Check that Python files are properly ignored
ls -la | grep requirements.txt  # Should not exist in root
ls scripts/letterboxd/requirements.txt  # Should exist here
```

## Step 3: Force a Clean Deployment

### Method 1: Empty Commit (Recommended)

```bash
# Make sure all changes are committed
git add .
git commit -m "Fix: Remove Python dependencies from Vercel build"

# Push to trigger new deployment
git push origin main
```

### Method 2: Clear Git History (Nuclear Option - Only if needed)

If you have problematic commits in history:

```bash
# Create a new orphan branch
git checkout --orphan clean-main

# Add all files
git add .

# Commit
git commit -m "Clean deployment - Python deps removed"

# Force push (WARNING: This rewrites history)
git push -f origin main
```

## Step 4: Verify Deployment

After deployment completes:

1. **Check Build Logs**
   - Should NOT see any Python/lxml errors
   - Should only see `npm install` and `npm run build`
   - Build should complete successfully

2. **Test the Site**
   - Visit your Vercel URL
   - Verify the app loads correctly

## Step 5: Monitor Future Deployments

If issues persist:

1. **Check Build Logs** for any Python-related errors
2. **Verify `.vercelignore`** is being respected
3. **Check Vercel Settings** → Build & Development Settings
   - Ensure "Install Command" is set to `npm install`
   - Ensure "Build Command" is set to `npm run build`

## Troubleshooting

### If Python errors still appear:

1. **Double-check `.vercelignore`** is committed to git
2. **Verify `vercel.json`** has `installCommand: "npm install"`
3. **Check Vercel Project Settings** - override any auto-detected settings
4. **Contact Vercel Support** if issues persist

### If build still fails:

1. **Check build logs** for the actual error
2. **Verify Node.js version** in Vercel settings (should be 18.x or 20.x)
3. **Clear build cache** in Vercel dashboard
4. **Try redeploying** from a specific commit

## Prevention

To prevent this in the future:

- ✅ Keep `requirements.txt` in `scripts/letterboxd/` (not root)
- ✅ Keep `.vercelignore` updated with Python exclusions
- ✅ Never commit Python virtual environments
- ✅ Use `npm install` explicitly in `vercel.json`
