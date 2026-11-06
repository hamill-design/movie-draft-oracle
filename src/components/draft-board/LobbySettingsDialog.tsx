import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PICK_CLOCK_OPTIONS } from '@/config/referee';
import EnhancedCategoriesForm from '@/components/EnhancedCategoriesForm';
import type { Participant } from '@/types/participant';
import { describeClock } from '@/config/publicPlay';
import { cn } from '@/lib/utils';

/** What the host sees and can change. A setting that is null is not offered. */
export interface LobbySettings {
  /** Seats at the table. Offered with `seatRange`. */
  seats: number | null;
  /** Seconds per pick (null = no clock, offered only where a draft may have none). */
  clock: number | null;
  /** Counts toward the leaderboard. null = not offered (private drafts are never rated). */
  rated: boolean | null;
  categories: string[];
}

export interface LobbySettingsChange {
  seats?: number;
  clock?: number | null;
  rated?: boolean;
  categories?: string[];
}

interface LobbySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: LobbySettings;
  /** The fewest and most seats the host can pick (the fewest is the people already at the table). */
  seatRange: { min: number; max: number } | null;
  /** Can the host change the pick clock here? (default yes) */
  allowClock?: boolean;
  /** May this draft run with no pick clock? (Public tables always have one.) */
  allowNoClock: boolean;
  /** The categories the host can choose from. null = this draft keeps the ones it has. */
  categoryOptions: string[] | null;
  /** What the draft is about, so the category list can show how many movies each one has (as on the setup page). */
  theme: string;
  option: string;
  /** People at the table now: how many movies each category needs. Replaced by the seat count while the host changes it. */
  playerCount: number;
  /** Saves the changes. Throw (with a message) to keep the window open and show it. */
  onSave: (change: LobbySettingsChange) => Promise<void>;
}

const NO_CLOCK = 'none';
const label = 'font-brockmann text-sm font-medium text-[#FCFFFF]';
const hint = 'm-0 font-brockmann text-xs text-[#BDC3C2]';

/**
 * The host's "Edit settings" window, the same for every draft until it starts: seats, pick clock, casual or
 * rated, and the categories. Each setting is only shown when it can be changed for this kind of draft.
 */
