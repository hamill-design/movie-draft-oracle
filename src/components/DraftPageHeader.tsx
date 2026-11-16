import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Calendar, Clapperboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { cn, getCleanActorName } from '@/lib/utils';
import { isUuid } from '@/utils/resolveDraftTitle';
import { yearDraftImage } from '@/lib/yearDraftImages';

const TMDB_PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

/** spec draft id -> photo url (null = looked up, has none). Shared so repeat visits don't re-query. */
const specPhotoCache = new Map<string, string | null>();

/** A bare id is never a readable heading (it means the spec draft's name hasn't resolved yet). */
const readableOrEmpty = (value: string | null | undefined): string => {
  const text = (value ?? '').toString().trim();
  return text && !isUuid(text) ? text : '';
};

/** The draft's name as shown in the header, without the trailing "DRAFT". Empty while a spec draft name is still loading. */
export function getDraftHeaderName(
  option: string | null | undefined,
  theme?: string | null,
  specDraftName?: string | null,
): string {
  if (theme === 'people') return getCleanActorName(option ?? '').trim();
  if (theme === 'spec-draft') return readableOrEmpty(specDraftName) || readableOrEmpty(option);
  return (option ?? '').toString().trim();
}

function toDraftTitle(name: string): string {
  if (!name) return '';
  const upper = name.toUpperCase();
  return /\bDRAFT$/.test(upper) ? upper : `${upper} DRAFT`;
}

/**
 * Image that fades in over its placeholder, and disappears if it fails to load.
 * `contain` shows the whole picture, uncropped (the year graphics), instead of filling the tile.
 */
function FadeImage({ src, contain = false }: { src: string; contain?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn(
        'absolute inset-0 h-full w-full transition-opacity duration-300',
        contain ? 'object-contain' : 'object-cover',
        loaded ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

interface DraftHeaderImageProps {
  option: string;
  theme?: string | null;
  /** Skip the lookup and use this image (null = deliberately no image). */
  imageUrl?: string | null;
  /** Resize or reshape the tile (the draft cards use a 96px tile with 8px corners). */
  className?: string;
}

/** 124px tile (72px on a phone): a person's portrait, a special draft's photo, or a quiet placeholder. */
export function DraftHeaderImage({ option, theme, imageUrl, className }: DraftHeaderImageProps) {
  const isPeople = theme === 'people';
  const actorName = isPeople ? getCleanActorName(option) : '';
  const { people } = usePeopleSearch(isPeople ? actorName : undefined);

  const [specPhoto, setSpecPhoto] = useState<string | null>(() => specPhotoCache.get(option) ?? null);

  useEffect(() => {
    if (imageUrl !== undefined || theme !== 'spec-draft' || !isUuid(option)) return;
    if (specPhotoCache.has(option)) {
      setSpecPhoto(specPhotoCache.get(option) ?? null);
      return;
    }
    let cancelled = false;
    supabase
      .from('spec_drafts')
      .select('photo_url')
      .eq('id', option)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return;
        const url = data?.photo_url ?? null;
        specPhotoCache.set(option, url);
        if (!cancelled) setSpecPhoto(url);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, theme, option]);

  const actor = isPeople
    ? people.find((p) => p.name.toLowerCase() === actorName.toLowerCase())
    : undefined;

  let src: string | null = null;
  if (imageUrl !== undefined) src = imageUrl;
  else if (isPeople) src = actor?.profile_path ? `${TMDB_PROFILE_BASE_URL}${actor.profile_path}` : null;
  else if (theme === 'spec-draft') src = specPhoto;
  else if (theme === 'year') src = yearDraftImage(option);

  const initials = actorName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // A year's graphic stands on its own: no box, background or padding around it.
  const bareYearImage = theme === 'year' && !!src;

  return (
    <div
      className={cn(
        'relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-greyscale-purp-800 sm:h-[124px] sm:w-[124px]',
        bareYearImage && 'overflow-visible bg-transparent',
        className,
      )}
      aria-hidden="true"
    >
      {bareYearImage ? null : isPeople && initials ? (
        <span className="font-brockmann text-2xl font-semibold text-greyscale-blue-300 sm:text-4xl">{initials}</span>
      ) : theme === 'year' ? (
        <Calendar className="h-8 w-8 text-greyscale-blue-300 sm:h-12 sm:w-12" />
      ) : (
        <Clapperboard className="h-8 w-8 text-greyscale-blue-300 sm:h-12 sm:w-12" />
      )}
      {src ? <FadeImage key={src} src={src} contain={theme === 'year'} /> : null}
    </div>
  );
}

interface DraftPageHeaderProps {
  /** Small purple line above the title, e.g. "SETTING UP". */
  label: string;
  /** The draft's option: a year, a person's name, or a special draft's id. */
  option: string;
  theme?: string | null;
  /** Special drafts only: the readable name (the option is just an id). */
  specDraftName?: string | null;
  /** Override the image lookup. Pass null for none. */
  imageUrl?: string | null;
  /** Heading level. Setup and results pages use h1; in-draft pages use h2. */
  as?: 'h1' | 'h2';
  className?: string;
  /** Extra content under the title (e.g. whose pick it is). */
  children?: ReactNode;
}

/**
 * Header for the draft pages (setting up, drafting, voting, final scores):
 * a 124px image on the left, a small purple label and the big "NAME DRAFT" title beside it.
 */
export function DraftPageHeader({
  label,
  option,
  theme,
  specDraftName,
  imageUrl,
  as: Heading = 'h1',
  className,
  children,
}: DraftPageHeaderProps) {
  const title = toDraftTitle(getDraftHeaderName(option, theme, specDraftName));
  // Chaney is wide, so a long single word (SCHWARZENEGGER) would split mid-word on a phone.
  // The title shrinks just enough to keep its longest word on one line.
  const longestWord = title.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 1);

  return (
    // No side padding: the image sits flush with the left edge of the content below it.
    <div className={cn('mb-6 flex w-full items-center gap-4 rounded-[8px] px-0 py-4 sm:gap-6 sm:py-6', className)}>
      <DraftHeaderImage option={option} theme={theme} imageUrl={imageUrl} />
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2 text-left [container-type:inline-size]">
        <p className="m-0 font-brockmann text-xl font-bold uppercase leading-6 tracking-[0.8px] text-[hsl(var(--text-purple))] sm:text-[32px] sm:leading-9 sm:tracking-[1.28px]">
          {label}
        </p>
        <Heading
          style={{ '--longest-word': longestWord } as CSSProperties}
          className="m-0 max-w-full break-words font-chaney font-normal uppercase leading-none text-greyscale-blue-100 [text-wrap:balance] text-[length:clamp(18px,calc(100cqw/(var(--longest-word)*0.8)),28px)] sm:text-[length:clamp(18px,calc(100cqw/(var(--longest-word)*0.8)),48px)]"
        >
          {title || ' '}
        </Heading>
        {children}
      </div>
    </div>
  );
}
