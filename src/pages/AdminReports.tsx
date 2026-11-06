import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { publicPlayApi, type AdminReport } from '@/lib/publicPlayApi';
import { REPORT_REASONS } from '@/config/publicPlay';

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** Review queue for player reports (public play). Admin account only; enforced in the database too. */
const AdminReports = () => {
  const { isAdmin, loading } = useAdminAccess();
  const { toast } = useToast();
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await publicPlayApi.adminReports(status === 'open' ? 'open' : null));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.');
    }
  }, [status]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const resolve = async (r: AdminReport, action: 'dismissed' | 'warned' | 'banned', days: number | null) => {
    setBusy(r.id + action);
    try {
      await publicPlayApi.adminResolve(r.id, action, days);
      toast({ title: action === 'banned' ? 'Player banned' : action === 'warned' ? 'Marked as warned' : 'Report dismissed' });
      await load();
    } catch (err) {
      toast({ title: "Couldn't update the report", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const unban = async (userId: string) => {
    try {
      await publicPlayApi.adminUnban(userId);
      toast({ title: 'Player unbanned' });
      await load();
    } catch (err) {
      toast({ title: "Couldn't unban", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[560px] px-6 py-20 text-center font-brockmann text-greyscale-blue-100">
        <h1 className="font-chaney text-3xl">Admins only</h1>
        <p><Link to="/" className="underline">Back to the home page</Link></p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Player reports | Movie Drafter admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen w-full px-6 py-10" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <div className="mx-auto flex max-w-[900px] flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="m-0 font-chaney text-3xl font-normal text-greyscale-blue-100">Player reports</h1>
            <div className="flex gap-2">
              <Button variant={status === 'open' ? 'default' : 'outline'} onClick={() => setStatus('open')} className={status === 'open' ? 'bg-[#680AFF] text-white' : 'border-[#49474B] bg-transparent text-white'}>Open</Button>
              <Button variant={status === 'all' ? 'default' : 'outline'} onClick={() => setStatus('all')} className={status === 'all' ? 'bg-[#680AFF] text-white' : 'border-[#49474B] bg-transparent text-white'}>All</Button>
            </div>
          </div>

          {error && <p role="alert" className="m-0 font-brockmann text-sm text-[#FF8A8A]">{error}</p>}
          {rows === null && !error && <div className="h-32 animate-pulse rounded-lg border border-[#49474B] bg-[#0E0E0F]" aria-busy="true" />}
          {rows && rows.length === 0 && <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">{status === 'open' ? 'No open reports. Nice and quiet.' : 'No reports yet.'}</p>}

          {rows?.map((r) => (
            <article key={r.id} className="flex flex-col gap-3 rounded-lg border border-[#49474B] bg-[#0E0E0F] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-brockmann text-base text-white">
                  <strong>{r.reported_name ?? 'Unknown player'}</strong>
                  <span className="text-[#BDC3C2]"> reported by {r.reporter_name ?? 'a player'}</span>
                </div>
                <span className="rounded bg-[#1D1D1F] px-2 py-1 font-brockmann text-xs text-[#BDC3C2]">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-2 font-brockmann text-xs">
                <span className="rounded bg-[#25015E] px-2 py-1 text-[#C9B8FF]">{reasonLabel(r.reason)}</span>
                <span className="rounded bg-[#1D1D1F] px-2 py-1 text-[#BDC3C2]">{Number(r.reports_against_total)} report{Number(r.reports_against_total) === 1 ? '' : 's'} against this player</span>
                {r.reported_is_banned && <span className="rounded bg-[#3A1212] px-2 py-1 text-[#FF8A8A]">Currently banned</span>}
                <span className="rounded bg-[#1D1D1F] px-2 py-1 text-[#BDC3C2]">Status: {r.status}</span>
              </div>
              {r.details && <p className="m-0 font-brockmann text-sm text-white">“{r.details}”</p>}
              <div className="flex flex-wrap gap-2">
                {r.status === 'open' && (
                  <>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void resolve(r, 'dismissed', null)} className="border-[#49474B] bg-transparent text-white">Dismiss</Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void resolve(r, 'warned', null)} className="border-[#49474B] bg-transparent text-white">Warn</Button>
                    <Button size="sm" disabled={!!busy} onClick={() => void resolve(r, 'banned', 7)} className="bg-[#B3261E] hover:bg-[#CE3B33] text-white">Ban 7 days</Button>
                    <Button size="sm" disabled={!!busy} onClick={() => void resolve(r, 'banned', null)} className="bg-[#B3261E] hover:bg-[#CE3B33] text-white">Ban permanently</Button>
                  </>
                )}
                {r.reported_is_banned && (
                  <Button size="sm" variant="outline" onClick={() => void unban(r.reported_id)} className="border-[#49474B] bg-transparent text-white">Unban player</Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
};

export default AdminReports;