export function LobbySettingsDialog({
  open, onOpenChange, settings, seatRange, allowClock = true, allowNoClock, categoryOptions, theme, option, playerCount, onSave,
}: LobbySettingsDialogProps) {
  const [seats, setSeats] = useState<number | null>(settings.seats);
  const [clock, setClock] = useState<number | null>(settings.clock);
  const [rated, setRated] = useState<boolean | null>(settings.rated);
  // The same category picker as the setup page, with its green / yellow / red movie counts.
  const categoryForm = useForm<{ participants: Participant[]; categories: string[] }>({
    defaultValues: { participants: [], categories: settings.categories },
  });
  const [countFor, setCountFor] = useState(seats ?? playerCount);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Each time the window opens it starts from what the draft has now.
  useEffect(() => {
    if (!open) return;
    setSeats(settings.seats);
    setClock(settings.clock);
    setRated(settings.rated);
    categoryForm.reset({ participants: [], categories: settings.categories });
    setCountFor(settings.seats ?? playerCount);
    setProblem(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // The counts are re-worked for the new seat count once the host stops tapping.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setCountFor(seats ?? playerCount), 700);
    return () => clearTimeout(id);
  }, [open, seats, playerCount]);

  const clockOptions = PICK_CLOCK_OPTIONS.filter((o) => allowNoClock || o.seconds != null);
  const clockKnown = clockOptions.some((o) => o.seconds === clock);
  const clockValue = clock == null ? NO_CLOCK : String(clock);

  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i]);

  const save = async () => {
    const change: LobbySettingsChange = {};
    if (seats != null && seats !== settings.seats) change.seats = seats;
    if (allowClock && clock !== settings.clock && (clock != null || allowNoClock)) change.clock = clock;
    if (rated != null && rated !== settings.rated) change.rated = rated;
    if (categoryOptions) {
      const picked = categoryForm.getValues('categories') ?? [];
      if (picked.length === 0) {
        setProblem('Pick at least one category.');
        return;
      }
      // Wild Card always goes last, as in a Quick Play lobby.
      const ordered = picked.includes('Wild Card') ? [...picked.filter((c) => c !== 'Wild Card'), 'Wild Card'] : picked;
      if (!sameList(ordered, settings.categories)) change.categories = ordered;
    }
    if (Object.keys(change).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await onSave(change);
      onOpenChange(false);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#49474B] bg-[#0E0E0F] text-white sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-brockmann text-xl">Draft settings</DialogTitle>
          <DialogDescription className="font-brockmann text-sm text-[#BDC3C2]">
            Everyone sees the changes. They can be made until the draft starts.
          </DialogDescription>
        </DialogHeader>

        {seats != null && seatRange && (
          <section className="flex flex-col gap-2" aria-label="Seats">
            <div className="flex items-center justify-between gap-3">
              <span className={label}>Seats</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer seats"
                  disabled={seats <= seatRange.min}
                  onClick={() => setSeats(seats - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#49474B] bg-transparent text-[#FCFFFF] transition-colors hover:bg-[#1D1D1F] disabled:opacity-40"
                >
                  <Minus size={16} aria-hidden />
                </button>
                <span className="w-6 text-center font-brockmann text-base font-semibold tabular-nums text-[#FCFFFF]" aria-live="polite">{seats}</span>
                <button
                  type="button"
                  aria-label="More seats"
                  disabled={seats >= seatRange.max}
                  onClick={() => setSeats(seats + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#49474B] bg-transparent text-[#FCFFFF] transition-colors hover:bg-[#1D1D1F] disabled:opacity-40"
                >
                  <Plus size={16} aria-hidden />
                </button>
              </div>
            </div>
            <p className={hint}>Seats nobody takes are filled with bots when you start.</p>
          </section>
        )}

        {allowClock && (
        <section className="flex flex-col gap-2" aria-label="Pick clock">
          <label htmlFor="settings-clock" className={label}>Pick clock</label>
          <select
            id="settings-clock"
            value={clockValue}
            onChange={(e) => setClock(e.target.value === NO_CLOCK ? null : Number(e.target.value))}
            className="h-10 w-full rounded-[2px] border border-[#49474B] bg-[#1D1D1F] px-3 font-brockmann text-sm text-[#FCFFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907AFF]"
          >
            {allowNoClock && <option value={NO_CLOCK}>No clock</option>}
            {!clockKnown && clock != null && <option value={String(clock)}>{describeClock(clock)}</option>}
            <optgroup label="Live">
              {clockOptions.filter((o) => o.group === 'live').map((o) => (
                <option key={o.label} value={String(o.seconds)}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="Slow">
              {clockOptions.filter((o) => o.group === 'slow').map((o) => (
                <option key={o.label} value={String(o.seconds)}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </section>
        )}

        {rated != null && (
          <section className="flex flex-col gap-2" aria-label="Game type">
            <span className={label} id="settings-game">Game</span>
            <div role="radiogroup" aria-labelledby="settings-game" className="flex gap-2">
              {[
                { value: false, text: 'Casual' },
                { value: true, text: 'Rated' },
              ].map((o) => (
                <button
                  key={o.text}
                  type="button"
                  role="radio"
                  aria-checked={rated === o.value}
                  onClick={() => setRated(o.value)}
                  className={cn(
                    'h-10 flex-1 rounded-[2px] border font-brockmann text-sm font-semibold transition-colors',
                    rated === o.value
                      ? 'border-[#907AFF] bg-[#680AFF] text-[#FCFFFF]'
                      : 'border-[#49474B] bg-transparent text-[#FCFFFF] hover:bg-[#1D1D1F]',
                  )}
                >
                  {o.text}
                </button>
              ))}
            </div>
            <p className={hint}>Rated games count toward the leaderboard when 2 or more people play.</p>
          </section>
        )}

        {categoryOptions && (
          <section className="flex flex-col gap-3" aria-label="Categories">
            <span className={label}>Categories</span>
            <EnhancedCategoriesForm
              embedded
              form={categoryForm}
              categories={categoryOptions}
              theme={theme}
              selectedOption={option}
              playerCount={countFor}
              draftMode="multiplayer"
            />
          </section>
        )}

        {problem && (
          <p role="alert" className="m-0 rounded-[2px] bg-[#3A1514] px-3 py-2 font-brockmann text-sm text-[#FFB4AB]">{problem}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-[2px] border border-[#49474B] bg-transparent px-4 font-brockmann text-sm font-semibold text-[#FCFFFF] transition-colors hover:bg-[#1D1D1F]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="h-10 rounded-[2px] bg-[#680AFF] px-5 font-brockmann text-sm font-semibold text-[#FCFFFF] transition-colors hover:bg-[#794DFF] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
