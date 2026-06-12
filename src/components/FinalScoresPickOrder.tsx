import { useMemo } from 'react';
import { DraftPick } from '@/hooks/useDrafts';
import { RefreshCw } from 'lucide-react';

interface FinalScoresPickOrderProps {
  picks: DraftPick[];
  enrichingScores?: boolean;
}

const categoryShortLabels: Record<string, string> = {
  'Academy Award Nominee or Winner': 'Academy Award',
  'Blockbuster (minimum of $50 Mil)': 'Blockbuster',
  Sequel: 'Sequel',
};

function categoryLabel(category: string): string {
  return categoryShortLabels[category] ?? category;
}

function roundSize(picks: DraftPick[]): number {
  const ids = new Set(picks.map((p) => String(p.player_id ?? p.player_name)));
  return Math.max(1, ids.size);
}

function chunkIntoRounds(sorted: DraftPick[], size: number): DraftPick[][] {
  const rounds: DraftPick[][] = [];
  for (let i = 0; i < sorted.length; i += size) {
    rounds.push(sorted.slice(i, i + size));
  }
  return rounds;
}

function RoundDivider({ label }: { label: string }) {
  return (
    <div className="flex h-4 w-full shrink-0 items-center justify-center gap-2 self-stretch">
      <div className="h-0 min-h-0 flex-1 outline outline-1 outline-[var(--Text-Purple,#907AFF)] outline-offset-[-0.5px]" />
      <span className="font-brockmann text-xs font-normal leading-4 tracking-[0.72px] text-[var(--Text-Purple,#907AFF)]">
        {label}
      </span>
      <div className="h-0 min-h-0 flex-1 outline outline-1 outline-[var(--Text-Purple,#907AFF)] outline-offset-[-0.5px]" />
    </div>
  );
}

export function FinalScoresPickOrder({ picks, enrichingScores }: FinalScoresPickOrderProps) {
  const sorted = useMemo(
    () => [...picks].sort((a, b) => a.pick_order - b.pick_order),
    [picks]
  );

  const rounds = useMemo(() => {
    if (sorted.length === 0) return [];
    const size = roundSize(sorted);
    return chunkIntoRounds(sorted, size);
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <p className="m-0 py-6 text-center font-brockmann text-sm text-greyscale-blue-300">No picks to show.</p>
    );
  }

  return (
    <div
      className="box-border flex w-full max-w-full flex-col items-center justify-start gap-4 rounded-lg p-4 sm:gap-6 sm:p-6"
      style={{
        background: 'var(--Section-Container, #0E0E0F)',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '8px',
      }}
    >
      <div className="flex w-full flex-col content-stretch items-center justify-center gap-2 self-stretch">
        <div className="flex flex-col justify-center text-center font-brockmann text-xl font-bold leading-7 tracking-[0.96px] text-[var(--Text-Primary,#FCFFFF)] sm:text-2xl sm:leading-8">
          PICK ORDER
        </div>
      </div>

      {rounds.map((roundPicks, roundIndex) => (
        <div
          key={`round-${roundIndex}`}
          className="flex w-full flex-col items-start justify-start gap-[18px] self-stretch"
        >
          <RoundDivider label={`ROUND ${roundIndex + 1}`} />
          <div className="flex w-full flex-col items-start justify-start gap-0.5 self-stretch">
            {roundPicks.map((pick) => {
              const scoring = pick as { calculated_score?: number | null };
              const scoreRaw = scoring.calculated_score;
              const score =
                scoreRaw != null && !Number.isNaN(Number(scoreRaw)) ? Number(scoreRaw).toFixed(2) : null;
              const movieHoverTitle =
                pick.movie_year != null
                  ? `${pick.movie_title} (${pick.movie_year})`
                  : pick.movie_title;

              return (
                <div
                  key={pick.id}
                  className="flex w-full max-w-full flex-col gap-3 self-stretch bg-[var(--UI-Primary,#1D1D1F)] p-4 sm:flex-row sm:items-start sm:gap-[18px] sm:p-6"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <div className="inline-flex h-7 min-w-7 shrink-0 flex-col items-center justify-center rounded-full bg-[var(--Brand-Primary,#7142FF)] px-2 py-1">
                        <span className="font-brockmann text-base font-normal leading-[18px] text-[var(--Text-Primary,#FCFFFF)] tabular-nums sm:text-lg">
                          {pick.pick_order}
                        </span>
                      </div>
                      <span
                        className="min-w-0 font-brockmann text-sm font-medium leading-5 text-[var(--Text-Primary,#FCFFFF)] sm:text-lg sm:leading-[26px]"
                        title={pick.player_name}
                      >
                        <span className="font-bold">{pick.player_name}</span> picks in
                      </span>
                      <div className="inline-flex max-w-full flex-col items-start justify-start rounded px-2 py-1 outline outline-1 outline-[var(--Hover,#907AFF)] outline-offset-[-1px] bg-[var(--UI-Primary-Pressed,#25015E)]">
                        <span className="font-brockmann text-xs font-normal leading-4 tracking-[0.72px] text-[var(--Text-Primary,#FCFFFF)]">
                          {categoryLabel(pick.category)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full min-w-0">
                      <span
                        className="font-brockmann text-lg font-semibold leading-6 tracking-[0.48px] text-[var(--Text-Primary,#FCFFFF)] break-normal sm:text-2xl sm:leading-[30px]"
                        title={movieHoverTitle}
                      >
                        {pick.movie_title}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-row items-center justify-end sm:min-w-[86px] sm:flex-col sm:items-end sm:justify-start">
                    <span className="text-right font-brockmann text-xl font-semibold leading-7 tracking-[0.48px] text-[var(--Text-Purple,#907AFF)] tabular-nums sm:text-2xl sm:leading-[30px]">
                      {enrichingScores && score === null ? (
                        <RefreshCw className="inline h-5 w-5 animate-spin" aria-hidden />
                      ) : score != null ? (
                        score
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
