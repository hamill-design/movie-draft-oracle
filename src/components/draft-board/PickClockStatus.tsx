import { formatClockSeconds } from '@/config/referee';

interface PickClockStatusProps {
  secondsLeft: number | null;
  pickClockSeconds: number | null;
  isMyTurn: boolean;
  currentTurnName?: string | null;
  currentTurnIsAway: boolean;
  /** Where it sits: on the purple "It's Your Turn!" panel, or on the dark "Waiting for…" panel. */
  tone: 'purple' | 'dark';
}

/**
 * The countdown for the current turn, shown inside the Draft Status card's turn panel: "Time to pick" with the
 * time on the right, a thin bar that drains, and (on your turn) the auto-pick note. It has no box of its own.
 * Shows nothing when there is no clock running. Bot turns never reach it (the panel says the bot is thinking).
 */
export function PickClockStatus({
  secondsLeft,
  pickClockSeconds,
  isMyTurn,
  currentTurnName,
  currentTurnIsAway,
  tone,
}: PickClockStatusProps) {
  if (secondsLeft == null) return null;

  const onPurple = tone === 'purple';
  const fraction =
    pickClockSeconds && pickClockSeconds > 0 ? Math.min(1, Math.max(0, secondsLeft / pickClockSeconds)) : 1;
  const urgent = secondsLeft <= 10 && !currentTurnIsAway;
  const warning = !urgent && fraction <= 0.25 && !currentTurnIsAway;
  const calm = onPurple ? '#FCFFFF' : '#907AFF';
  const accent = urgent ? '#FF5C5C' : warning ? '#FFD60A' : calm;
  const track = onPurple ? 'rgba(252, 255, 255, 0.2)' : 'var(--Item-Stroke, #49474B)';

  const noteStyle = {
    color: onPurple ? '#E4DBFF' : 'var(--Text-Light-grey, #BDC3C2)',
    fontFamily: 'Brockmann',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '20px',
  } as const;

  // A player who is away has their picks made for them: no countdown, just the explanation.
  if (currentTurnIsAway) {
    return (
      <div role="timer" aria-live="off" style={{ ...noteStyle, textAlign: 'center' }}>
        {isMyTurn
          ? "You're marked away, so picks are being made for you automatically. Click anywhere to jump back in."
          : `${currentTurnName ?? 'This player'} is away, so picks are being made for them automatically.`}
      </div>
    );
  }

  return (
    <div role="timer" aria-live="off" className="flex w-full flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span style={noteStyle}>Time to pick</span>
        <span
          style={{
            color: accent,
            fontFamily: 'Brockmann',
            fontSize: '24px',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: '28px',
          }}
        >
          {formatClockSeconds(secondsLeft)}
        </span>
      </div>

      <div style={{ height: '4px', borderRadius: '2px', background: track, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${fraction * 100}%`,
            background: accent,
            transition: 'width 1s linear, background 0.3s ease',
          }}
        />
      </div>

      {isMyTurn && <div style={{ ...noteStyle, textAlign: 'center' }}>If time runs out, a pick is made for you automatically.</div>}
    </div>
  );
}
