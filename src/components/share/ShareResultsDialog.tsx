import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy,
  Users,
  LayoutGrid,
  ListOrdered,
  Images,
  Share2,
  Download,
  Link as LinkIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { InstagramIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useSVGImageRenderer } from '@/hooks/useSVGImageRenderer';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { downloadImage } from '@/utils/imageGenerator';
import {
  buildShareContent,
  buildRosterCarousel,
  buildPickOrderCarousel,
  type SharePick,
  type ShareTeamScore,
  type ShareFormat,
  type ShareContent,
} from '@/utils/shareContent';
import {
  dataUrlToFile,
  canNativeShare,
  canShareFiles,
  nativeShare,
  openShareWindow,
  copyToClipboard,
  buildXUrl,
  buildFacebookUrl,
  buildWhatsAppUrl,
  buildRedditUrl,
} from '@/utils/shareTargets';

type ShareMode = 'leaderboard' | 'my-team' | 'board' | 'pick-order' | 'roster';

interface ShareResultsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  draftTitle: string;
  draftId: string;
  picks: SharePick[];
  teamScores: ShareTeamScore[];
  votingOpen?: boolean;
}

// --- Brand glyphs (monochrome, currentColor) -------------------------------
const Glyph: React.FC<{ path: string; label: string }> = ({ path, label }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" role="img" aria-label={label}>
    <path d={path} />
  </svg>
);
const X_PATH =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const FB_PATH =
  'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z';
const WA_PATH =
  'M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.683 5.55l-.999 3.648 3.806-.999zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z';
const REDDIT_PATH =
  'M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.759.052-5.245.809-7.075 2.013-.475-.438-1.107-.712-1.808-.712C1.192 9.134 0 10.32 0 11.779c0 .629.224 1.215.591 1.671-.097.413-.146.838-.146 1.27 0 3.687 4.123 6.685 9.197 6.685s9.197-2.998 9.197-6.685c0-.43-.049-.853-.146-1.265.379-.453.616-1.045.616-1.696zm-17.957 1.66c0-.831.628-1.508 1.396-1.508.766 0 1.392.677 1.392 1.508 0 .832-.626 1.509-1.392 1.509-.768 0-1.396-.677-1.396-1.509zm9.802 4.402c-1.213 1.214-3.527 1.307-4.207 1.307-.681 0-2.995-.093-4.208-1.307-.18-.181-.18-.474 0-.654.181-.181.474-.181.654 0 .764.764 2.405.918 3.554.918 1.148 0 2.79-.154 3.553-.918.181-.181.474-.181.654 0 .181.18.181.473 0 .654zm-.027-2.893c-.768 0-1.394-.677-1.394-1.509 0-.831.626-1.508 1.394-1.508s1.394.677 1.394 1.508c0 .832-.626 1.509-1.394 1.509z';

// --- destinations ("where") ------------------------------------------------
type DestKind = 'image' | 'link';
interface Destination {
  id: string;
  label: string;
  kind: DestKind;
  icon: React.ReactNode;
  /** image destinations auto-select this size (undefined = user may choose) */
  format?: ShareFormat;
  /** show only when the Web Share API can share files */
  nativeOnly?: boolean;
}

const DESTINATIONS: Destination[] = [
  { id: 'ig-feed', label: 'Instagram Feed', kind: 'image', format: 'portrait', icon: <InstagramIcon className="w-5 h-5" /> },
  { id: 'ig-story', label: 'Instagram Story', kind: 'image', format: 'story', icon: <InstagramIcon className="w-5 h-5" /> },
  { id: 'more', label: 'Share…', kind: 'image', nativeOnly: true, icon: <Share2 size={20} /> },
  { id: 'save', label: 'Save to device', kind: 'image', icon: <Download size={20} /> },
  { id: 'x', label: 'X', kind: 'link', icon: <Glyph path={X_PATH} label="X" /> },
  { id: 'facebook', label: 'Facebook', kind: 'link', icon: <Glyph path={FB_PATH} label="Facebook" /> },
  { id: 'whatsapp', label: 'WhatsApp', kind: 'link', icon: <Glyph path={WA_PATH} label="WhatsApp" /> },
  { id: 'reddit', label: 'Reddit', kind: 'link', icon: <Glyph path={REDDIT_PATH} label="Reddit" /> },
  { id: 'copy', label: 'Copy link', kind: 'link', icon: <LinkIcon size={18} /> },
];

