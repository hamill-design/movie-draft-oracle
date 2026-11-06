import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePublicPlayAccess } from '@/hooks/usePublicPlayAvailable';
import { useHomeQuickPlay } from '@/components/home/useHomeQuickPlay';

/**
 * One big "Quick Play" button inside the homepage hero, under the headline text.
 * It drops you into an open game, or opens a lobby if there isn't one (a guest is asked to sign in first).
 * The full "Play with others" band lower down has the same button and the list of open games.
 * Renders nothing unless public play is open to this visitor.
 */
export function PublicPlayStrip() {
  const { available } = usePublicPlayAccess();
  if (!available) return null;
  return <QuickPlayButton />;
}

function QuickPlayButton() {
  const { prompt, busy, onQuickPlay } = useHomeQuickPlay();

  return (
    <div role="region" aria-label="Quick play" className="pointer-events-auto relative z-20 flex w-full flex-col items-center gap-3">
      <Button
        onClick={onQuickPlay}
        disabled={busy}
        aria-busy={busy}
        className={cn(
          // The design: 24px / 48px padding, 32px bold caps with 3.2px spacing, brand purple with a glow. A little smaller on phones.
          'h-auto rounded-[2px] bg-[#7142FF] px-8 py-4 font-brockmann text-2xl font-bold uppercase leading-8 tracking-[2.4px] text-[#FCFFFF] shadow-[0_0_13px_5px_#680AFF] hover:bg-[#5e32e0]',
          'md:px-12 md:py-6 md:text-[32px] md:leading-9 md:tracking-[3.2px]',
          busy && 'animate-pulse',
        )}
      >
        Quick Play
      </Button>
      {prompt}
    </div>
  );
}
