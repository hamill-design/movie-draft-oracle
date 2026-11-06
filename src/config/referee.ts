/**
 * Pick clock / referee settings shared by the draft screen.
 * See docs/public-matchmaking-plan.md (section 3) and docs/referee-setup.md.
 */

/**
 * Can every draft host choose a pick clock (the "Pick clock" row in the lobby's Draft Status card)?
 * True since 2026-11-05. Set to false to go back to admin-only (players still SEE the countdown on any
 * draft that has a clock).
 */
export const REFEREE_CLOCK_VISIBLE_TO_ALL = true;

export interface PickClockOption {
  label: string;
  /** null = no clock (today's behaviour: wait as long as it takes) */
  seconds: number | null;
  group: 'none' | 'live' | 'slow';
}

/** Presets the host can choose. The database allows 30 seconds to 24 hours. */
export const PICK_CLOCK_OPTIONS: PickClockOption[] = [
  { label: 'No clock', seconds: null, group: 'none' },
  { label: '30 seconds', seconds: 30, group: 'live' },
  { label: '1 minute', seconds: 60, group: 'live' },
  { label: '90 seconds', seconds: 90, group: 'live' },
  { label: '2 minutes', seconds: 120, group: 'live' },
  { label: '1 hour', seconds: 3600, group: 'slow' },
  { label: '4 hours', seconds: 14400, group: 'slow' },
  { label: '12 hours', seconds: 43200, group: 'slow' },
  { label: '24 hours', seconds: 86400, group: 'slow' },
];

/** "0:42", "12:05", "5h 12m" */
export function formatClockSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