// --- small UI helpers ------------------------------------------------------
const chip =
  'flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-[4px] cursor-pointer transition-colors font-brockmann text-xs text-center disabled:opacity-40';
const chipStyle = (active: boolean): React.CSSProperties => ({
  color: 'var(--Text-Primary, #FCFFFF)',
  background: active ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
  outline: active ? '1px solid var(--Brand-Primary, #7142FF)' : '1px solid var(--Button-Stroke, #666469)',
  outlineOffset: -1,
});

const slugify = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_');

const FORMAT_ORDER: ShareFormat[] = ['portrait', 'square', 'story'];
const FORMAT_LABELS: Record<ShareFormat, string> = { portrait: 'Post 4:5', square: 'Square 1:1', story: 'Story 9:16' };
const FORMAT_SIZE_TEXT: Record<ShareFormat, string> = {
  portrait: '1080×1350',
  square: '1080×1080',
  story: '1080×1920',
};

const slideLabel = (slide: ShareContent): string => {
  const d = slide.imageData;
  if (d.variant === 'my-team') return d.focusPlayer || 'Player';
  if (d.variant === 'pick-order') return d.roundLabel || 'Pick order';
  return 'Leaderboard';
};

/** "THE [NAME] DRAFT", uppercased, with the middle name words flagged for the purple highlight. */
const formatTitleWords = (raw: string): { word: string; hi: boolean }[] => {
  const parts = raw.split(' ').filter(Boolean);
  let processed: string;
  let start: number;
  let end: number;
  if (!parts.length || parts[0].toUpperCase() !== 'THE' || parts[parts.length - 1].toUpperCase() !== 'DRAFT') {
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
};

const ShareResultsDialog: React.FC<ShareResultsDialogProps> = ({
  isOpen,
  onOpenChange,
  draftTitle,
  draftId,
  picks,
  teamScores,
  votingOpen = false,
}) => {
  const { toast } = useToast();
  const { renderToCanvas } = useSVGImageRenderer();
  const { makeDraftPublic } = useDraftOperations();

  const players = useMemo(() => teamScores.map((t) => t.playerName), [teamScores]);
  const top3 = useMemo(() => [...teamScores].sort((a, b) => b.averageScore - a.averageScore).slice(0, 3), [teamScores]);
  const titleWords = useMemo(() => formatTitleWords(draftTitle), [draftTitle]);
  const nativeShareable = canNativeShare();
  const destinations = useMemo(() => DESTINATIONS.filter((d) => !d.nativeOnly || nativeShareable), [nativeShareable]);

  const [destId, setDestId] = useState('ig-feed');
  const [mode, setMode] = useState<ShareMode>('leaderboard');
  const [format, setFormat] = useState<ShareFormat>('portrait');
  const [focusPlayer, setFocusPlayer] = useState<string>(players[0] ?? '');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState('');
  const [rendering, setRendering] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const dest = destinations.find((d) => d.id === destId) ?? destinations[0];
  const isImageDest = dest.kind === 'image';
  const allowSizeChoice = dest.id === 'save' || dest.id === 'more';

  // Auto-select the best size for the chosen destination.
  useEffect(() => {
    if (dest.format) setFormat(dest.format);
  }, [dest.format]);

  useEffect(() => {
    if (!focusPlayer && players[0]) setFocusPlayer(players[0]);
  }, [players, focusPlayer]);

  // Slides: single stories are one slide; roster and pick-order are carousels.
  const slides = useMemo<ShareContent[]>(() => {
    if (mode === 'roster') return buildRosterCarousel({ draftTitle, draftId, picks, teamScores, votingOpen });
    if (mode === 'pick-order') return buildPickOrderCarousel({ draftTitle, draftId, picks, teamScores, votingOpen });
    return [buildShareContent({ variant: mode, draftTitle, draftId, picks, teamScores, focusPlayer, votingOpen })];
  }, [mode, draftTitle, draftId, picks, teamScores, focusPlayer, votingOpen]);

  const isCarousel = slides.length > 1;
  const safeIndex = Math.min(currentSlide, slides.length - 1);
  const activeSlide = slides[safeIndex] ?? slides[0];
  const primary = slides[0];

  useEffect(() => {
    setCurrentSlide(0);
  }, [mode]);

  useEffect(() => {
    setCaption(primary.caption);
  }, [primary.caption]);

  // Publish the draft as soon as the dialog opens (link works + previews crawlable).
  const publicizedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !publicizedRef.current) {
      publicizedRef.current = true;
      makeDraftPublic(draftId).catch((err) => console.warn('makeDraftPublic failed', err));
    }
  }, [isOpen, draftId, makeDraftPublic]);

  // Render the visible slide (only image destinations need the picture).
  useEffect(() => {
    if (!isOpen || !isImageDest || !activeSlide) return;
    let cancelled = false;
    setRendering(true);
    renderToCanvas(activeSlide.imageData, { format, variant: activeSlide.imageData.variant ?? 'leaderboard' })
      .then((url) => {
        if (!cancelled) setPreview(url);
      })
      .catch((err) => {
        console.error('Share image render failed', err);
        if (!cancelled)
          toast({ title: 'Preview failed', description: 'Could not build the image.', variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isImageDest, activeSlide, format, renderToCanvas, toast]);

  const baseName = slugify(draftTitle || 'movie_draft');

  const buildAssets = async (): Promise<{ url: string; name: string }[]> => {
    if (!isCarousel) return preview ? [{ url: preview, name: `${baseName}_${mode}_${format}.png` }] : [];
    const assets: { url: string; name: string }[] = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const url = await renderToCanvas(s.imageData, { format, variant: s.imageData.variant ?? 'leaderboard' });
      assets.push({ url, name: `${baseName}_${String(i + 1).padStart(2, '0')}_${slugify(slideLabel(s))}_${format}.png` });
    }
    return assets;
  };

  const withBundling = async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (!isCarousel) return fn();
    setBundling(true);
    try {
      return await fn();
    } finally {
      setBundling(false);
    }
  };

  const handlePrimary = async () => {
    // Link destinations: share the URL; its preview card is the visual.
    if (dest.kind === 'link') {
      if (dest.id === 'x') openShareWindow(buildXUrl(caption, primary.url));
      else if (dest.id === 'facebook') openShareWindow(buildFacebookUrl(primary.url));
      else if (dest.id === 'whatsapp') openShareWindow(buildWhatsAppUrl(caption, primary.url));
      else if (dest.id === 'reddit') openShareWindow(buildRedditUrl(primary.shareTitle, primary.url));
      else if (dest.id === 'copy') {
        const ok = await copyToClipboard(primary.url);
        toast(
          ok
            ? { title: 'Link copied!', description: 'Public link copied to clipboard.' }
            : { title: 'Copy failed', description: 'Could not access the clipboard.', variant: 'destructive' }
        );
      }
      return;
    }

    // Image destinations: produce the sized image(s).
    const assets = await withBundling(buildAssets);
    if (!assets.length) return;

    if (dest.id === 'save') {
      for (const a of assets) {
        downloadImage(a.url, a.name);
        if (assets.length > 1) await new Promise((r) => setTimeout(r, 250));
      }
      toast({
        title: isCarousel ? `Saved ${assets.length} images` : 'Image saved',
        description: FORMAT_SIZE_TEXT[format],
      });
      return;
    }

    // ig-feed / ig-story / more → native share the file(s), else download + guidance.
    const files = assets.map((a) => dataUrlToFile(a.url, a.name));
    if (canNativeShare() && canShareFiles(files)) {
      const result = await nativeShare({ title: primary.shareTitle, text: caption, url: primary.url, files });
      if (result === 'error')
        toast({ title: 'Share failed', description: 'Could not open the share menu.', variant: 'destructive' });
      return;
    }
    assets.forEach((a) => downloadImage(a.url, a.name));
    toast({
      title: dest.id.startsWith('ig') ? `Saved for Instagram` : 'Image saved',
      description: "Open the app and post it from your photos — direct posting isn't possible from a desktop browser.",
    });
  };

  const segments: { id: ShareMode; label: string; icon: React.ReactNode }[] = [
    { id: 'leaderboard', label: 'Who won', icon: <Trophy size={18} /> },
    { id: 'my-team', label: 'My team', icon: <Users size={18} /> },
    { id: 'board', label: 'Draft board', icon: <LayoutGrid size={18} /> },
    { id: 'pick-order', label: 'Pick order', icon: <ListOrdered size={18} /> },
    { id: 'roster', label: 'Full roster', icon: <Images size={18} /> },
  ];

  const busy = rendering || bundling;
  const imageDests = destinations.filter((d) => d.kind === 'image');
  const linkDests = destinations.filter((d) => d.kind === 'link');

  const primaryLabel =
    dest.kind === 'link'
      ? dest.id === 'copy'
        ? 'Copy link'
        : `Share to ${dest.label}`
      : dest.id === 'save'
        ? isCarousel
          ? `Save ${slides.length} images`
          : 'Save image'
        : isCarousel
          ? `Share ${slides.length} slides`
          : `Share to ${dest.label.replace('Share…', 'your apps')}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px] max-h-[92vh] overflow-y-auto border-none p-6"
        style={{ background: '#0E0E0F', boxShadow: '0px 0px 12px #3B0394' }}
      >
        <DialogHeader>
          <DialogTitle className="font-brockmann text-xl text-[var(--Text-Primary,#FCFFFF)]">Share your draft</DialogTitle>
          <DialogDescription className="font-brockmann text-sm text-greyscale-blue-200">
            Pick where you're sharing — we'll size it right automatically.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — destination */}
        <div className="flex flex-col gap-2">
          <div className="font-brockmann text-xs uppercase tracking-wide text-greyscale-blue-300">Post an image</div>
          <div className="grid grid-cols-4 gap-2">
            {imageDests.map((d) => (
              <button key={d.id} type="button" onClick={() => setDestId(d.id)} className={chip} style={chipStyle(destId === d.id)}>
                {d.icon}
                <span>{d.label}</span>
                {d.format && <span className="text-[10px] text-greyscale-blue-300">{FORMAT_LABELS[d.format].split(' ')[1]}</span>}
              </button>
            ))}
          </div>
          <div className="font-brockmann text-xs uppercase tracking-wide text-greyscale-blue-300 mt-1">Share a link</div>
          <div className="grid grid-cols-5 gap-2">
            {linkDests.map((d) => (
              <button key={d.id} type="button" onClick={() => setDestId(d.id)} className={chip} style={chipStyle(destId === d.id)}>
                {d.icon}
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px w-full" style={{ background: '#2A2A2E' }} />

        {isImageDest ? (
          <>
            {/* STEP 2 — story */}
            <div className="grid grid-cols-3 gap-2">
              {segments.map((seg) => (
                <button key={seg.id} type="button" onClick={() => setMode(seg.id)} className={chip} style={chipStyle(mode === seg.id)}>
                  {seg.icon}
                  <span>{seg.label}</span>
                </button>
              ))}
            </div>

            {mode === 'my-team' && players.length > 1 && (
              <label className="flex items-center gap-3 font-brockmann text-sm text-[var(--Text-Primary,#FCFFFF)]">
                <span className="text-greyscale-blue-200">Player</span>
                <select
                  value={focusPlayer}
                  onChange={(e) => setFocusPlayer(e.target.value)}
                  className="flex-1 rounded-[2px] px-3 py-2 font-brockmann text-sm text-[var(--Text-Primary,#FCFFFF)]"
                  style={{ background: 'var(--UI-Primary, #1D1D1F)', outline: '1px solid var(--Button-Stroke, #666469)', outlineOffset: -1 }}
                >
                  {players.map((p) => (
                    <option key={p} value={p} style={{ background: '#1D1D1F' }}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isCarousel && (mode === 'roster' || mode === 'pick-order') && (
              <p className="font-brockmann text-xs text-greyscale-blue-200">
                {slides.length} slides — {mode === 'roster' ? 'leaderboard + one per player' : 'one per round'}. Great as an
                Instagram carousel.
              </p>
            )}

            {/* preview */}
            <div className="relative flex items-center justify-center w-full rounded-[4px] overflow-hidden" style={{ background: '#000', minHeight: 220, maxHeight: 400 }}>
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <Loader2 className="animate-spin text-[var(--Text-Primary,#FCFFFF)]" size={32} />
                </div>
              )}
              {preview ? (
                <img src={preview} alt="Share preview" className="object-contain" style={{ maxHeight: 400, maxWidth: '100%' }} />
              ) : (
                !busy && <div className="py-16 text-greyscale-blue-200 font-brockmann text-sm">No preview</div>
              )}
              {isCarousel && (
                <>
                  <button type="button" aria-label="Previous slide" onClick={() => setCurrentSlide((i) => (i - 1 + slides.length) % slides.length)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full p-1.5" style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <ChevronLeft className="text-white" size={22} />
                  </button>
                  <button type="button" aria-label="Next slide" onClick={() => setCurrentSlide((i) => (i + 1) % slides.length)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full p-1.5" style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <ChevronRight className="text-white" size={22} />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 font-brockmann text-xs text-greyscale-blue-200">
              {isCarousel && <span>Slide {safeIndex + 1} / {slides.length} · {slideLabel(activeSlide)} · </span>}
              <span>{FORMAT_LABELS[format]} · {FORMAT_SIZE_TEXT[format]}</span>
            </div>

            {/* size choice only where it's a free choice */}
            {allowSizeChoice && (
              <div className="flex justify-center gap-2">
                {FORMAT_ORDER.map((f) => (
                  <button key={f} type="button" onClick={() => setFormat(f)} className="py-1.5 px-4 rounded-full font-brockmann text-xs cursor-pointer text-[var(--Text-Primary,#FCFFFF)]" style={chipStyle(format === f)}>
                    {FORMAT_LABELS[f]}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* link destinations: show what the shared link looks like when it unfurls */
          <div className="flex flex-col gap-1.5">
            <div className="rounded-[6px] overflow-hidden" style={{ border: '1px solid #2A2A2E' }}>
              <div className="flex flex-col items-center gap-2.5 px-6 py-6" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 86%)' }}>
                <div className="text-white text-[13px] tracking-[0.12em]" style={{ fontFamily: 'CHANEY' }}>
                  MOVIE DRAFTER
                </div>
                <div className="font-brockmann text-[10px] font-bold tracking-[0.2em] text-[#C9B8FF]">FINAL SCORES</div>
                <div className="text-center leading-none" style={{ fontFamily: 'CHANEY', fontSize: 22, letterSpacing: 1 }}>
                  {titleWords.map((w, i) => (
                    <span key={i} style={{ color: w.hi ? '#7142FF' : '#FCFFFF', marginRight: 6 }}>
                      {w.word}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5 w-full max-w-[340px] mt-1">
                  {top3.map((t, i) => (
                    <div key={t.playerName} className="flex items-center gap-2.5">
                      <div
                        className="flex items-center justify-center rounded-full font-brockmann font-bold shrink-0"
                        style={{ width: 22, height: 22, fontSize: 12, color: '#2B2D2D', background: ['#FFD60A', '#D9D9D9', '#E08A4B'][i] ?? '#907AFF' }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 font-brockmann text-sm font-medium text-white truncate">{t.playerName}</div>
                      <div className="font-brockmann text-sm font-bold text-[#C9B8FF]">{t.averageScore.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 py-2.5" style={{ background: 'var(--UI-Primary, #1D1D1F)' }}>
                <div className="font-brockmann text-[13px] text-white truncate">Final scores: {draftTitle}</div>
                <div className="font-brockmann text-[11px] text-greyscale-blue-300">moviedrafter.com</div>
              </div>
            </div>
            <p className="font-brockmann text-[11px] text-greyscale-blue-300 text-center">
              This is roughly how your link will look when pasted into X, Facebook, iMessage, etc.
            </p>
          </div>
        )}

        {/* caption */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-[2px] p-3 font-brockmann text-sm text-[var(--Text-Primary,#FCFFFF)]"
          style={{ background: 'var(--UI-Primary, #1D1D1F)', outline: '1px solid var(--Button-Stroke, #666469)', outlineOffset: -1 }}
          aria-label="Post caption"
          placeholder="Add a caption…"
        />

        {/* primary action */}
        <button
          type="button"
          onClick={handlePrimary}
          disabled={busy || (isImageDest && !preview)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-[2px] font-brockmann font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: 'var(--Brand-Primary, #7142FF)' }}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : dest.icon}
          {primaryLabel}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default ShareResultsDialog;
