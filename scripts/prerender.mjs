/**
 * Post-build: prerender allowlisted SPA routes into dist/ so static hosts (e.g. Vercel)
 * serve real HTML before the SPA fallback rewrite.
 *
 * Vercel build images lack system libs for Puppeteer's bundled Chrome; on Vercel Linux
 * we use @sparticuz/chromium + puppeteer-core. Locally we use puppeteer-core with
 * puppeteer's downloaded Chrome (see devDependency puppeteer).
 */
import puppeteerCore from "puppeteer-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}`;

/** True on Vercel builders (Linux); avoid Sparticuz on darwin (e.g. local `vercel build`). */
function useVercelChromium() {
  return process.env.VERCEL === "1" && process.platform === "linux";
}

async function launchBrowser() {
  if (useVercelChromium()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteerCore.launch({
    headless: true,
    executablePath: puppeteer.default.executablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

/** Default API (same fallbacks as `src/integrations/supabase/client.ts`) so local builds can prerender theme URLs. */
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "https://zduruulowyopdstihfwk.supabase.co").replace(/\/$/, "");
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdXJ1dWxvd3lvcGRzdGloZndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU1NTYsImV4cCI6MjA2Njg5MTU1Nn0.MzDpL-_nYR0jNEO-qcAf37tPz-b5DZpDCVrpy1F_saY";

/** Paths must match react-router (no trailing slash). Theme detail routes appended after fetch. */
const BASE_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/learn-more",
  "/how-to-draft",
  "/special-draft",
  "/privacy-policy",
  "/terms-of-service",
  "/draft",
];

async function fetchThemeSlugRoutes() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/spec_drafts?select=slug&is_hidden=eq.false`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) {
      console.warn("prerender: spec_drafts slug fetch HTTP", res.status);
      return [];
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => (typeof r.slug === "string" ? r.slug.trim() : ""))
      .filter(Boolean)
      .map((slug) => `/special-draft/${slug}`);
  } catch (e) {
    console.warn("prerender: could not fetch theme slugs", e?.message || e);
    return [];
  }
}

function waitForServer(url, { maxMs = 120_000, intervalMs = 250 } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(url)
        .then((res) => {
          if (res.ok) resolve();
          else schedule();
        })
        .catch(() => schedule());
    };
    const schedule = () => {
      if (Date.now() - start > maxMs) {
        reject(new Error(`Timeout waiting for preview server at ${url}`));
        return;
      }
      setTimeout(tryOnce, intervalMs);
    };
    tryOnce();
  });
}

function writeRouteHtml(route, html) {
  if (route === "/") {
    fs.writeFileSync(path.join(dist, "index.html"), html, "utf8");
    return;
  }
  const segment = route.replace(/^\//, "");
  const dir = path.join(dist, segment);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

async function main() {
  if (!fs.existsSync(dist)) {
    console.error("dist/ missing — run vite build first.");
    process.exit(1);
  }

  const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
  const preview = spawn(process.execPath, [viteBin, "preview", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });

  try {
    await waitForServer(BASE);

    const themeRoutes = await fetchThemeSlugRoutes();
    const ROUTES = [...BASE_ROUTES, ...themeRoutes];
    if (themeRoutes.length) {
      console.log("prerender: +", themeRoutes.length, "theme URLs");
    }

    const browser = await launchBrowser();
    const page = await browser.newPage();

    for (const route of ROUTES) {
      const url = `${BASE}${route}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await delay(2500);
      const html = await page.content();
      writeRouteHtml(route, html);
      console.log("Prerendered", route);
    }

    await browser.close();
  } finally {
    preview.kill("SIGTERM");
    await delay(500);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
