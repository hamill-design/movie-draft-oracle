/**
 * Vercel serverless news proxy.
 * GET /api/news → returns { items: NewsItem[], errors: string[] }
 *
 * Fetches all configured feeds in parallel server-side (no CORS issues),
 * merges the results, and sorts newest-first.
 */
export const config = { runtime: 'nodejs' };

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

const CACHE_SECONDS = 15 * 60; // 15 min edge cache
const MAX_ITEMS     = 60;       // total items returned after merge
const FETCH_TIMEOUT = 5_000;    // ms per feed (hard-kill via AbortController)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;       // raw RFC-822 string from feed
  pubTimestamp: number;  // parsed ms-since-epoch for sorting
  source: string;        // human-readable label, e.g. "MUBI Notebook"
  image: string | null;
}

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Extract text/CDATA content of the first matching tag. */
function extractTagText(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*?))<\\/${tag}>`,
    'i'
  );
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').trim();
}

/** Extract an attribute value from the first matching tag. */
function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

/** Try to find an image URL in a single <item> block. */
function extractImage(item: string): string | null {
  // 1. media:content url attribute
  const mc = extractAttr(item, 'media:content', 'url');
  if (mc) return mc;

  // 2. enclosure url attribute
  const enc = extractAttr(item, 'enclosure', 'url');
  if (enc) return enc;

  // 3. First <img src="..."> inside description HTML
  const m = item.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];

  return null;
}

/** Parse a full RSS/Atom XML string into NewsItems, tagging each with the feed label. */
function parseRSS(xml: string, label: string): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const m of matches) {
    const raw = m[1];

    const title = extractTagText(raw, 'title');
    if (!title) continue;

    const link = extractTagText(raw, 'link') || extractAttr(raw, 'link', 'href');
    if (!link) continue;

    const description = extractTagText(raw, 'description');
    const pubDate     = extractTagText(raw, 'pubDate') || extractTagText(raw, 'published') || extractTagText(raw, 'dc:date');
    const pubTimestamp = pubDate ? Date.parse(pubDate) || 0 : 0;
    const image       = extractImage(raw);

    items.push({ title, link, description, pubDate, pubTimestamp, source: label, image });
  }

  return items;
}

// ── Feed fetcher ──────────────────────────────────────────────────────────────

async function fetchFeed(feedUrl: string, label: string): Promise<{ items: NewsItem[]; error?: string }> {
  // Use an explicit AbortController so the setTimeout reliably kills the
  // Undici socket — AbortSignal.timeout() can lose to Undici's internal
  // headersTimeout (30 s default) and leave the function hanging.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`Timeout after ${FETCH_TIMEOUT}ms`)), FETCH_TIMEOUT);

  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MovieDrafter/1.0; +https://moviedrafter.com)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: ac.signal,
    });

    if (!res.ok) {
      return { items: [], error: `${label}: HTTP ${res.status}` };
    }

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

  // Fetch all feeds in parallel; partial failures are tolerated.
  // The global race ensures the function always returns even if individual
  // AbortControllers are delayed by the runtime (e.g. vercel dev proxy).
  type FeedResult = { items: NewsItem[]; error?: string };
  const feedsPromise = Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.label)));
  const globalTimeoutMs = 9_000;
  const globalTimeout = new Promise<FeedResult[]>((resolve) =>
    setTimeout(
      () => resolve(FEEDS.map((f) => ({ items: [], error: `${f.label}: global timeout` }))),
      globalTimeoutMs
    )
  );
  const results = await Promise.race([feedsPromise, globalTimeout]);

  const allItems: NewsItem[] = [];
  const errors: string[] = [];

  for (const result of results) {
    allItems.push(...result.items);
    if (result.error) errors.push(result.error);
  }

  // Sort newest-first, cap total
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
