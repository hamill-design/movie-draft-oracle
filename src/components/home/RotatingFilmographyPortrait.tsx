import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const TMDB_PROFILE_BASE = 'https://image.tmdb.org/t/p/w500';

/** Resolved via search-people — 30 actors + 10 directors. */
const FEATURED_ACTORS = [
  'Tom Cruise',
  'Meryl Streep',
  'Ryan Gosling',
  'Margot Robbie',
  'Leonardo DiCaprio',
  'Denzel Washington',
  'Brad Pitt',
  'Sandra Bullock',
  'Demi Moore',
  'Timothée Chalamet',
  'Emma Stone',
  'Robert Downey Jr.',
  'Scarlett Johansson',
  'Harrison Ford',
  'Jennifer Lawrence',
  'Pedro Pascal',
  'Cate Blanchett',
  'Mahershala Ali',
  'Viola Davis',
  'Florence Pugh',
  'Willem Dafoe',
  'Keanu Reeves',
  'Charlize Theron',
  'Idris Elba',
  'Rami Malek',
  'Saoirse Ronan',
  'Daniel Kaluuya',
  'Michelle Yeoh',
  'Cary Grant',
  'Katherine Hepburn',
] as const;

const FEATURED_DIRECTORS = [
  'Christopher Nolan',
  'Steven Spielberg',
  'Martin Scorsese',
  'Quentin Tarantino',
  'Greta Gerwig',
  'Denis Villeneuve',
  'Paul Thomas Anderson',
  'Peter Weir',
  'Stanley Kubrick',
  'Alfred Hitchcock',
] as const;

const FEATURED_FILMMAKERS = [...FEATURED_ACTORS, ...FEATURED_DIRECTORS];

const ROTATE_MS = 4000;
const FADE_MS = 500;

type Portrait = { name: string; profile_path: string };

function portraitUrl(profilePath: string) {
  return `${TMDB_PROFILE_BASE}${profilePath}`;
}

function preloadPortraits(portraits: Portrait[]) {
  portraits.forEach((p) => {
    const img = new Image();
    img.src = portraitUrl(p.profile_path);
  });
}

let cachedPortraits: Portrait[] | null = null;
let cachePromise: Promise<Portrait[]> | null = null;

async function fetchFeaturedPortraits(): Promise<Portrait[]> {
  if (cachedPortraits) return cachedPortraits;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const settled = await Promise.all(
      FEATURED_FILMMAKERS.map(async (name) => {
        try {
          const { data, error } = await supabase.functions.invoke('search-people', {
            body: { searchQuery: name, searchType: 'person' },
          });
          if (error || !data?.results?.length) return null;

          const exact = data.results.find(
            (p: { name: string; profile_path: string | null }) =>
              p.profile_path && p.name.toLowerCase() === name.toLowerCase(),
          );
          const withPhoto = data.results.find(
            (p: { profile_path: string | null }) => p.profile_path,
          );
          const person = exact ?? withPhoto;
          if (!person?.profile_path) return null;

          return { name: person.name as string, profile_path: person.profile_path as string };
        } catch {
          return null;
        }
      }),
    );

    const portraits = settled.filter((p): p is Portrait => p != null);
    preloadPortraits(portraits);
    cachedPortraits = portraits;
    return portraits;
  })();

  return cachePromise;
}

type RotatingFilmographyPortraitProps = {
  className?: string;
};

export function RotatingFilmographyPortrait({ className }: RotatingFilmographyPortraitProps) {
  const [portraits, setPortraits] = useState<Portrait[]>(cachedPortraits ?? []);
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

  useEffect(() => {
    let cancelled = false;
    fetchFeaturedPortraits().then((list) => {
      if (!cancelled && list.length > 0) {
        preloadPortraits(list);
        setPortraits(list);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (portraits.length <= 1) return;

    const runTransition = () => {
      const front = visibleSlotRef.current;
      const back: 0 | 1 = front === 0 ? 1 : 0;
      const currentIdx = slotIndicesRef.current[front];
      const nextIdx = (currentIdx + 1) % portraits.length;

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
  }, [portraits.length]);

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
