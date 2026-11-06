import { PICK_CLOCK_OPTIONS } from '@/config/referee';
import type { DraftFormat, TableSpeed } from '@/lib/publicPlayApi';

/** Plain-English names for the draft formats. */
export const FORMAT_LABELS: Record<string, string> = {
  year: 'Draft by Year',
  people: 'Draft by Filmography',
  'spec-draft': 'Special Draft',
};

export const FORMAT_OPTIONS: { value: DraftFormat; label: string; hint: string }[] = [
  { value: 'year', label: 'Draft by Year', hint: 'Movies from one year' },
  { value: 'people', label: 'Draft by Filmography', hint: "One actor's or director's movies" },
  { value: 'spec-draft', label: 'Special Draft', hint: 'A hand-picked themed list' },
];

/** What a table starts with if the host doesn't change anything. */
export const DEFAULT_TABLE_CATEGORIES = [
  'Action/Adventure',
  'Comedy',
  'Drama/Romance',
  'Academy Award Nominee or Winner',
  'Wild Card',
];

/** Categories a host can toggle for year and filmography tables. */
export const SELECTABLE_CATEGORIES = [
  'Action/Adventure',
  'Animated',
  'Comedy',
  'Drama/Romance',
  'Sci-Fi/Fantasy',
  'Horror/Thriller',
  'Academy Award Nominee or Winner',
  'Blockbuster (minimum of $50 Mil)',
  'Sequel',
  'Wild Card',
];

export const MIN_TABLE_CATEGORIES = 3;
export const MAX_TABLE_CATEGORIES = 8;

/** The clock presets a host can choose for a public table (no "No clock": strangers can't be waited on forever). */
export const TABLE_CLOCK_OPTIONS = PICK_CLOCK_OPTIONS.filter((o) => o.seconds != null);

export const speedOfClock = (seconds: number): TableSpeed => (seconds <= 120 ? 'live' : 'slow');

export function describeClock(seconds: number): string {
  const preset = PICK_CLOCK_OPTIONS.find((o) => o.seconds === seconds);
  if (preset) return preset.label;
  if (seconds % 3600 === 0) return `${seconds / 3600} hours`;
  if (seconds % 60 === 0) return `${seconds / 60} minutes`;
  return `${seconds} seconds`;
}

/** "Fri, 8:00 PM" in the viewer's own time zone. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "2h 14m", "45m", "under a minute" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'under a minute';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** How long a host may be late before the table moves on (mirrors the database rule). */
export function hostGraceMs(pickClockSeconds: number): number {
  return pickClockSeconds <= 120 ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'abusive_name', label: 'Offensive name' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'cheating', label: 'Cheating' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export const CANCEL_REASON_TEXT: Record<string, string> = {
  host_cancelled: 'The host cancelled this table.',
  host_no_show: "The host didn't start the draft in time.",
  host_left: 'The host left and nobody could take over.',
  everyone_left: 'Everyone left the table.',
};

/** The most players a private draft takes through the invite window (public tables use their own table size, 6 at most). */
export const MAX_PRIVATE_SEATS = 6;
