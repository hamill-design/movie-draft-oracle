/**
 * Writes dist/sitemap-themes.xml listing every public /special-draft/:slug URL from Supabase.
 * Run after `vite build` so the file is deployed with the static output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

const SITE = "https://moviedrafter.com";
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "https://zduruulowyopdstihfwk.supabase.co").replace(/\/$/, "");
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdXJ1dWxvd3lvcGRzdGloZndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU1NTYsImV4cCI6MjA2Njg5MTU1Nn0.MzDpL-_nYR0jNEO-qcAf37tPz-b5DZpDCVrpy1F_saY";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Returns [{ slug, updated_at }]. */
async function fetchThemes() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/spec_drafts?select=slug,updated_at&is_hidden=eq.false`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    console.warn("generate-theme-sitemap: spec_drafts fetch HTTP", res.status);
    return [];
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      slug: typeof r.slug === "string" ? r.slug.trim() : "",
      updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
    }))
    .filter((r) => r.slug);
}

if (!fs.existsSync(dist)) {
  console.error("generate-theme-sitemap: dist/ missing — run vite build first.");
  process.exit(1);
}

// lastmod is each draft's real last-edit date. We never stamp the build date: a date that changes
// on every deploy teaches Google to ignore lastmod. No known date -> omit the tag entirely.
const themes = await fetchThemes();
const slugs = themes.map((t) => t.slug);
const urlEntries = themes.map(({ slug, updated_at }) => {
  const lastmod = updated_at ? updated_at.slice(0, 10) : "";
  return `  <url>
    <loc>${SITE}/special-draft/${escapeXml(slug)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join("\n")}
</urlset>
`;

const outPath = path.join(dist, "sitemap-themes.xml");
fs.writeFileSync(outPath, xml, "utf8");
console.log("generate-theme-sitemap: wrote", outPath, `(${slugs.length} theme URLs)`);
