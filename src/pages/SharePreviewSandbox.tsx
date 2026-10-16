import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  generateShareImageSVG,
  FORMAT_DIMS,
  type ShareImageData,
  type ShareVariant,
  type ShareFormat,
} from '@/utils/svgImageTemplate';
import {
  buildShareContent,
  buildRosterCarousel,
  buildPickOrderCarousel,
  type SharePick,
  type ShareTeamScore,
} from '@/utils/shareContent';
import ShareResultsDialog from '@/components/share/ShareResultsDialog';

/**
 * DEV-ONLY sandbox for designing the share images. Route: /share-preview (gated to import.meta.env.DEV
 * in App.tsx). Lets you crank player/pick counts to stress-test "design for the max" and open the real
 * share dialog — no completed draft required, nothing made public.
 */

const NAMES = [
  'Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Avery', 'Quinn',
  'Drew', 'Parker', 'Skylar', 'Rowan', 'Sage', 'Reese', 'Emerson', 'Finley', 'Harper', 'Logan',
];
const CATEGORIES = [
  'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Romance', 'Thriller', 'Animated', 'Documentary',
  'Musical', 'Western', 'Fantasy', 'Crime', 'Mystery', 'Family', 'War', 'Sports', 'Biopic', 'Adventure', 'Noir',
];
const SAMPLE_TITLES = [
  'Inception', 'Parasite', 'Whiplash', 'Interstellar', 'Dune', 'Oppenheimer', 'La La Land', 'Arrival',
  'Gladiator', 'Whip It', 'The Batman', 'Sinners', 'Tenet', 'Barbie', 'Up', 'Coco', 'Heat', 'Drive', 'Her', 'Brazil',
];

const makeMock = (players: number, picksPer: number) => {
  const picks: SharePick[] = [];
  const teamScores: ShareTeamScore[] = [];
  let order = 1;
  for (let p = 0; p < players; p++) {
    const name = NAMES[p % NAMES.length] + (p >= NAMES.length ? ` ${Math.floor(p / NAMES.length) + 1}` : '');
    for (let c = 0; c < picksPer; c++) {
      picks.push({
        movie_title: SAMPLE_TITLES[(p + c) % SAMPLE_TITLES.length],
        player_name: name,
        pick_order: order++,
        category: CATEGORIES[c % CATEGORIES.length],
        movie_year: 2000 + ((p + c) % 24),
        movie_genre: CATEGORIES[c % CATEGORIES.length],
        // Real poster-shaped images so the board preview shows posters (posterUrl passes http through).
        poster_path: `https://picsum.photos/seed/mdp${(p * 7 + c * 3) % 90}/200/300`,
        rt_critics_score: 96 - ((p * 2 + c) % 45),
        rt_audience_score: 90 - ((p + c) % 30),
        metacritic_score: 88 - ((p + c) % 35),
        imdb_rating: 8.7 - ((p + c) % 30) / 10,
        movie_budget: 30_000_000,
        movie_revenue: 220_000_000,
      });
    }
    teamScores.push({ playerName: name, averageScore: 94 - p * 1.6, completedPicks: picksPer, totalPicks: picksPer });
  }
  return { picks, teamScores };
};

const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

