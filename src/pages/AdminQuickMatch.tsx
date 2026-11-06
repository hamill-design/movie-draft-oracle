import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { publicPlayApi, type QuickPoolEntry } from '@/lib/publicPlayApi';

const KINDS: { kind: QuickPoolEntry['kind']; title: string; hint: string }[] = [
  { kind: 'year', title: 'Years', hint: 'The 50 most recent full years. Draft by Year.' },
  { kind: 'actor', title: 'Actors', hint: "Draft by Filmography. Edit this list to the actors you'd like in rotation." },
  { kind: 'spec', title: 'Special drafts', hint: 'Your themed lists. Only enable ones with plenty of movies in every category.' },
];

/**
 * Approve what Quick Match can use. Nothing is used until you switch it on. Each match is a random
 * draft from the switched-on entries (an equal chance for years, actors and special drafts).
 */
const AdminQuickMatch = () => {
  const { isAdmin, loading } = useAdminAccess();
  const { toast } = useToast();
  const [rows, setRows] = useState<QuickPoolEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await publicPlayApi.adminQuickPool());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the pool.');
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const act = async (fn: () => Promise<unknown>, okTitle: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: okTitle });
      await load();
    } catch (err) {
      toast({ title: "That didn't work", description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const byKind = useMemo(() => {
    const m: Record<string, QuickPoolEntry[]> = { year: [], actor: [], spec: [] };
    (rows ?? []).forEach((r) => m[r.kind]?.push(r));
    return m;
  }, [rows]);
  const enabledTotal = (rows ?? []).filter((r) => r.enabled).length;

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
        <title>Quick Match pool | Movie Drafter admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen w-full px-6 py-10" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <div className="mx-auto flex max-w-[900px] flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="m-0 font-chaney text-3xl font-normal text-greyscale-blue-100">Quick Match pool</h1>
              <p className="m-0 mt-1 font-brockmann text-sm text-[#BDC3C2]">
                {enabledTotal === 0
                  ? 'Nothing is switched on, so Quick Match is hidden from players.'
                  : `${enabledTotal} switched on. Each match is a random pick, an equal chance for years, actors and special drafts.`}
              </p>
            </div>
            <Button variant="outline" disabled={busy} onClick={() => void act(async () => {
              const n = await publicPlayApi.adminSyncQuickPool();
              toast({ title: n > 0 ? `Added ${n} new entries` : 'Already up to date' });
            }, 'Synced')} className="border-[#49474B] bg-transparent text-white">
              Sync years and special drafts
            </Button>
          </div>

          <p className="m-0 rounded border border-[#49474B] bg-[#0E0E0F] p-4 font-brockmann text-sm text-[#BDC3C2]">
            Before switching an entry on, make sure it has enough movies for 4 players in every category (5 categories by default).
            A year or actor with a thin catalogue makes a poor match.
          </p>

          {error && <p role="alert" className="m-0 font-brockmann text-sm text-[#FF8A8A]">{error}</p>}
          {rows === null && !error && <div className="h-32 animate-pulse rounded-lg border border-[#49474B] bg-[#0E0E0F]" aria-busy="true" />}

          {rows && KINDS.map(({ kind, title, hint }) => {
            const list = byKind[kind] ?? [];
            const on = list.filter((r) => r.enabled).length;
            return (
              <section key={kind} className="flex flex-col gap-3 rounded-lg border border-[#49474B] bg-[#0E0E0F] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="m-0 font-brockmann text-lg font-medium text-white">{title} <span className="text-sm text-[#BDC3C2]">({on} of {list.length} on)</span></h2>
                    <p className="m-0 font-brockmann text-xs text-[#BDC3C2]">{hint}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => publicPlayApi.adminSetQuickKindEnabled(kind, true), `All ${title.toLowerCase()} switched on`)} className="border-[#49474B] bg-transparent text-white">Switch all on</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => publicPlayApi.adminSetQuickKindEnabled(kind, false), `All ${title.toLowerCase()} switched off`)} className="border-[#49474B] bg-transparent text-white">All off</Button>
                  </div>
                </div>

                {kind === 'actor' && (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (actor.trim().length < 3) return;
                      void act(async () => { await publicPlayApi.adminAddQuickActor(actor.trim()); setActor(''); }, 'Actor added (switched off)');
                    }}
                  >
                    <label htmlFor="add-actor" className="sr-only">Add an actor</label>
                    <Input id="add-actor" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Add an actor, e.g. Sidney Poitier" className="max-w-[320px] border-[#49474B] bg-[#1D1D1F] text-white" />
                    <Button type="submit" disabled={busy || actor.trim().length < 3} className="bg-[#680AFF] text-white hover:bg-[#794DFF]">Add</Button>
                  </form>
                )}

                {list.length === 0 && <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">Nothing here yet.</p>}
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 rounded bg-[#1D1D1F] px-3 py-2">
                      <label htmlFor={`pool-${r.id}`} className="min-w-0 flex-1 truncate font-brockmann text-sm text-white" title={r.label}>{r.label}</label>
                      <div className="flex items-center gap-2">
                        {kind === 'actor' && (
                          <button type="button" aria-label={`Remove ${r.label}`} disabled={busy} onClick={() => void act(() => publicPlayApi.adminRemoveQuickEntry(r.id), 'Removed')} className="font-brockmann text-xs text-[#BDC3C2] underline">Remove</button>
                        )}
                        <Switch id={`pool-${r.id}`} checked={r.enabled} disabled={busy} onCheckedChange={(v) => void act(() => publicPlayApi.adminSetQuickEnabled(r.id, v), v ? 'Switched on' : 'Switched off')} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default AdminQuickMatch;
