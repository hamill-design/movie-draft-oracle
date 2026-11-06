import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type OpenGameRow } from '@/lib/publicPlayApi';
import { FORMAT_LABELS, describeClock, formatWhen } from '@/config/publicPlay';
import { cn } from '@/lib/utils';

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

interface OpenGameTileProps {
  game: OpenGameRow;
  busy: boolean;
  onJoin: (game: OpenGameRow) => void;
}

/** One open game: what it is, how fast it plays, who is in it and a Join button. */
function OpenGameTile({ game, busy, onJoin }: OpenGameTileProps) {
  const live = game.speed === 'live';
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-purple-500/25 bg-purple-950/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-1 font-brockmann text-xs font-semibold',
            live ? 'bg-[#25015E] text-[#C9B8FF]' : 'bg-[#1B2A3A] text-[#A9D0F5]',
          )}
        >
          <Clock size={13} aria-hidden />
          {live ? 'Live' : 'Slow'} · {describeClock(game.pick_clock_seconds)} per pick
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-[#1D1D1F] px-2 py-1 font-brockmann text-xs text-[#BDC3C2]">
          {game.rated && <Trophy size={12} aria-hidden />}
          {game.rated ? 'Rated' : 'Casual'}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-brockmann text-lg font-semibold leading-snug text-greyscale-blue-100">{game.title}</h3>
        <p className="m-0 font-brockmann text-sm text-greyscale-blue-300">
          {FORMAT_LABELS[game.theme] ?? 'Draft'} · hosted by {game.host_name ?? 'a player'}
        </p>
      </div>

      <div className="flex flex-col gap-1 font-brockmann text-sm text-greyscale-blue-300">
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} aria-hidden />
          {game.joined_count} of {game.table_size} seats filled
        </span>
        <span>{game.scheduled_start_at ? `Starts ${formatWhen(game.scheduled_start_at)}` : 'Starts when the host is ready'}</span>
      </div>

      <Button
        onClick={() => onJoin(game)}
        disabled={busy}
        className="mt-auto w-fit rounded-[2px] bg-[#7142FF] px-5 font-semibold text-white hover:bg-[#5e32e0]"
      >
        {game.i_joined ? 'Open game' : busy ? 'Joining…' : 'Join game'}
      </Button>
    </li>
  );
}

interface OpenGamesListProps {
  games: OpenGameRow[] | null;
  /** Can this visitor join straight away (signed in, with a public name)? If not, Join goes via the Play page. */
  canJoinHere: boolean;
  /** Given for a signed-out guest: Join calls this (to ask them to sign in) instead of joining. */
  onGuestJoin?: (game: OpenGameRow) => void;
}

export function OpenGamesList({ games, canJoinHere, onGuestJoin }: OpenGamesListProps) {
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
      <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading open games">
        {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-lg border border-purple-500/25 bg-purple-950/40" />)}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1 rounded-lg border border-dashed border-purple-500/40 p-6">
        <p className="m-0 font-brockmann text-base font-semibold text-greyscale-blue-100">Nobody's waiting yet</p>
        <p className="m-0 max-w-[560px] font-brockmann text-sm text-greyscale-blue-300">
          Press Quick Play to open a lobby. The next player lands in it.
        </p>
      </div>
    );
  }

  return (
    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
      {games.map((g) => (
        <OpenGameTile key={g.draft_id} game={g} busy={joining === g.draft_id} onJoin={join} />
      ))}
    </ul>
  );
}
