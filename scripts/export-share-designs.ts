/**
 * Export each share-image design as a standalone, self-contained HTML file (fonts embedded as base64,
 * posters as URLs). Run: `npx tsx scripts/export-share-designs.ts`. Output: design-exports/*.html
 *
 * These are editable HTML/CSS copies of the exact designs the app generates — open them in a browser
 * or hand them to Figma. They are a design artifact, not part of the app build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateShareImageHtml,
  FORMAT_DIMS,
  type ShareImageData,
  type ShareVariant,
  type ShareFormat,
  type ShareScoredMovie,
  type ShareBoard,
} from '../src/utils/svgImageTemplate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'design-exports');

// --- fonts → base64 @font-face (fully self-contained files) ------------------
const fontFace = (family: string, weight: number, rel: string): string => {
  const buf = fs.readFileSync(path.join(root, 'public', rel));
  const b64 = buf.toString('base64');
  return `@font-face{font-family:'${family}';src:url('data:font/woff2;base64,${b64}') format('woff2');font-weight:${weight};font-display:swap;}`;
};
const fontCss = [
  fontFace('Brockmann', 400, 'fonts/brockmann/brockmann-regular.woff2'),
  fontFace('Brockmann', 500, 'fonts/brockmann/brockmann-medium.woff2'),
  fontFace('Brockmann', 600, 'fonts/brockmann/brockmann-semibold.woff2'),
  fontFace('Brockmann', 700, 'fonts/brockmann/brockmann-bold.woff2'),
  fontFace('CHANEY', 400, 'fonts/chaney/chaney-regular.woff2'),
].join('\n');

// --- sample data -------------------------------------------------------------
const NAMES = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan'];
const CATEGORIES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror'];
const TITLES = ['Inception', 'Parasite', 'Whiplash', 'Interstellar', 'Dune', 'Oppenheimer', 'La La Land', 'Arrival', 'Drive', 'Her'];
const poster = (i: number) => `https://picsum.photos/seed/mdp${i % 90}/300/450`;
const score = (p: number, c: number) => 92 - p * 1.6 - c * 0.4;

const teamScores = NAMES.map((playerName, p) => ({
  playerName,
  averageScore: 92 - p * 1.6,
  completedPicks: CATEGORIES.length,
  totalPicks: CATEGORIES.length,
}));

const movie = (p: number, c: number, pickNumber: number): ShareScoredMovie => ({
  title: TITLES[(p + c) % TITLES.length],
  score: score(p, c),
  playerName: NAMES[p],
  category: CATEGORIES[c],
  pickNumber,
  poster: poster(p * 5 + c),
  year: 2010 + ((p + c) % 12),
  genre: CATEGORIES[c],
});

const totalMovies = NAMES.length * CATEGORIES.length;
const TITLE = 'The 2014 Movies Draft';

const board: ShareBoard = {
  categories: CATEGORIES,
  rows: NAMES.map((player, p) => ({
    player,
    cells: CATEGORIES.map((_cat, c) => ({ title: TITLES[(p + c) % TITLES.length], score: score(p, c), poster: poster(p * 5 + c) })),
  })),
};

const round1: ShareScoredMovie[] = NAMES.map((_n, p) => movie(p, 0, p + 1));
const myTeamPicks: ShareScoredMovie[] = CATEGORIES.map((_c, c) => movie(0, c, c * NAMES.length + 1));

const base = { title: TITLE, teamScores, totalMovies };

const DATA: Record<ShareVariant, ShareImageData> = {
  leaderboard: { ...base, variant: 'leaderboard', firstPick: movie(0, 0, 1), bestMovie: movie(0, 2, 3) },
  'my-team': { ...base, variant: 'my-team', focusPlayer: NAMES[0], focusPlayerScore: teamScores[0].averageScore, focusPlayerPicks: myTeamPicks },
  board: { ...base, variant: 'board', board },
  'pick-order': { ...base, variant: 'pick-order', allPicks: round1, roundLabel: 'ROUND 1 · Action' },
};

const VARIANTS: { id: ShareVariant; label: string }[] = [
  { id: 'leaderboard', label: 'Who won (leaderboard)' },
  { id: 'my-team', label: 'My team' },
  { id: 'board', label: 'Draft board (posters)' },
  { id: 'pick-order', label: 'Pick order (round slide)' },
];
const FORMATS: ShareFormat[] = ['portrait', 'story', 'square'];

// --- write files -------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });
const written: { file: string; label: string; format: ShareFormat }[] = [];

for (const { id, label } of VARIANTS) {
  for (const format of FORMATS) {
    const html = generateShareImageHtml(DATA[id], { variant: id, format }, fontCss);
    const file = `${id}-${format}.html`;
    fs.writeFileSync(path.join(outDir, file), html, 'utf8');
    written.push({ file, label, format });
    console.log('wrote', file, `(${FORMAT_DIMS[format].width}×${FORMAT_DIMS[format].height})`);
  }
}

// index.html
const card = (w: typeof written[number]) =>
  `<a href="${w.file}"><span class="t">${w.label}</span><span class="s">${w.format} · ${FORMAT_DIMS[w.format].width}×${FORMAT_DIMS[w.format].height}</span></a>`;
const index = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Share designs</title>
<style>
  body{margin:0;padding:32px;font-family:system-ui,sans-serif;background:#0b0b12;color:#fff}
  h1{font-size:22px;margin:0 0 4px} p{color:#9aa;margin:0 0 24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  a{display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:10px;background:#17171f;border:1px solid #2a2a34;text-decoration:none;color:#fff}
  a:hover{border-color:#7142FF}
  .t{font-weight:600} .s{font-size:12px;color:#9aa}
</style></head><body>
<h1>Movie Drafter — share designs</h1>
<p>Standalone HTML for each share-image design (fonts embedded). Best viewed via the dev server so posters load.</p>
<div class="grid">${written.map(card).join('')}</div>
</body></html>`;
fs.writeFileSync(path.join(outDir, 'index.html'), index, 'utf8');

console.log(`\n✓ ${written.length} designs + index.html → design-exports/`);