const ImageTile: React.FC<{
  imageData: ShareImageData;
  variant: ShareVariant;
  format: ShareFormat;
  label?: string;
  maxH?: number;
}> = ({ imageData, variant, format, label, maxH = 380 }) => {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    generateShareImageSVG(imageData, { format, variant })
      .then((svg) => {
        if (!cancelled) setSrc(svgToDataUrl(svg));
      })
      .catch((err) => console.error('tile render failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageData, format, variant]);

  const dims = FORMAT_DIMS[format];
  const w = Math.round((maxH * dims.width) / dims.height);

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      {label && <div className="font-brockmann text-xs text-greyscale-blue-200">{label}</div>}
      <div
        className="relative flex items-center justify-center rounded-[6px] overflow-hidden"
        style={{ width: w, height: maxH, background: '#000', border: '1px solid #333' }}
      >
        {loading && <Loader2 className="animate-spin text-white absolute" size={26} />}
        {src && <img src={src} alt={label || variant} style={{ width: w, height: maxH }} />}
      </div>
      <div className="font-brockmann text-[10px] text-greyscale-blue-300">
        {dims.width}×{dims.height}
      </div>
    </div>
  );
};

const FORMATS: { id: ShareFormat; label: string }[] = [
  { id: 'portrait', label: 'Post 4:5' },
  { id: 'square', label: 'Square 1:1' },
  { id: 'story', label: 'Story 9:16' },
];

const SharePreviewSandbox: React.FC = () => {
  const [players, setPlayers] = useState(12);
  const [picksPer, setPicksPer] = useState(6);
  const [title, setTitle] = useState('The 2014 Movies Draft');
  const [votingOpen, setVotingOpen] = useState(true);
  const [format, setFormat] = useState<ShareFormat>('portrait');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { picks, teamScores } = useMemo(() => makeMock(players, picksPer), [players, picksPer]);

  const common = { draftTitle: title, draftId: 'preview', picks, teamScores, votingOpen };
  const leaderboard = useMemo(() => buildShareContent({ ...common, variant: 'leaderboard' }), [title, picks, teamScores, votingOpen]);
  const myTeam = useMemo(
    () => buildShareContent({ ...common, variant: 'my-team', focusPlayer: teamScores[0]?.playerName }),
    [title, picks, teamScores, votingOpen]
  );
  const board = useMemo(() => buildShareContent({ ...common, variant: 'board' }), [title, picks, teamScores, votingOpen]);
  const pickOrderCarousel = useMemo(() => buildPickOrderCarousel(common), [title, picks, teamScores, votingOpen]);
  const carousel = useMemo(() => buildRosterCarousel(common), [title, picks, teamScores, votingOpen]);

  const labelCls = 'font-brockmann text-xs text-greyscale-blue-200 flex items-center gap-2';
  const pillCls = 'py-1.5 px-4 rounded-full font-brockmann text-xs cursor-pointer transition-colors text-white';

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
      <div className="container mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="font-brockmann text-2xl font-bold text-white">Share preview sandbox</h1>
          <span className="font-brockmann text-[10px] uppercase tracking-wide px-2 py-1 rounded" style={{ background: '#7142FF', color: '#fff' }}>
            dev only
          </span>
        </div>

        {/* Controls */}
        <div
          className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 rounded-[8px]"
          style={{ background: '#0E0E0F', border: '1px solid #333' }}
        >
          <label className={labelCls}>
            Players: <span className="text-white font-semibold w-6 text-center">{players}</span>
            <input type="range" min={1} max={20} value={players} onChange={(e) => setPlayers(+e.target.value)} />
          </label>
          <label className={labelCls}>
            Picks / player: <span className="text-white font-semibold w-6 text-center">{picksPer}</span>
            <input type="range" min={1} max={20} value={picksPer} onChange={(e) => setPicksPer(+e.target.value)} />
          </label>
          <label className={labelCls}>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded px-2 py-1 text-white"
              style={{ background: '#1D1D1F', border: '1px solid #555', minWidth: 220 }}
            />
          </label>
          <label className={labelCls}>
            <input type="checkbox" checked={votingOpen} onChange={(e) => setVotingOpen(e.target.checked)} />
            Voting open
          </label>
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={pillCls}
                style={{
                  background: format === f.id ? '#7142FF' : '#1D1D1F',
                  outline: format === f.id ? '1px solid #7142FF' : '1px solid #666469',
                  outlineOffset: -1,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="py-2 px-5 rounded-[2px] font-brockmann font-semibold text-sm text-white"
            style={{ background: '#7142FF' }}
          >
            Open share dialog →
          </button>
        </div>

        {/* Single stories */}
        <div className="flex flex-wrap gap-8 items-start">
          <ImageTile imageData={leaderboard.imageData} variant="leaderboard" format={format} label="Who won (leaderboard)" />
          <ImageTile imageData={myTeam.imageData} variant="my-team" format={format} label={`My team — ${teamScores[0]?.playerName ?? ''}`} />
          <ImageTile imageData={board.imageData} variant="board" format={format} label="Draft board (posters)" />
        </div>

        {/* Pick-order carousel (per round) */}
        <div className="flex flex-col gap-3">
          <h2 className="font-brockmann text-sm font-semibold text-white">
            Pick order carousel — {pickOrderCarousel.length} rounds
          </h2>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {pickOrderCarousel.map((slide, i) => (
              <ImageTile
                key={i}
                imageData={slide.imageData}
                variant="pick-order"
                format={format}
                label={slide.imageData.roundLabel ?? `Round ${i + 1}`}
                maxH={300}
              />
            ))}
          </div>
        </div>

        {/* Roster carousel (per player) */}
        <div className="flex flex-col gap-3">
          <h2 className="font-brockmann text-sm font-semibold text-white">
            Full roster carousel — {carousel.length} slides
          </h2>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {carousel.map((slide, i) => (
              <ImageTile
                key={i}
                imageData={slide.imageData}
                variant={slide.imageData.variant ?? 'leaderboard'}
                format={format}
                label={`${i + 1}. ${slide.imageData.variant === 'my-team' ? slide.imageData.focusPlayer : 'Leaderboard'}`}
                maxH={300}
              />
            ))}
          </div>
        </div>
      </div>

      <ShareResultsDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        draftTitle={title}
        draftId="preview"
        picks={picks}
        teamScores={teamScores}
        votingOpen={votingOpen}
      />
    </div>
  );
};

export default SharePreviewSandbox;
