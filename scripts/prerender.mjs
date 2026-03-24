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

/** Paths must match react-router (no trailing slash). */
const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/learn-more",
  "/privacy-policy",
  "/terms-of-service",
  "/draft",
];

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
