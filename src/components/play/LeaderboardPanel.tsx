import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { publicPlayApi, type LeaderboardRow, type MyStanding } from '@/lib/publicPlayApi';
import { PlayerHoverCard } from '@/components/play/PlayerHoverCard';
import { cn } from '@/lib/utils';

type Scope = 'quarter' | 'all';

const quarterLabel = () => {
  const d = new Date();
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
};

/** Public leaderboard: points from rated games, this quarter or all time. */
export function LeaderboardPanel() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('quarter');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [me, setMe] = useState<MyStanding | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    Promise.all([publicPlayApi.leaderboard(scope), publicPlayApi.myStanding(scope)])
      .then(([board, standing]) => {
        if (cancelled) return;
        setRows(board);
        setMe(standing);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the leaderboard.'));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <section aria-labelledby="leaderboard-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="leaderboard-heading" className="m-0 font-brockmann text-xl font-medium text-white">Leaderboard</h2>
          <p className="m-0 font-brockmann text-xs text-[#BDC3C2]">
            Points from rated games: 10 for 1st, 7, 5, 3, 2, then 1. Only real players who made at least half of their own picks are ranked.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Time range">
          <Button size="sm" variant={scope === 'quarter' ? 'default' : 'outline'} onClick={() => setScope('quarter')} className={scope === 'quarter' ? 'bg-[#680AFF] text-white' : 'border-[#49474B] bg-transparent text-white'}>
            {quarterLabel()}
          </Button>
          <Button size="sm" variant={scope === 'all' ? 'default' : 'outline'} onClick={() => setScope('all')} className={scope === 'all' ? 'bg-[#680AFF] text-white' : 'border-[#49474B] bg-transparent text-white'}>
            All time
          </Button>
        </div>
      </div>

      {me && (
        <div className="rounded-lg border border-[#907AFF] bg-[#25015E] p-4 font-brockmann text-sm text-white">
          {me.ranked
            ? <>You're <strong>#{Number(me.rank)}</strong> of {Number(me.players)} with <strong>{Number(me.points)}</strong> points from {Number(me.rated_games)} rated {Number(me.rated_games) === 1 ? 'game' : 'games'}.</>
            : "You're not on the board yet. Play a rated game with at least one other real player to earn points."}
        </div>
      )}

      {error && <p role="alert" className="m-0 font-brockmann text-sm text-[#FF8A8A]">{error}</p>}
      {rows === null && !error && <div className="h-40 animate-pulse rounded-lg border border-[#49474B] bg-[#0E0E0F]" aria-busy="true" />}
      {rows && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#49474B] p-8 text-center font-brockmann text-sm text-[#BDC3C2]">
          No rated games have finished {scope === 'quarter' ? 'this quarter' : 'yet'}. Be the first on the board.
        </div>
      )}
      {rows && rows.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => {
            const mine = r.user_id === user?.id;
            return (
              <li key={r.user_id} className={cn('flex items-center gap-3 rounded-lg border px-4 py-3 font-brockmann', mine ? 'border-[#907AFF] bg-[#25015E]' : 'border-[#49474B] bg-[#0E0E0F]')}>
                <span className="flex w-8 shrink-0 items-center justify-center text-base font-semibold text-white">
                  {Number(r.rank) === 1 ? <Trophy size={18} className="text-[#FFD60A]" aria-label="First place" /> : Number(r.rank)}
                </span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3B2050] text-sm font-semibold text-white">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : r.public_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  <PlayerHoverCard userId={r.user_id} name={r.public_name} />
                  {mine && <span className="text-[#BDC3C2]"> (you)</span>}
                </div>
                <div className="text-right text-xs text-[#BDC3C2]">
                  {Number(r.rated_games)} {Number(r.rated_games) === 1 ? 'game' : 'games'} · {Number(r.wins)} {Number(r.wins) === 1 ? 'win' : 'wins'}
                </div>
                <div className="w-16 text-right text-lg font-semibold tabular-nums text-white">{Number(r.points)}</div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
