import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy,
  Users,
  LayoutGrid,
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

type ShareMode = 'leaderboard' | 'my-team' | 'roster';

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

// --- small UI helpers ------------------------------------------------------
const segmentBase =
  'flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-[4px] cursor-pointer transition-colors font-brockmann text-sm';
const destBtn =
  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-[2px] cursor-pointer transition-colors font-brockmann font-medium text-sm text-[var(--Text-Primary,#FCFFFF)] disabled:opacity-50 disabled:cursor-not-allowed';
const destBtnStyle: React.CSSProperties = {
  background: 'var(--UI-Primary, #1D1D1F)',
  outline: '1px solid var(--Button-Stroke, #666469)',
  outlineOffset: -1,
};

const slugify = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_');

const FORMAT_ORDER: ShareFormat[] = ['portrait', 'square', 'story'];
const FORMAT_LABELS: Record<ShareFormat, string> = {
  portrait: 'Post 4:5',
  square: 'Square 1:1',
  story: 'Story 9:16',
};
const FORMAT_SIZE_TEXT: Record<ShareFormat, string> = {
  portrait: '1080×1350 (Post)',
  square: '1080×1080 (Square)',
  story: '1080×1920 (Story)',
};

const slideLabel = (slide: ShareContent): string =>
  slide.imageData.variant === 'my-team' ? slide.imageData.focusPlayer || 'Player' : 'Leaderboard';

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
  const [mode, setMode] = useState<ShareMode>('leaderboard');
  const [format, setFormat] = useState<ShareFormat>('portrait');
  const [focusPlayer, setFocusPlayer] = useState<string>(players[0] ?? '');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState('');
  const [rendering, setRendering] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!focusPlayer && players[0]) setFocusPlayer(players[0]);
  }, [players, focusPlayer]);

  // Slides: one for single stories; the leaderboard + one-per-player for the roster carousel.
  const slides = useMemo<ShareContent[]>(() => {
    if (mode === 'roster') {
      return buildRosterCarousel({ draftTitle, draftId, picks, teamScores, votingOpen });
    }
    return [buildShareContent({ variant: mode, draftTitle, draftId, picks, teamScores, focusPlayer, votingOpen })];
  }, [mode, draftTitle, draftId, picks, teamScores, focusPlayer, votingOpen]);

  const isCarousel = slides.length > 1;
  const safeIndex = Math.min(currentSlide, slides.length - 1);
  const activeSlide = slides[safeIndex] ?? slides[0];
  const primary = slides[0];

  useEffect(() => {
    setCurrentSlide(0);
  }, [mode]);

  // Reset caption to the primary slide's default when the story changes.
  useEffect(() => {
    setCaption(primary.caption);
  }, [primary.caption]);

  // Make the draft public when the dialog opens (link works for everyone + crawlable previews).
  const publicizedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !publicizedRef.current) {
      publicizedRef.current = true;
      makeDraftPublic(draftId).catch((err) => console.warn('makeDraftPublic failed', err));
    }
  }, [isOpen, draftId, makeDraftPublic]);

  // Render the currently-visible slide for the live preview.
  useEffect(() => {
    if (!isOpen || !activeSlide) return;
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
  }, [isOpen, activeSlide, format, renderToCanvas, toast]);

  const baseName = slugify(draftTitle || 'movie_draft');

  /** Rendered images for the current action: the live preview for single stories, or all slides. */
  const buildAssets = async (): Promise<{ url: string; name: string }[]> => {
    if (!isCarousel) {
      return preview ? [{ url: preview, name: `${baseName}_${mode}_${format}.png` }] : [];
    }
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

  const handleNativeShare = async () => {
    const assets = await withBundling(buildAssets);
    if (!assets.length) return;
    const files = assets.map((a) => dataUrlToFile(a.url, a.name));
    const result = await nativeShare({ title: primary.shareTitle, text: caption, url: primary.url, files });
    if (result === 'error') {
      toast({ title: 'Share failed', description: 'Something went wrong opening the share menu.', variant: 'destructive' });
    }
  };

  const handleInstagram = async () => {
    const assets = await withBundling(buildAssets);
    if (!assets.length) return;
    const files = assets.map((a) => dataUrlToFile(a.url, a.name));
    if (canNativeShare() && canShareFiles(files)) {
      const result = await nativeShare({ title: primary.shareTitle, text: caption, url: primary.url, files });
      if (result === 'error')
        toast({ title: 'Share failed', description: 'Could not open the share menu.', variant: 'destructive' });
      return;
    }
    // Desktop / unsupported: download the image(s) and explain the manual step.
    assets.forEach((a) => downloadImage(a.url, a.name));
    toast({
      title: isCarousel ? `Downloaded ${assets.length} slides for Instagram` : 'Image downloaded for Instagram',
      description: "Open Instagram and post from your photos. Direct posting isn't possible from a desktop browser.",
    });
  };

  const handleDownload = async () => {
    const assets = await withBundling(buildAssets);
    if (!assets.length) return;
    for (const a of assets) {
      downloadImage(a.url, a.name);
      if (assets.length > 1) await new Promise((r) => setTimeout(r, 250)); // avoid browser multi-download throttling
    }
    toast({
      title: isCarousel ? `Downloaded ${assets.length} slides` : 'Image downloaded',
      description: `Saved as ${FORMAT_SIZE_TEXT[format]}.`,
    });
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(primary.url);
    toast(
      ok
        ? { title: 'Link copied!', description: 'Public link copied to clipboard.' }
        : { title: 'Copy failed', description: 'Could not access the clipboard.', variant: 'destructive' }
    );
  };

  const segments: { id: ShareMode; label: string; icon: React.ReactNode }[] = [
    { id: 'leaderboard', label: 'Who won', icon: <Trophy size={20} /> },
    { id: 'my-team', label: 'My team', icon: <Users size={20} /> },
    { id: 'roster', label: 'Full roster', icon: <LayoutGrid size={20} /> },
  ];

  const showNative = canNativeShare();
  const busy = rendering || bundling;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px] max-h-[90vh] overflow-y-auto border-none p-6"
        style={{ background: '#0E0E0F', boxShadow: '0px 0px 12px #3B0394' }}
      >
        <DialogHeader>
          <DialogTitle className="font-brockmann text-xl text-[var(--Text-Primary,#FCFFFF)]">
            Share your draft
          </DialogTitle>
          <DialogDescription className="font-brockmann text-sm text-greyscale-blue-200">
            Pick a story, choose a size, then send it anywhere.
          </DialogDescription>
        </DialogHeader>

        {/* Story picker */}
        <div className="flex gap-2">
          {segments.map((seg) => {
            const active = mode === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => setMode(seg.id)}
                className={segmentBase}
                style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  background: active ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                  outline: active ? '1px solid var(--Brand-Primary, #7142FF)' : '1px solid var(--Button-Stroke, #666469)',
                  outlineOffset: -1,
                }}
              >
                {seg.icon}
                {seg.label}
              </button>
            );
          })}
        </div>

        {/* My-team player selector */}
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

        {mode === 'roster' && (
          <p className="font-brockmann text-xs text-greyscale-blue-200">
            {slides.length} slides — leaderboard + one per player. Post them as an Instagram carousel.
          </p>
        )}

        {/* Preview (+ carousel nav) */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative flex items-center justify-center w-full rounded-[4px] overflow-hidden"
            style={{ background: '#000', minHeight: 220, maxHeight: 420 }}
          >
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <Loader2 className="animate-spin text-[var(--Text-Primary,#FCFFFF)]" size={32} />
              </div>
            )}
            {preview ? (
              <img src={preview} alt="Share preview" className="object-contain" style={{ maxHeight: 420, maxWidth: '100%' }} />
            ) : (
              !busy && <div className="py-16 text-greyscale-blue-200 font-brockmann text-sm">No preview</div>
            )}

            {isCarousel && (
              <>
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => setCurrentSlide((i) => (i - 1 + slides.length) % slides.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full p-1.5"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  <ChevronLeft className="text-white" size={22} />
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => setCurrentSlide((i) => (i + 1) % slides.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full p-1.5"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  <ChevronRight className="text-white" size={22} />
                </button>
              </>
            )}
          </div>

          {isCarousel && (
            <div className="font-brockmann text-xs text-greyscale-blue-200">
              Slide {safeIndex + 1} / {slides.length} · {slideLabel(activeSlide)}
            </div>
          )}

          {/* Size toggle */}
          <div className="flex gap-2">
            {FORMAT_ORDER.map((f) => {
              const active = format === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className="py-1.5 px-4 rounded-full font-brockmann text-xs cursor-pointer transition-colors text-[var(--Text-Primary,#FCFFFF)]"
                  style={{
                    background: active ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                    outline: active ? '1px solid var(--Brand-Primary, #7142FF)' : '1px solid var(--Button-Stroke, #666469)',
                    outlineOffset: -1,
                  }}
                >
                  {FORMAT_LABELS[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editable caption */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-[2px] p-3 font-brockmann text-sm text-[var(--Text-Primary,#FCFFFF)]"
          style={{ background: 'var(--UI-Primary, #1D1D1F)', outline: '1px solid var(--Button-Stroke, #666469)', outlineOffset: -1 }}
          aria-label="Post caption"
        />

        {/* Primary: native share sheet (mobile → Instagram, Messages, etc.) */}
        {showNative && (
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={busy || !preview}
            className={destBtn + ' w-full py-3'}
            style={{ background: 'var(--Brand-Primary, #7142FF)', outline: 'none' }}
          >
            <Share2 size={20} />
            {isCarousel ? `Share all ${slides.length}` : 'Share…'}
          </button>
        )}

        {/* Destination grid */}
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={handleInstagram} disabled={busy || !preview} className={destBtn} style={destBtnStyle}>
            <InstagramIcon className="w-5 h-5" />
            Instagram
          </button>
          <button type="button" onClick={() => openShareWindow(buildXUrl(caption, primary.url))} className={destBtn} style={destBtnStyle}>
            <Glyph path={X_PATH} label="X" />X
          </button>
          <button type="button" onClick={() => openShareWindow(buildFacebookUrl(primary.url))} className={destBtn} style={destBtnStyle}>
            <Glyph path={FB_PATH} label="Facebook" />
            Facebook
          </button>
          <button type="button" onClick={() => openShareWindow(buildWhatsAppUrl(caption, primary.url))} className={destBtn} style={destBtnStyle}>
            <Glyph path={WA_PATH} label="WhatsApp" />
            WhatsApp
          </button>
          <button type="button" onClick={() => openShareWindow(buildRedditUrl(primary.shareTitle, primary.url))} className={destBtn} style={destBtnStyle}>
            <Glyph path={REDDIT_PATH} label="Reddit" />
            Reddit
          </button>
          <button type="button" onClick={handleCopyLink} className={destBtn} style={destBtnStyle}>
            <LinkIcon size={18} />
            Copy link
          </button>
        </div>

        <button type="button" onClick={handleDownload} disabled={busy || !preview} className={destBtn + ' w-full'} style={destBtnStyle}>
          <Download size={18} />
          {isCarousel ? `Download all ${slides.length}` : 'Download image'}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default ShareResultsDialog;
