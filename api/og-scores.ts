/**
 * Vercel Node runtime: dynamic 1200×630 PNG for a draft's Final Scores link preview.
 * Params-driven (scores-preview passes the standings). Uses the brand gradient, CHANEY header
 * ("THE … DRAFT" with purple middle words), the wordmark logo, and the top-3 standings.
 */
import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const config = { runtime: 'nodejs' };

const GRADIENT = 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 86%)';
const PURPLE = '#7142FF';

// --- brand assets (loaded once at cold start; graceful if tracing misses them) ---
function readAsset(url: URL): Buffer | null {
  try {
    return readFileSync(fileURLToPath(url));
  } catch {
    return null;
  }
}
const CHANEY = readAsset(new URL('./_fonts/chaney-regular.ttf', import.meta.url));
const BROCK_MED = readAsset(new URL('./_fonts/brockmann-medium.ttf', import.meta.url));
const BROCK_BOLD = readAsset(new URL('./_fonts/brockmann-bold.ttf', import.meta.url));
const LOGO_SVG = readAsset(new URL('./_fonts/moviedrafter-logo.svg', import.meta.url));
const LOGO_URI = LOGO_SVG ? `data:image/svg+xml;base64,${LOGO_SVG.toString('base64')}` : null;

const fonts = [
  CHANEY && { name: 'CHANEY', data: CHANEY, weight: 400 as const, style: 'normal' as const },
  BROCK_MED && { name: 'Brockmann', data: BROCK_MED, weight: 500 as const, style: 'normal' as const },
  BROCK_BOLD && { name: 'Brockmann', data: BROCK_BOLD, weight: 700 as const, style: 'normal' as const },
].filter(Boolean) as { name: string; data: Buffer; weight: 400 | 500 | 700; style: 'normal' }[];

const HEAD = 'Brockmann, ui-sans-serif, system-ui, -apple-system, sans-serif';

type Standing = { n: string; s: number };
const RANK = [
  { bg: '#FFD60A', fg: '#2B2D2D' },
  { bg: '#D9D9D9', fg: '#2B2D2D' },
  { bg: '#E08A4B', fg: '#2B2D2D' },
];

function parseStandings(raw: string | null): Standing[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((r) => r && typeof r.n === 'string' && !Number.isNaN(Number(r.s)))
      .slice(0, 3)
      .map((r) => ({ n: String(r.n).slice(0, 26), s: Number(r.s) }));
  } catch {
    return [];
  }
}

/** "THE [NAME] DRAFT", uppercased, with the middle (name) words flagged for the purple highlight. */
function titleWords(raw: string): { word: string; hi: boolean }[] {
  const parts = raw.split(' ').filter(Boolean);
  let processed: string;
  let start: number;
  let end: number;
  if (parts.length === 0 || parts[0].toUpperCase() !== 'THE' || parts[parts.length - 1].toUpperCase() !== 'DRAFT') {
    const names = parts.filter((w) => w.toUpperCase() !== 'THE' && w.toUpperCase() !== 'DRAFT');
    processed = `THE ${names.join(' ')} DRAFT`;
    start = 1;
    end = names.length;
  } else {
    processed = raw;
    start = 1;
    end = parts.length - 2;
  }
  return processed
    .split(' ')
    .filter(Boolean)
    .map((w, i) => ({ word: w.toUpperCase(), hi: i >= start && i <= end }));
}

export default function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = (searchParams.get('title') || 'Movie Draft').trim().slice(0, 70) || 'Movie Draft';
    const standings = parseStandings(searchParams.get('standings'));
    const words = titleWords(rawTitle);
    const titleLen = words.reduce((n, w) => n + w.word.length + 1, 0);
    const titleSize = titleLen > 26 ? 46 : titleLen > 18 ? 54 : 62;

    const children: ReturnType<typeof h>[] = [];

    // logo (top)
    if (LOGO_URI) {
      children.push(h('img', { src: LOGO_URI, width: 300, height: 19, style: { marginBottom: 26 } }));
    }

    // eyebrow
    children.push(
      h(
        'div',
        { style: { display: 'flex', fontFamily: HEAD, fontSize: 24, fontWeight: 700, letterSpacing: '0.2em', color: '#C9B8FF', marginBottom: 16 } },
        'FINAL SCORES'
      )
    );

    // CHANEY title, centered, purple middle words
    children.push(
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1040, marginBottom: standings.length ? 30 : 18 } },
        ...words.map((w, i) =>
          h(
            'div',
            { key: i, style: { display: 'flex', fontFamily: 'CHANEY', fontSize: titleSize, color: w.hi ? PURPLE : '#FCFFFF', letterSpacing: 2, marginRight: 16, lineHeight: 1 } },
            w.word
          )
        )
      )
    );

    // standings or fallback
    if (standings.length) {
      children.push(
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', width: 620 } },
          ...standings.map((r, i) =>
            h(
              'div',
              { key: i, style: { display: 'flex', alignItems: 'center', width: '100%', marginBottom: 14 } },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 9999, background: RANK[i]?.bg ?? '#907AFF', color: RANK[i]?.fg ?? '#FCFFFF', fontFamily: HEAD, fontSize: 28, fontWeight: 700, marginRight: 20 } },
                String(i + 1)
              ),
              h('div', { style: { display: 'flex', flexGrow: 1, fontFamily: HEAD, fontSize: 36, fontWeight: 500, color: '#FCFFFF' } }, r.n),
              h('div', { style: { display: 'flex', fontFamily: HEAD, fontSize: 38, fontWeight: 700, color: '#C9B8FF' } }, r.s.toFixed(1))
            )
          )
        )
      );
    } else {
      children.push(h('div', { style: { display: 'flex', fontFamily: HEAD, fontSize: 32, color: '#EDEBFF' } }, 'See who won on Movie Drafter'));
    }

    return new ImageResponse(
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: 60,
            background: GRADIENT,
            fontFamily: HEAD,
          },
        },
        ...children
      ),
      { width: 1200, height: 630, ...(fonts.length ? { fonts } : {}) }
    );
  } catch {
    return new Response('Failed to render OG image', { status: 500 });
  }
}
