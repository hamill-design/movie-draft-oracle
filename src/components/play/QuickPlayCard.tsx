import { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuickPlay } from '@/hooks/useQuickPlay';

interface QuickPlayCardProps {
  /** Arrived from the homepage's Quick Play button (after signing in or choosing a name): do it straight away. */
  autoRun?: boolean;
  /** Called once the auto-run has been kicked off, so the page can tidy its address. */
  onAutoRunStarted?: () => void;
  /** Given for a signed-out guest: the button calls this (to ask them to sign in) instead of playing. */
  onGuestAction?: () => void;
}

/** Quick Play: be in a live lobby within a minute. Joins an open game, or opens one for the next person to join. */
export function QuickPlayCard({ autoRun = false, onAutoRunStarted, onGuestAction }: QuickPlayCardProps) {
  const { busy, quickPlay } = useQuickPlay();
  const guest = onGuestAction !== undefined;
  const ranAuto = useRef(false);

  useEffect(() => {
    if (guest || !autoRun || ranAuto.current) return;
    ranAuto.current = true;
    onAutoRunStarted?.();
    void quickPlay();
  }, [guest, autoRun, onAutoRunStarted, quickPlay]);

  return (
    <section
      aria-labelledby="quick-play-heading"
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#907AFF] bg-[#25015E] p-6"
    >
      <div className="flex items-start gap-4">
        <Zap size={28} className="mt-0.5 shrink-0 text-[#FFD60A]" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 id="quick-play-heading" className="m-0 font-brockmann text-xl font-semibold text-white">Quick Play</h2>
          <p className="m-0 max-w-[520px] font-brockmann text-sm text-[#E4DBFF]">
            Jump into a live game, or we'll open a lobby for you. The host starts the draft.
          </p>
        </div>
      </div>
      <Button
        onClick={() => (onGuestAction ? onGuestAction() : void quickPlay())}
        disabled={busy}
        className="bg-[#FFD60A] px-6 font-semibold text-black hover:bg-[#FFE55C]"
      >
        {busy ? 'Finding a game…' : 'Quick Play'}
      </Button>
    </section>
  );
}
