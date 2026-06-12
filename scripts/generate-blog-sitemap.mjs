/**
 * Writes dist/sitemap-blog.xml listing /blog plus every published /blog/:slug URL from Supabase.
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

async function fetchBlogPosts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?select=slug,updated_at&status=eq.published`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    console.warn("generate-blog-sitemap: blog_posts fetch HTTP", res.status);
    return [];
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => typeof r.slug === "string" && r.slug.trim());
}

if (!fs.existsSync(dist)) {
  console.error("generate-blog-sitemap: dist/ missing — run vite build first.");
  process.exit(1);
}

const lastmod = new Date().toISOString().slice(0, 10);
const posts = await fetchBlogPosts();

const urlEntries = [
  `  <url>
    <loc>${SITE}/blog</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
  ...posts.map((post) => {
    const postLastmod =
      typeof post.updated_at === "string" && post.updated_at ? post.updated_at.slice(0, 10) : lastmod;
    return `  <url>
    <loc>${SITE}/blog/${escapeXml(post.slug.trim())}</loc>
    <lastmod>${postLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join("\n")}
</urlset>
`;

const outPath = path.join(dist, "sitemap-blog.xml");
fs.writeFileSync(outPath, xml, "utf8");
console.log("generate-blog-sitemap: wrote", outPath, `(${posts.length} blog post URLs)`);
