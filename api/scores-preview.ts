/**
 * Vercel Node runtime: serves the SPA shell for /final-scores/:id with per-draft Open Graph /
 * Twitter tags injected, so links unfurl as the specific draft (iMessage, Discord, X, WhatsApp,
 * Slack, …) instead of the generic site card. Humans still boot the normal SPA.
 *
 * Wired via a vercel.json rewrite: /final-scores/:id -> /api/scores-preview?id=:id
 */
export const config = { runtime: 'nodejs' };

const SITE_ORIGIN = 'https://moviedrafter.com';

/** Same fallbacks as scripts/prerender.mjs — the anon key is a public client key, not a secret. */
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co').replace(
  /\/$/,
  ''
);
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdXJ1dWxvd3lvcGRzdGloZndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTU1NTYsImV4cCI6MjA2Njg5MTU1Nn0.MzDpL-_nYR0jNEO-qcAf37tPz-b5DZpDCVrpy1F_saY';

/** Escape a string for safe use inside an HTML attribute (content="..."). */
const attr = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function fetchDraft(id: string): Promise<{ title: string; is_public: boolean } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/drafts?id=eq.${encodeURIComponent(id)}&select=title,is_public`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

function buildMetaBlock(opts: { title: string; description: string; image: string; url: string }): string {
  const t = attr(opts.title);
  const d = attr(opts.description);
  const img = attr(opts.image);
  const url = attr(opts.url);
  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Movie Drafter" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${t}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />`;
}

/** Strip the shell's existing title + og:* / twitter:* meta, then inject the per-draft block. */
function injectMeta(html: string, metaBlock: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta[^>]+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta[^>]+name="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/<head[^>]*>/i, (m) => `${m}\n${metaBlock}`);
}

export default async function handler(request: Request): Promise<Response> {
  const reqUrl = new URL(request.url);
  const id = reqUrl.searchParams.get('id') || '';
  // Use the request origin so previews resolve their own assets/images on any deployment.
  const origin = reqUrl.origin || SITE_ORIGIN;

  // Defaults (also used if the draft is private or not found — never leak private titles).
  let ogTitle = 'Movie Drafter – Final Scores';
  let ogDescription = 'See the final scores of this movie drafting game on Movie Drafter.';
  let ogImage = `${origin}/og-image.jpg?v=2`;
  const pageUrl = `${origin}/final-scores/${id}`;

  const draft = id ? await fetchDraft(id) : null;
  if (draft?.is_public && draft.title) {
    const title = String(draft.title).slice(0, 90);
    ogTitle = `Final scores: ${title}`;
    ogDescription = `See who won the “${title}” movie draft on Movie Drafter.`;
    const imgUrl = new URL(`${origin}/api/og-scores`);
    imgUrl.searchParams.set('title', `Final scores: ${title}`);
    imgUrl.searchParams.set('subtitle', 'See who won on Movie Drafter');
    ogImage = imgUrl.toString();
  }

  const metaBlock = buildMetaBlock({
    title: ogTitle,
    description: ogDescription,
    image: ogImage,
    url: pageUrl,
  });

  let html = '';
  try {
    const shellRes = await fetch(`${origin}/index.html`, { headers: { 'User-Agent': 'scores-preview' } });
    if (shellRes.ok) html = await shellRes.text();
  } catch {
    /* fall through to minimal shell */
  }

  const body = html
    ? injectMeta(html, metaBlock)
    : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />${metaBlock}</head><body></body></html>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Edge-cache the rendered shell per draft; results rarely change once final.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
