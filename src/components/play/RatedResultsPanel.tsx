import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { publicPlayApi, type DraftResultsData } from '@/lib/publicPlayApi';
import { useIsPublicTable } from '@/hooks/useIsPublicTable';
import { PlayerHoverCard } from '@/components/play/PlayerHoverCard';
import { cn } from '@/lib/utils';

interface RatedResultsPanelProps {
  draftId?: string;
}

/**
 * The leaderboard points a rated public game earned, shown on the Final Scores page.
 * Renders nothing for private, single-player or casual drafts, and for people who aren't signed in.
 */
export function RatedResultsPanel({ draftId }: RatedResultsPanelProps) {
  const isPublic = useIsPublicTable(draftId);
  const [data, setData] = useState<DraftResultsData | null>(null);

  useEffect(() => {
    if (!draftId || !isPublic) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await publicPlayApi.draftResults(draftId);
        if (!cancelled) setData(r);
      } catch {
        if (!cancelled) setData(null);
      }
    };
    void load();
    // While scores are still being collected, check again every 10 seconds.
    const id = setInterval(() => {
      if (!cancelled && (data === null || data.status === 'pending')) void load();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [draftId, isPublic, data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.status === 'unrated' || data.status === 'in_progress') return null;

  return (
    <section aria-labelledby="rated-results-heading" className="mx-auto mb-8 flex w-full max-w-[720px] flex-col gap-3 rounded-lg border border-[#49474B] bg-[#0E0E0F] p-5">
      <div className="flex items-center gap-2">
        <Trophy size={20} className="text-[#FFD60A]" aria-hidden />
        <h2 id="rated-results-heading" className="m-0 font-brockmann text-lg font-semibold text-white">Leaderboard points</h2>
      </div>

      {data.status === 'pending' && (
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">Scoring this game. Points will appear here in a minute.</p>
      )}
      {data.status === 'void' && (
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">
          No points were awarded for this game: it takes at least 2 real players who made at least half of their own picks.
        </p>
      )}

      <div>
        <Link to="/play" className="font-brockmann text-sm text-[#C9B8FF] underline">Find another game</Link>
      </div>

      {data.rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {data.rows.map((r) => {
            const mult = Number(r.multiplier);
            return (
              <li key={r.user_id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded px-3 py-2 font-brockmann', r.is_me ? 'bg-[#25015E]' : 'bg-[#1D1D1F]')}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-center text-sm font-semibold text-white">{r.rank ?? '–'}</span>
                  <div className="min-w-0 text-sm text-white">
                    <PlayerHoverCard userId={r.user_id} name={r.name} />
                    {r.is_me && <span className="text-[#BDC3C2]"> (you)</span>}
                    {!r.eligible && (
                      <div className="text-xs text-[#BDC3C2]">Made {r.own_picks} of {r.total_picks} picks themselves, so no points.</div>
                    )}
                    {r.eligible && mult < 1 && data.status === 'final' && (
                      <div className="text-xs text-[#BDC3C2]">Points reduced to {Math.round(mult * 100)}%: these players have met a lot this week.</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[#BDC3C2]">{Math.round(Number(r.raw_score) * 10) / 10}</span>
                  <span className="w-14 text-right text-base font-semibold tabular-nums text-white">+{Number(r.points)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
