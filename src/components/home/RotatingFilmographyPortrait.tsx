import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { FEATURED_PORTRAITS, type FeaturedPortrait } from '@/data/featuredPortraits';
import { cn } from '@/lib/utils';

// Shown at 124px; w342 covers 2x screens without the ~50 KB w500 download.
const TMDB_PROFILE_BASE = 'https://image.tmdb.org/t/p/w342';

const ROTATE_MS = 4000;
const FADE_MS = 500;

type Portrait = FeaturedPortrait;

function portraitUrl(profilePath: string) {
  return `${TMDB_PROFILE_BASE}${profilePath}`;
}

/** Warm the browser cache for one portrait so it's ready when its turn comes. */
function preloadPortrait(portrait: Portrait | undefined) {
  if (!portrait) return;
  const img = new Image();
  img.src = portraitUrl(portrait.profile_path);
}

type RotatingFilmographyPortraitProps = {
  className?: string;
};

export function RotatingFilmographyPortrait({ className }: RotatingFilmographyPortraitProps) {
  const portraits = FEATURED_PORTRAITS;
  /** Which of the two image layers is currently visible when idle */
  const [visibleSlot, setVisibleSlot] = useState<0 | 1>(0);
  /** Portrait index shown in each layer */
  const [slotIndices, setSlotIndices] = useState<[number, number]>([0, 0]);
  const [isFading, setIsFading] = useState(false);
  const visibleSlotRef = useRef<0 | 1>(0);
  const slotIndicesRef = useRef<[number, number]>([0, 0]);
  const fadeTimerRef = useRef<number | null>(null);

  visibleSlotRef.current = visibleSlot;
  slotIndicesRef.current = slotIndices;

  // Get the first transitions' images ready; later ones are fetched one step ahead (below).
  useEffect(() => {
    preloadPortrait(portraits[1]);
    preloadPortrait(portraits[2]);
  }, [portraits]);

  useEffect(() => {
    if (portraits.length <= 1) return;

    const runTransition = () => {
      const front = visibleSlotRef.current;
      const back: 0 | 1 = front === 0 ? 1 : 0;
      const currentIdx = slotIndicesRef.current[front];
      const nextIdx = (currentIdx + 1) % portraits.length;
      // Fetch only the portrait after this one, instead of all 40 up front.
      preloadPortrait(portraits[(nextIdx + 1) % portraits.length]);

      setSlotIndices((prev) => {
        const next: [number, number] = [...prev];
        next[back] = nextIdx;
        slotIndicesRef.current = next;
        return next;
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsFading(true));
      });

      if (fadeTimerRef.current != null) window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(() => {
        setVisibleSlot(back);
        visibleSlotRef.current = back;
        setIsFading(false);
        fadeTimerRef.current = null;
      }, FADE_MS);
    };

    const id = window.setInterval(runTransition, ROTATE_MS);
    return () => {
      window.clearInterval(id);
      if (fadeTimerRef.current != null) window.clearTimeout(fadeTimerRef.current);
    };
  }, [portraits]);

  const imgClass =
    'absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out';

  const frontPortrait = portraits[slotIndices[visibleSlot]];
  const ariaName = frontPortrait?.name;

  const slotOpacity = (slot: 0 | 1) => {
    if (!isFading) return slot === visibleSlot ? 1 : 0;
    return slot === visibleSlot ? 0 : 1;
  };

  return (
    <div
      className={cn(
        'relative w-[124px] h-[124px] shrink-0 overflow-hidden rounded-xl bg-greyscale-purp-850',
        className,
      )}
      title={ariaName}
      aria-label={ariaName ? `Featured filmmaker: ${ariaName}` : 'Draft by Filmography'}
    >
      {portraits.length > 0 ? (
        ([0, 1] as const).map((slot) => {
          const portrait = portraits[slotIndices[slot]];
          if (!portrait) return null;
          return (
            <img
              key={slot}
              src={portraitUrl(portrait.profile_path)}
              alt={slot === visibleSlot && !isFading ? portrait.name : ''}
              aria-hidden={slot !== visibleSlot || isFading}
              width={124}
              height={124}
              loading="lazy"
              decoding="async"
              className={cn(imgClass, slotOpacity(slot) === 1 ? 'opacity-100' : 'opacity-0')}
              style={{
                transitionDuration: `${FADE_MS}ms`,
                zIndex: slotOpacity(slot) === 1 ? 2 : 1,
              }}
            />
          );
        })
      ) : (
        <div className="flex h-full w-full items-center justify-center text-greyscale-blue-400">
          <User size={40} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
