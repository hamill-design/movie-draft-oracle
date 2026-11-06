import { Clock, Users, CalendarClock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PublicTableRow } from '@/lib/publicPlayApi';
import { FORMAT_LABELS, describeClock, formatWhen } from '@/config/publicPlay';
import { cn } from '@/lib/utils';

interface TableCardProps {
  table: PublicTableRow;
  busy: boolean;
  onJoin: (draftId: string) => void;
  onOpen: (draftId: string) => void;
}

/** One open table in the browser. The clock is the first thing you see: nobody should discover it after sitting down. */
export function TableCard({ table, busy, onJoin, onOpen }: TableCardProps) {
  const live = table.speed === 'live';
  const full = table.seats_open <= 0;

  return (
    <article className="rounded-lg border border-[#49474B] bg-[#0E0E0F] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-1 font-brockmann text-xs font-semibold',
            live ? 'bg-[#25015E] text-[#C9B8FF]' : 'bg-[#1B2A3A] text-[#A9D0F5]'
          )}
        >
          <Clock size={14} aria-hidden />
          {live ? 'Live' : 'Slow'} · {describeClock(table.pick_clock_seconds)} per pick
        </span>
        <span className="rounded bg-[#1D1D1F] px-2 py-1 font-brockmann text-xs text-[#BDC3C2]">
          {FORMAT_LABELS[table.theme] ?? 'Draft'}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded bg-[#1D1D1F] px-2 py-1 font-brockmann text-xs text-[#BDC3C2]"
          title={table.rated ? 'Counts toward the leaderboard when 2 or more real players play' : 'Just for fun'}
        >
          {table.rated && <Trophy size={12} aria-hidden />}
          {table.rated ? 'Rated' : 'Casual'}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-brockmann text-lg font-semibold text-white">{table.title}</h3>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">
          Hosted by {table.host_name ?? 'a player'} · {table.categories.length} categories
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-brockmann text-sm text-[#BDC3C2]">
        <span className="inline-flex items-center gap-1.5">
          <Users size={16} aria-hidden />
          {table.joined_count} of {table.table_size} seats filled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock size={16} aria-hidden />
          {table.scheduled_start_at ? `Starts ${formatWhen(table.scheduled_start_at)}` : 'Starts when the host is ready'}
        </span>
      </div>

      <div>
        {table.i_joined ? (
          <Button onClick={() => onOpen(table.draft_id)} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">
            Open table
          </Button>
        ) : (
          <Button
            onClick={() => onJoin(table.draft_id)}
            disabled={busy || full}
            className="bg-[#680AFF] hover:bg-[#794DFF] text-white disabled:opacity-50"
          >
            {full ? 'Table full' : busy ? 'Joining…' : 'Join table'}
          </Button>
        )}
      </div>
    </article>
  );
}
