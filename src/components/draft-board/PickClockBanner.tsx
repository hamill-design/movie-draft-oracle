import { Timer } from 'lucide-react';
import { formatClockSeconds } from '@/config/referee';

interface PickClockBannerProps {
  secondsLeft: number | null;
  pickClockSeconds: number | null;
  isMyTurn: boolean;
  currentTurnName?: string | null;
  currentTurnIsAway: boolean;
}

/**
 * Countdown for the current turn on a draft where the referee is on.
 * Hidden for bot turns (the existing "AI is thinking" display covers those) and
 * when there is no clock to show.
 */
export function PickClockBanner({
  secondsLeft,
  pickClockSeconds,
  isMyTurn,
  currentTurnName,
  currentTurnIsAway,
}: PickClockBannerProps) {
  if (secondsLeft == null) return null;

  const fraction =
    pickClockSeconds && pickClockSeconds > 0 ? Math.min(1, Math.max(0, secondsLeft / pickClockSeconds)) : 1;
  const urgent = secondsLeft <= 10 && !currentTurnIsAway;
  const warning = !urgent && fraction <= 0.25 && !currentTurnIsAway;
  const accent = urgent ? '#FF5C5C' : warning ? '#FFD60A' : '#907AFF';

  let message: string;
  if (currentTurnIsAway) {
    message = `${currentTurnName ?? 'This player'} is away, so picks are being made for them automatically.`;
  } else if (isMyTurn) {
    message = 'If time runs out, a pick is made for you automatically.';
  } else {
    message = `${currentTurnName ?? 'The current player'} is on the clock.`;
  }

  return (
    <div
      role="timer"
      aria-live="off"
      style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto 16px',
        padding: '16px 24px',
        background: 'var(--UI-Primary, #1D1D1F)',
        borderRadius: '8px',
        outline: `1px solid ${urgent ? accent : 'var(--Item-Stroke, #49474B)'}`,
        outlineOffset: '-1px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Timer size={20} color={accent} aria-hidden />
          <span
            style={{
              color: 'var(--Text-Primary, #FCFFFF)',
              fontFamily: 'Brockmann',
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: '24px',
            }}
          >
            {currentTurnIsAway ? 'Auto-picking' : 'Time to pick'}
          </span>
        </div>
        {!currentTurnIsAway && (
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
        )}
      </div>

      {!currentTurnIsAway && (
        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--Item-Stroke, #49474B)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${fraction * 100}%`,
              background: accent,
              transition: 'width 1s linear, background 0.3s ease',
            }}
          />
        </div>
      )}

      <div
        style={{
          color: 'var(--Text-Light-grey, #BDC3C2)',
          fontFamily: 'Brockmann',
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: '20px',
        }}
      >
        {message}
      </div>
    </div>
  );
}
