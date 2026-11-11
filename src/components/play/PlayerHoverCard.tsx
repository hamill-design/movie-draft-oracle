import { useState, type ReactNode } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { publicPlayApi, type PlayerCardData } from '@/lib/publicPlayApi';

// One lookup per player per visit.
const cache = new Map<string, Promise<PlayerCardData>>();
const lookup = (userId: string) => {
  let p = cache.get(userId);
  if (!p) {
    p = publicPlayApi.playerCard(userId);
    cache.set(userId, p);
    p.catch(() => cache.delete(userId));
  }
  return p;
};

const num = (v: number | string | undefined) => Number(v ?? 0);

interface PlayerHoverCardProps {
  userId: string | null | undefined;
  /** The name shown on the trigger. */
  name: string;
  children?: ReactNode;
  /** Wrap the children (a portrait and a name, say) as one hover target, with no underline. */
  block?: boolean;
}

/**
 * Hover (or focus) a player's name to see their play stats: games, wins and points.
 * Only the public name and stats are ever shown, never an email or a real name.
 */
export function PlayerHoverCard({ userId, name, children, block = false }: PlayerHoverCardProps) {
  const [card, setCard] = useState<PlayerCardData | null>(null);
  const [failed, setFailed] = useState(false);

  if (!userId) return <>{children ?? name}</>;

  const onOpenChange = (open: boolean) => {
    if (!open || card || failed) return;
    lookup(userId).then(setCard).catch(() => setFailed(true));
  };

  return (
    <HoverCard openDelay={200} closeDelay={100} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>
        {block ? (
          <div tabIndex={0} className="w-full cursor-default rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907AFF]">
            {children ?? name}
          </div>
        ) : (
          <span tabIndex={0} className="cursor-default underline decoration-dotted decoration-[#49474B] underline-offset-4">
            {children ?? name}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="w-64 border-[#49474B] bg-[#1D1D1F] p-4 text-left text-white">
        <div className="min-w-0">
          <div className="truncate font-brockmann text-base font-semibold" title={card?.public_name ?? name}>{card?.public_name ?? name}</div>
          <div className="font-brockmann text-xs text-[#BDC3C2]">Player</div>
        </div>
        {failed && <p className="m-0 mt-3 font-brockmann text-xs text-[#BDC3C2]">Stats aren't available right now.</p>}
        {!card && !failed && <div className="mt-3 h-12 animate-pulse rounded bg-[#0E0E0F]" aria-busy="true" />}
        {card && (
          <dl className="m-0 mt-3 grid grid-cols-2 gap-2 font-brockmann">
            {[
              ['Rated games', num(card.rated_games), false],
              ['Wins', num(card.wins), false],
              // The last tile spans the row so three tiles don't leave a gap.
              ['Points this quarter', num(card.points_this_quarter), true],
            ].map(([label, value, wide]) => (
              <div key={label as string} className={`rounded bg-[#0E0E0F] p-2${wide ? ' col-span-2' : ''}`}>
                <dt className="text-[11px] text-[#BDC3C2]">{label}</dt>
                <dd className="m-0 text-base font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
