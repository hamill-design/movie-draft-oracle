import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type TableInfo } from '@/lib/publicPlayApi';
import { describeClock, formatWhen } from '@/config/publicPlay';

interface InviteLinkCardProps {
  /** The table id from the invite link (`/play?join=<id>`). */
  draftId: string;
}

/** Shown on the Play page when someone follows a table's invite link: a one-click way to take a seat. */
export function InviteLinkCard({ draftId }: InviteLinkCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicPlayApi.tableInfo(draftId).then((i) => !cancelled && setInfo(i)).catch(() => !cancelled && setError("We couldn't find that table. It may have been cancelled."));
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  const join = async () => {
    setJoining(true);
    try {
      await publicPlayApi.joinTable(draftId);
      navigate(`/draft/${draftId}`);
    } catch (err) {
      toast({ title: "Couldn't join that table", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      setJoining(false);
    }
  };

  if (!info && !error) return <div className="h-24 animate-pulse rounded-lg border border-[#907AFF] bg-[#25015E]" aria-busy="true" />;

  const open = info?.status === 'forming';
  const host = info?.participants.find((p) => p.is_host)?.name;
  const seatsOpen = info ? Math.max(info.table_size - info.participants.length, 0) : 0;

  return (
    <section aria-label="Table invitation" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#907AFF] bg-[#25015E] p-5">
      {error || !info ? (
        <p className="m-0 font-brockmann text-sm text-white">{error}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-brockmann text-lg font-semibold text-white">You've been invited to “{info.title}”</h2>
            <p className="m-0 font-brockmann text-sm text-[#E4DBFF]">
              {host ? `Hosted by ${host} · ` : ''}{describeClock(info.pick_clock_seconds)} per pick · {seatsOpen} {seatsOpen === 1 ? 'seat' : 'seats'} open
              {info.scheduled_start_at ? ` · starts ${formatWhen(info.scheduled_start_at)}` : ''}
            </p>
            {!open && <p className="m-0 font-brockmann text-sm text-[#FFD60A]">This table has already started or was cancelled.</p>}
          </div>
          {info.i_joined ? (
            <Button onClick={() => navigate(`/draft/${draftId}`)} className="bg-[#FFD60A] font-semibold text-black hover:bg-[#FFE55C]">Open table</Button>
          ) : (
            <Button onClick={() => void join()} disabled={!open || joining || seatsOpen === 0} className="bg-[#FFD60A] font-semibold text-black hover:bg-[#FFE55C] disabled:opacity-50">
              {seatsOpen === 0 && open ? 'Table full' : joining ? 'Joining…' : 'Join table'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
