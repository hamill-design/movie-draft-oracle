import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraftHeaderImage } from '@/components/DraftPageHeader';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type OpenGameRow } from '@/lib/publicPlayApi';
import { describeClockShort } from '@/config/publicPlay';
import { cn, getCleanActorName } from '@/lib/utils';
import { isUuid } from '@/utils/resolveDraftTitle';

/** The games people can join right now. Refreshes itself while the page is open. */
export function useOpenGames(limit = 6) {
  const [games, setGames] = useState<OpenGameRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      setGames(await publicPlayApi.openGames(limit));
    } catch {
      setGames([]); // not installed yet, or a hiccup: show the empty state rather than an error on the homepage
    }
  }, [limit]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 20000);
    return () => clearInterval(id);
  }, [load]);

  return { games, reload: load };
}

/** What the card calls the draft: a person's name for a filmography draft, "2002 films" for a year, otherwise the draft's own title. */
function cardTitle(game: OpenGameRow): string {
  const option = (game.option ?? '').toString().trim();
  if (game.theme === 'people' && option) return getCleanActorName(option).trim();
  if (game.theme === 'year' && /^\d{4}$/.test(option)) return `${option} films`;
  const title = (game.title ?? '').toString().trim();
  if (title && !isUuid(title)) return title;
  return option && !isUuid(option) ? option : 'Movie draft';
}

interface OpenGameTileProps {
  game: OpenGameRow;
  busy: boolean;
  onJoin: (game: OpenGameRow) => void;
}

/** One open draft: who or what it is about, Ranked or Casual, the clock, categories, seats taken, and Join. */
function OpenGameTile({ game, busy, onJoin }: OpenGameTileProps) {
  const title = cardTitle(game);
  // The name shrinks just enough to keep its longest word on one line (a long surname must not split mid-word).
  const longestWord = title.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 1);
  const categories = game.category_count ?? 0;
  const full = game.seats_open <= 0 && !game.i_joined;

  return (
    <li className="flex w-full flex-col gap-6 rounded-xl border border-[#49474B] bg-[#1D1D1F] p-6">
      <div className="flex flex-col gap-[18px]">
        <div className="flex items-center gap-3">
          <DraftHeaderImage
            option={game.option ?? ''}
            theme={game.theme}
            className="h-16 w-16 rounded-[8px] sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1 [container-type:inline-size]">
            <h3
              style={{ '--longest-word': longestWord } as CSSProperties}
              className="m-0 break-words font-brockmann font-bold leading-[1.125] tracking-[0.04em] text-[#FAFEFF] [text-wrap:balance] text-[length:clamp(16px,calc(100cqw/(var(--longest-word)*0.66)),32px)]"
            >
              {title}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 font-brockmann text-xs leading-4">
          {game.rated ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFD60A] px-3 py-1 font-semibold text-[#1D1D1F]">
              <span className="flex h-4 w-4 items-center justify-center">
                <Trophy size={12} aria-hidden />
              </span>
              Ranked
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[#49474B] px-3 py-1 font-semibold text-[#BDC3C2]">
              Casual
            </span>
          )}

          <div className="flex flex-wrap items-center gap-1 tracking-[0.36px]">
            <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[#BCB2FF]">
              <Clock size={13} aria-hidden />
              {describeClockShort(game.pick_clock_seconds)}
            </span>
            {categories > 0 && (
              <span className="px-2 py-1 text-[#BDC3C2]">
                {categories} {categories === 1 ? 'Category' : 'Categories'}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[#FCFFFF]">
              <Users size={15} aria-hidden />
              <span aria-label={`${game.joined_count} of ${game.table_size} seats filled`}>
                {game.joined_count}/{game.table_size}
              </span>
            </span>
          </div>
        </div>
      </div>

      <Button
        onClick={() => onJoin(game)}
        disabled={busy || full}
        className="h-12 w-full rounded-[2px] bg-[#7142FF] px-[18px] py-3 font-brockmann text-base font-semibold tracking-[0.32px] text-[#FCFFFF] hover:bg-[#5e32e0]"
      >
        {game.i_joined ? 'Open Draft' : full ? 'Draft Full' : busy ? 'Joining…' : 'Join Draft'}
      </Button>
    </li>
  );
}

/** As many 340px+ columns as fit: three across the homepage's 1400px column, fewer on a tablet, one on a phone. */
const GRID = 'grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]';

interface OpenGamesListProps {
  games: OpenGameRow[] | null;
  /** Can this visitor join straight away (signed in, with a public name)? If not, Join goes via the Play page. */
  canJoinHere: boolean;
  /** Given for a signed-out guest: Join calls this (to ask them to sign in) instead of joining. */
  onGuestJoin?: (game: OpenGameRow) => void;
  /** Shown beside the "Nobody's waiting yet" message (the homepage puts a Quick Play button here). */
  emptyAction?: ReactNode;
  /** Replaces the "Nobody's waiting yet" wording (the Play page says something different when a filter hides everything). */
  empty?: { title: string; text: string };
  /** Extra classes for the grid, e.g. a different gap. */
  gridClassName?: string;
}

export function OpenGamesList({ games, canJoinHere, onGuestJoin, emptyAction, empty, gridClassName }: OpenGamesListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [joining, setJoining] = useState<string | null>(null);

  const join = async (game: OpenGameRow) => {
    if (onGuestJoin) {
      onGuestJoin(game);
      return;
    }
    if (game.i_joined) {
      navigate(`/draft/${game.draft_id}`);
      return;
    }
    if (!canJoinHere) {
      navigate(`/play?join=${game.draft_id}`);
      return;
    }
    setJoining(game.draft_id);
    try {
      await publicPlayApi.joinTable(game.draft_id);
      navigate(`/draft/${game.draft_id}`);
    } catch (err) {
      toast({ title: "Couldn't join that game", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      setJoining(null);
    }
  };

  if (games === null) {
    return (
      <div className={cn('grid gap-4', GRID, gridClassName)} aria-busy="true" aria-label="Loading open games">
        {[0, 1, 2].map((i) => <div key={i} className="h-[258px] animate-pulse rounded-xl border border-[#49474B] bg-[#1D1D1F]" />)}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-[#49474B] bg-[#1D1D1F] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="m-0 font-brockmann text-base font-semibold text-greyscale-blue-100">{empty?.title ?? "Nobody's waiting yet"}</p>
          <p className="m-0 max-w-[560px] font-brockmann text-sm text-greyscale-blue-300">
            {empty?.text ?? 'Press Quick Play to open a lobby. The next player lands in it.'}
          </p>
        </div>
        {emptyAction}
      </div>
    );
  }

  return (
    <ul className={cn('m-0 grid list-none gap-4 p-0', GRID, gridClassName)}>
      {games.map((g) => (
        <OpenGameTile key={g.draft_id} game={g} busy={joining === g.draft_id} onJoin={join} />
      ))}
    </ul>
  );
}
