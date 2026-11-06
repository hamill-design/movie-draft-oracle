import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { useSpecDraftCategories } from '@/hooks/useSpecDraftCategories';
import { supabase } from '@/integrations/supabase/client';
import { publicPlayApi, type DraftFormat } from '@/lib/publicPlayApi';
import {
  DEFAULT_TABLE_CATEGORIES, FORMAT_OPTIONS, MAX_TABLE_CATEGORIES, MIN_TABLE_CATEGORIES,
  SELECTABLE_CATEGORIES, TABLE_CLOCK_OPTIONS,
} from '@/config/publicPlay';
import { cn } from '@/lib/utils';

const fieldClass = 'h-10 w-full rounded border border-[#49474B] bg-[#1D1D1F] px-3 font-brockmann text-sm text-white';
const labelClass = 'font-brockmann text-sm font-medium text-white';
const hintClass = 'font-brockmann text-xs text-[#BDC3C2]';

const YEARS = Array.from({ length: 2025 - 1939 + 1 }, (_, i) => String(2025 - i));

interface SpecDraftOption { id: string; name: string }

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Host a public table: pick what to draft, the pick clock, seats, rated or casual, and an optional start time. */
export function CreateTableDialog({ open, onOpenChange }: CreateTableDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [format, setFormat] = useState<DraftFormat>('year');
  const [year, setYear] = useState('1999');
  const [personQuery, setPersonQuery] = useState('');
  const [person, setPerson] = useState<string | null>(null);
  const [specDrafts, setSpecDrafts] = useState<SpecDraftOption[]>([]);
  const [specId, setSpecId] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_TABLE_CATEGORIES);
  const [seats, setSeats] = useState(4);
  const [clock, setClock] = useState(43200);
  const [rated, setRated] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { people } = usePeopleSearch(person ? '' : personQuery);
  const { specCategories } = useSpecDraftCategories(format === 'spec-draft' && specId ? specId : null);

  // The special-draft list loads the first time that format is chosen.
  useEffect(() => {
    if (!open || format !== 'spec-draft' || specDrafts.length > 0) return;
    (async () => {
      try {
        let res = await (supabase as any).from('spec_drafts').select('id, name').eq('is_hidden', false).order('display_order', { ascending: true, nullsFirst: false });
        if (res.error) res = await (supabase as any).from('spec_drafts').select('id, name').order('created_at', { ascending: false });
        setSpecDrafts((res.data ?? []) as SpecDraftOption[]);
      } catch {
        setSpecDrafts([]);
      }
    })();
  }, [open, format, specDrafts.length]);

  const optionValue = format === 'year' ? year : format === 'people' ? person ?? '' : specId;
  const specName = specDrafts.find((s) => s.id === specId)?.name ?? '';

  const autoTitle = useMemo(() => {
    if (format === 'year') return `Draft by ${year}`;
    if (format === 'people') return person ? `${person} filmography` : '';
    return specName;
  }, [format, year, person, specName]);

  const availableCategories = useMemo(() => {
    const tags = format === 'spec-draft' ? Array.from(specCategories.keys()) : [];
    return Array.from(new Set([...tags, ...SELECTABLE_CATEGORIES]));
  }, [format, specCategories]);

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : prev.length >= MAX_TABLE_CATEGORIES ? prev : [...prev, c]));

  const minStart = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [open]);

  const problem =
    !optionValue ? (format === 'people' ? 'Search for an actor or director.' : format === 'spec-draft' ? 'Choose a special draft.' : 'Choose a year.')
    : categories.length < MIN_TABLE_CATEGORIES ? `Choose at least ${MIN_TABLE_CATEGORIES} categories.`
    : startAt && new Date(startAt).getTime() <= Date.now() ? 'Pick a start time in the future, or clear it.'
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) { setError(problem); return; }
    setSubmitting(true);
    setError(null);
    try {
      const { draft_id } = await publicPlayApi.createTable({
        title: (customTitle.trim() || autoTitle || 'Open table').slice(0, 200),
        theme: format,
        option: optionValue,
        categories,
        tableSize: seats,
        pickClockSeconds: clock,
        rated,
        scheduledStartAt: startAt ? new Date(startAt).toISOString() : null,
      });
      onOpenChange(false);
      toast({ title: 'Table created', description: 'Players can join now. You start the draft when everyone is ready.' });
      navigate(`/draft/${draft_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the table.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#49474B] bg-[#0E0E0F] text-white sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="font-brockmann text-xl">Host a table</DialogTitle>
          <DialogDescription className="font-brockmann text-sm text-[#BDC3C2]">
            Anyone can join. You decide when to start, and the pick clock is locked once the table is created.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>What are you drafting?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  aria-pressed={format === f.value}
                  className={cn(
                    'rounded border px-3 py-2 text-left font-brockmann transition-colors',
                    format === f.value ? 'border-[#907AFF] bg-[#25015E]' : 'border-[#49474B] bg-[#1D1D1F] hover:border-[#907AFF]'
                  )}
                >
                  <div className="text-sm font-semibold">{f.label}</div>
                  <div className="text-xs text-[#BDC3C2]">{f.hint}</div>
                </button>
              ))}
            </div>
          </fieldset>

          {format === 'year' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="table-year" className={labelClass}>Year</label>
              <select id="table-year" value={year} onChange={(e) => setYear(e.target.value)} className={fieldClass}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {format === 'people' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="table-person" className={labelClass}>Actor or director</label>
              {person ? (
                <div className="flex items-center justify-between rounded border border-[#907AFF] bg-[#25015E] px-3 py-2">
                  <span className="font-brockmann text-sm">{person}</span>
                  <button type="button" onClick={() => { setPerson(null); setPersonQuery(''); }} className="font-brockmann text-xs text-[#C9B8FF] underline">
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Input id="table-person" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} placeholder="Start typing a name…" autoComplete="off" className="bg-[#1D1D1F] border-[#49474B] text-white" />
                  {people.length > 0 && (
                    <ul className="m-0 flex list-none flex-col overflow-hidden rounded border border-[#49474B] p-0">
                      {people.slice(0, 6).map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => setPerson(p.name)} className="flex w-full items-center justify-between bg-[#1D1D1F] px-3 py-2 text-left font-brockmann text-sm hover:bg-[#25015E]">
                            <span>{p.name}</span>
                            <span className="text-xs text-[#BDC3C2]">{p.known_for_department}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {format === 'spec-draft' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="table-spec" className={labelClass}>Special draft</label>
              <select id="table-spec" value={specId} onChange={(e) => setSpecId(e.target.value)} className={fieldClass}>
                <option value="">Choose one…</option>
                {specDrafts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>
              Categories <span className={hintClass}>({categories.length} chosen · {MIN_TABLE_CATEGORIES} to {MAX_TABLE_CATEGORIES})</span>
            </legend>
            <p className={cn(hintClass, 'm-0')}>Each player fills one movie per category. More categories means a longer draft.</p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  aria-pressed={categories.includes(c)}
                  className={cn(
                    'rounded-full border px-3 py-1 font-brockmann text-xs transition-colors',
                    categories.includes(c) ? 'border-[#907AFF] bg-[#25015E] text-white' : 'border-[#49474B] bg-[#1D1D1F] text-[#BDC3C2] hover:border-[#907AFF]'
                  )}
                >
                  {c.replace(' (minimum of $50 Mil)', '').replace(' Nominee or Winner', '')}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="table-seats" className={labelClass}>Seats</label>
              <select id="table-seats" value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={fieldClass}>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} players</option>)}
              </select>
              <span className={hintClass}>Empty seats can be filled with bots when you start.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="table-clock" className={labelClass}>Time per pick</label>
              <select id="table-clock" value={clock} onChange={(e) => setClock(Number(e.target.value))} className={fieldClass}>
                <optgroup label="Live (everyone online together)">
                  {TABLE_CLOCK_OPTIONS.filter((o) => o.group === 'live').map((o) => <option key={o.label} value={o.seconds as number}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Slow (pick whenever, get a notification)">
                  {TABLE_CLOCK_OPTIONS.filter((o) => o.group === 'slow').map((o) => <option key={o.label} value={o.seconds as number}>{o.label}</option>)}
                </optgroup>
              </select>
              <span className={hintClass}>If someone runs out of time, a pick is made for them.</span>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded border border-[#49474B] bg-[#1D1D1F] p-3">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="table-rated" className={labelClass}>Rated game</label>
              <span className={hintClass}>Counts toward the leaderboard when 2 or more real players take part. Bots never count.</span>
            </div>
            <Switch id="table-rated" checked={rated} onCheckedChange={setRated} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="table-start" className={labelClass}>Start time <span className={hintClass}>(optional)</span></label>
            <div className="flex items-center gap-2">
              <input id="table-start" type="datetime-local" min={minStart} value={startAt} onChange={(e) => setStartAt(e.target.value)} className={fieldClass} />
              {startAt && <Button type="button" variant="outline" onClick={() => setStartAt('')} className="border-[#49474B] bg-transparent text-white">Clear</Button>}
            </div>
            <span className={hintClass}>
              A promise to your players, not a trigger: the draft only starts when you press Start. Leave it empty to start when the table fills.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="table-title" className={labelClass}>Table name <span className={hintClass}>(optional)</span></label>
            <Input id="table-title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} maxLength={80} placeholder={autoTitle || 'Choose what to draft first'} className="bg-[#1D1D1F] border-[#49474B] text-white" />
          </div>

          {(error || problem) && <p role="alert" className="m-0 font-brockmann text-sm text-[#FF8A8A]">{error ?? problem}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#49474B] bg-transparent text-white">Cancel</Button>
            <Button type="submit" disabled={submitting || !!problem} className="bg-[#680AFF] hover:bg-[#794DFF] text-white disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create table'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
