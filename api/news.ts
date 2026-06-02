/**
 * Vercel serverless news proxy.
 * GET /api/news → returns { items: NewsItem[], errors: string[] }
 *
 * Fetches all configured feeds in parallel server-side (no CORS issues),
 * merges the results, and sorts newest-first.
 *
 * IMPORTANT: Each feed gets its own AbortController. The global timeout
 * explicitly aborts ALL controllers before returning — this is required
 * in Vercel's Lambda runtime, which keeps the function alive as long as
 * there are open network connections, regardless of Promise.race resolving.
 */
export const config = { runtime: 'edge' };

// ── Feed list ─────────────────────────────────────────────────────────────────

const FEEDS: { url: string; label: string }[] = [
  { url: 'https://www.filmcomment.com/feed/',            label: 'Film Comment'     },
  { url: 'https://lwlies.com/feed.rss',                  label: 'Little White Lies' },
  { url: 'https://www.rogerebert.com/feed',              label: 'RogerEbert.com'   },
  { url: 'https://www.indiewire.com/t/film/feed/',       label: 'IndieWire'        },
  { url: 'https://letterboxd.com/journal/rss/',          label: 'Letterboxd'       },
  { url: 'https://mubi.com/notebook/posts.rss',          label: 'MUBI Notebook'    },
  { url: 'https://thefilmstage.com/feed/',               label: 'The Film Stage'   },
  { url: 'https://reverseshot.org/archive/entry/rss',    label: 'Reverse Shot'     },
  { url: 'https://wp.theringer.com/topic/movies/feed/',  label: 'The Ringer'       },
];

const CACHE_SECONDS  = 15 * 60; // 15 min edge cache
const MAX_ITEMS      = 60;      // total items returned after merge
const FEED_TIMEOUT   = 7_000;   // ms before an individual feed is aborted
const GLOBAL_TIMEOUT = 8_500;   // ms before ALL remaining connections are force-killed

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  pubTimestamp: number;
  source: string;
  image: string | null;
}

interface FeedResult {
  items: NewsItem[];
  error?: string;
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractTagText(xml: string, tag: string): string {
  // Capture everything between the opening and closing tag
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  const raw = m[1];
  // Prefer CDATA content — some feeds (e.g. Reverse Shot) prepend a plain-text
  // section label before the CDATA block; grabbing only the text would lose the
  // actual article body that lives inside the CDATA.
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  if (cdata) return cdata[1].trim();
  return raw.trim();
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractImage(item: string): string | null {
  const mc = extractAttr(item, 'media:content', 'url');
  if (mc) return mc;
  const enc = extractAttr(item, 'enclosure', 'url');
  if (enc) return enc;
  const m = item.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  return null;
}

function parseRSS(xml: string, label: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const raw = m[1];
    const title = extractTagText(raw, 'title');
    if (!title) continue;
    const link = extractTagText(raw, 'link') || extractAttr(raw, 'link', 'href');
    if (!link) continue;
    const description  = extractTagText(raw, 'description');
    const pubDate      = extractTagText(raw, 'pubDate') || extractTagText(raw, 'published') || extractTagText(raw, 'dc:date');
    const pubTimestamp = pubDate ? Date.parse(pubDate) || 0 : 0;
    const image        = extractImage(raw);
    items.push({ title, link, description, pubDate, pubTimestamp, source: label, image });
  }
  return items;
}

// ── Feed fetcher ──────────────────────────────────────────────────────────────

async function fetchFeed(
  feedUrl: string,
  label: string,
  ac: AbortController
): Promise<FeedResult> {
  const timer = setTimeout(() => ac.abort(), FEED_TIMEOUT);
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MovieDrafter/1.0; +https://moviedrafter.com)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: ac.signal,
    });
    if (!res.ok) return { items: [], error: `${label}: HTTP ${res.status}` };
    const xml = await res.text();
    return { items: parseRSS(xml, label) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { items: [], error: `${label}: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(_req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // One AbortController per feed so we can force-close ALL connections
  // before returning — Lambda/Vercel will not release the execution context
  // while network connections remain open, even after Promise.race resolves.
  const controllers = FEEDS.map(() => new AbortController());

  const abortAll = () => controllers.forEach((ac) => ac.abort());

  // Global hard deadline: abort every connection and resolve with whatever
  // partial results exist. This guarantees the function exits cleanly.
  let globalTimer: ReturnType<typeof setTimeout>;
  const globalDeadline = new Promise<FeedResult[]>((resolve) => {
    globalTimer = setTimeout(() => {
      abortAll();
      resolve(FEEDS.map((f) => ({ items: [], error: `${f.label}: deadline` })));
    }, GLOBAL_TIMEOUT);
  });

  const feedsPromise = Promise.all(
    FEEDS.map((f, i) => fetchFeed(f.url, f.label, controllers[i]))
  );

  const results = await Promise.race([feedsPromise, globalDeadline]);

  // If feeds finished before deadline, abort any stragglers and clear timer
  abortAll();
  clearTimeout(globalTimer!);

  const allItems: NewsItem[] = [];
  const errors: string[] = [];

  for (const result of results) {
    allItems.push(...result.items);
    if (result.error) errors.push(result.error);
  }

  allItems.sort((a, b) => b.pubTimestamp - a.pubTimestamp);
  const items = allItems.slice(0, MAX_ITEMS);

  return new Response(JSON.stringify({ items, errors }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
    },
  });
}
