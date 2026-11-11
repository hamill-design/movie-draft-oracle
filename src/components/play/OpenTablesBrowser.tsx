import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type PublicTableRow, type TableSpeed } from '@/lib/publicPlayApi';
import { TableCard } from '@/components/play/TableCard';
import { DropdownSelect } from '@/components/ui/dropdown-select';

interface OpenTablesBrowserProps {
  /** Bumped by the parent after creating a table so the list refreshes. */
  refreshKey?: number;
  onHostClick: () => void;
}

export function OpenTablesBrowser({ refreshKey = 0, onHostClick }: OpenTablesBrowserProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [speed, setSpeed] = useState<'all' | TableSpeed>('all');
  const [format, setFormat] = useState<'all' | 'year' | 'people' | 'spec-draft'>('all');
  const [tables, setTables] = useState<PublicTableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await publicPlayApi.listTables(speed === 'all' ? null : speed, format === 'all' ? null : format);
      setTables(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tables.');
    }
  }, [speed, format]);

  useEffect(() => {
    setTables(null);
    void load();
    const id = setInterval(() => void load(), 15000);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  const join = async (draftId: string) => {
    setJoining(draftId);
    try {
      await publicPlayApi.joinTable(draftId);
      navigate(`/draft/${draftId}`);
    } catch (err) {
      toast({ title: "Couldn't join that table", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      void load();
    } finally {
      setJoining(null);
    }
  };

  return (
    <section aria-labelledby="open-tables-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="open-tables-heading" className="m-0 font-brockmann text-xl font-medium text-white">Open tables</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="filter-speed">Speed</label>
          <DropdownSelect
            id="filter-speed"
            className="w-auto min-w-[200px]"
            value={speed}
            onChange={(v) => setSpeed(v as typeof speed)}
            options={[
              { value: 'all', label: 'Any speed' },
              { value: 'live', label: 'Live (2 min or less per pick)' },
              { value: 'slow', label: 'Slow (hours per pick)' },
            ]}
          />
          <label className="sr-only" htmlFor="filter-format">Format</label>
          <DropdownSelect
            id="filter-format"
            className="w-auto min-w-[190px]"
            value={format}
            onChange={(v) => setFormat(v as typeof format)}
            options={[
              { value: 'all', label: 'Any format' },
              { value: 'year', label: 'Draft by Year' },
              { value: 'people', label: 'Draft by Filmography' },
              { value: 'spec-draft', label: 'Special Draft' },
            ]}
          />
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Refresh tables" className="border-[#49474B] bg-transparent text-white">
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="m-0 font-brockmann text-sm text-[#FF8A8A]">{error}</p>}

      {tables === null && !error && (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="h-44 rounded-lg bg-[#0E0E0F] border border-[#49474B] animate-pulse" />)}
        </div>
      )}

      {tables && tables.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#49474B] p-8 text-center flex flex-col items-center gap-3">
          <p className="m-0 font-brockmann text-base text-white">No open tables right now.</p>
          <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">Be the first: host a table and others can join you.</p>
          <Button onClick={onHostClick} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">Host a table</Button>
        </div>
      )}

      {tables && tables.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {tables.map((t) => (
            <TableCard key={t.draft_id} table={t} busy={joining === t.draft_id} onJoin={join} onOpen={(id) => navigate(`/draft/${id}`)} />
          ))}
        </div>
      )}
    </section>
  );
}
