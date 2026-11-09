import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePublicPlay } from '@/hooks/usePublicPlay';
import { useQuickPlay } from '@/hooks/useQuickPlay';
import { publicPlayApi, type MyTableRow } from '@/lib/publicPlayApi';
import { PublicNameForm } from '@/components/play/PublicNameForm';
import { OpenTablesBrowser } from '@/components/play/OpenTablesBrowser';
import { CreateTableDialog } from '@/components/play/CreateTableDialog';
import { PublicPlayAdminSwitch } from '@/components/play/PublicPlayAdminSwitch';
import { QuickPlayCard } from '@/components/play/QuickPlayCard';
import { GuestPlayHub } from '@/components/play/GuestPlayHub';
import { useSignInPrompt } from '@/components/play/SignInPrompt';
import { LeaderboardPanel } from '@/components/play/LeaderboardPanel';
import { InviteLinkCard } from '@/components/play/InviteLinkCard';
import { formatWhen } from '@/config/publicPlay';

const panel = 'mx-auto w-full max-w-[640px] rounded-lg border border-[#49474B] bg-[#0E0E0F] p-8 text-center flex flex-col items-center gap-3';

function MyTables() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MyTableRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    publicPlayApi.myTables().then((r) => !cancelled && setRows(r)).catch(() => !cancelled && setRows([]));
    return () => { cancelled = true; };
  }, []);

  if (rows === null) return <div className="h-24 rounded-lg bg-[#0E0E0F] border border-[#49474B] animate-pulse" aria-busy="true" />;
  if (rows.length === 0) {
    return <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">You're not at any public table right now. Join one from "Open tables".</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((t) => (
        <li key={t.draft_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#49474B] bg-[#0E0E0F] p-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-brockmann text-base font-semibold text-white">{t.title}</span>
            <span className="font-brockmann text-xs text-[#BDC3C2]">
              {t.status === 'active' ? 'Draft in progress' : t.scheduled_start_at ? `Starts ${formatWhen(t.scheduled_start_at)}` : 'Waiting for the host to start'}
              {t.i_am_host ? ' · You are the host' : ''} · {t.speed === 'live' ? 'Live' : 'Slow'}
            </span>
          </div>
          <Button onClick={() => navigate(`/draft/${t.draft_id}`)} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">Open</Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Play hub: browse and join open tables, or host your own.
 * Public play is switched on or off in the database (admin-only at first), so this page
 * shows the right message for each situation.
 */
const Play = () => {
  const { status, loading, installed, refresh } = usePublicPlay();
  const signIn = useSignInPrompt();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawInvite = searchParams.get('join');
  // An invite link looks like /play?join=<table id>; ignore anything that isn't a plausible id.
  const inviteTable = rawInvite && /^[0-9a-f-]{36}$/i.test(rawInvite) ? rawInvite : null;
  // The homepage's Quick Play button sends people here as /play?quick=play when they still have to sign in or
  // choose a name; once they're ready Quick Play runs by itself. (The older ?quick=join and ?quick=start links
  // do the same thing.) Whoever arrives this way is on their way to a lobby, so they see "Finding a game" until
  // they are there, never the Play hub for a moment first. If it can't go ahead (a name is needed, or it fails)
  // the hub is shown as usual.
  const rawQuick = searchParams.get('quick');
  const clearQuickParam = useCallback(() => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.delete('quick');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const { quickPlay } = useQuickPlay();
  // Decided once, on arrival: clearing the address a moment later must not bring the hub back.
  const [arriving, setArriving] = useState(rawQuick === 'play' || rawQuick === 'join' || rawQuick === 'start');
  const quickStarted = useRef(false);
  const canQuickPlay = !loading && installed && !!status && status.signed_in && status.available && !status.banned && status.has_public_name;
  useEffect(() => {
    if (!arriving || !canQuickPlay || quickStarted.current) return;
    quickStarted.current = true;
    clearQuickParam();
    void quickPlay().then((went) => {
      if (!went) setArriving(false);
    });
  }, [arriving, canQuickPlay, clearQuickParam, quickPlay]);
  const findingGame = arriving && (loading || canQuickPlay);
  const [creating, setCreating] = useState(false);
  const [changingName, setChangingName] = useState(false);
  const [listKey, setListKey] = useState(0);
  const onHost = useCallback(() => setCreating(true), []);

  let body: React.ReactNode;
  if (loading) {
    body = <div className="mx-auto h-40 w-full max-w-[640px] animate-pulse rounded-lg border border-[#49474B] bg-[#0E0E0F]" aria-busy="true" />;
  } else if (!installed || !status) {
    body = (
      <div className={panel}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">Public play isn't set up yet</h2>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">Check back soon.</p>
      </div>
    );
  } else if (!status.signed_in && status.available) {
    // A guest: show them everything (Quick Play and the open games) as a reason to sign up.
    body = <GuestPlayHub inviteTable={inviteTable} ask={signIn.ask} />;
  } else if (!status.signed_in) {
    // Public play isn't open to everyone yet (the admin may be signed out): signing in is the way forward.
    body = (
      <div className={panel}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">Sign in to play with others</h2>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">You need an account to join or host public tables.</p>
        <Button className="bg-[#680AFF] hover:bg-[#794DFF] text-white" onClick={() => signIn.ask({ reason: 'general', returnTo: '/play' })}>Sign in</Button>
      </div>
    );
  } else if (status.banned) {
    body = (
      <div className={panel}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">Public play is unavailable on your account</h2>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">
          {status.banned_until ? `You can come back after ${formatWhen(status.banned_until)}.` : 'Contact us if you think this is a mistake.'}
        </p>
      </div>
    );
  } else if (!status.available) {
    body = (
      <div className={panel}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">Public play isn't open yet</h2>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">We're getting it ready. In the meantime you can still draft with friends.</p>
        <Button asChild variant="outline" className="border-[#49474B] bg-transparent text-white"><Link to="/draft">Start a private draft</Link></Button>
      </div>
    );
  } else if (!status.has_public_name) {
    body = <PublicNameForm reason={status.name_reason} onSaved={() => void refresh()} />;
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">
            Playing as <strong className="text-white">{status.public_name}</strong>
            {' · '}
            <button type="button" onClick={() => setChangingName(true)} className="bg-transparent p-0 font-brockmann text-sm text-[#BCB2FF] underline hover:text-white">
              Change name
            </button>
          </p>
          <Button onClick={onHost} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">
            <Plus size={16} className="mr-1.5" aria-hidden />Host a table
          </Button>
        </div>

        {changingName && (
          <PublicNameForm
            currentName={status.public_name}
            onCancel={() => setChangingName(false)}
            onSaved={() => {
              setChangingName(false);
              void refresh();
            }}
          />
        )}

        {inviteTable && <InviteLinkCard draftId={inviteTable} />}

        <QuickPlayCard />

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="bg-[#1D1D1F]">
            <TabsTrigger value="open">Open tables</TabsTrigger>
            <TabsTrigger value="mine">My tables</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4">
            <OpenTablesBrowser refreshKey={listKey} onHostClick={onHost} />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MyTables />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-4">
            <LeaderboardPanel />
          </TabsContent>
        </Tabs>

        <CreateTableDialog
          open={creating}
          onOpenChange={(o) => {
            setCreating(o);
            if (!o) setListKey((k) => k + 1);
          }}
        />
      </>
    );
  }

  if (findingGame) {
    return (
      <>
        <Helmet>
          <title>Play with others | Movie Drafter</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div
          className="flex min-h-screen w-full items-center justify-center"
          style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}
        >
          <div role="status" className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-[#907AFF]" aria-hidden />
            <p className="m-0 font-brockmann text-base text-greyscale-blue-100">Finding a game…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Play with others | Movie Drafter</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen w-full" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <section className="w-full px-6 pt-14 pb-6">
          <div className="mx-auto flex max-w-[768px] flex-col items-center gap-4 text-center">
            <h1 className="m-0 font-chaney text-4xl font-normal leading-tight text-greyscale-blue-100 md:text-5xl">Play with others</h1>
            <p className="m-0 max-w-[560px] font-brockmann text-sm font-medium leading-relaxed text-greyscale-blue-100 md:text-base">
              Join an open table or host your own. Pick how fast you want to play: live, or one pick at a time over hours.
            </p>
          </div>
        </section>
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-6 pb-16">
          {status?.is_admin && installed && <PublicPlayAdminSwitch mode={status.mode} onChanged={() => void refresh()} />}
          {body}
        </div>
        {signIn.prompt}
      </div>
    </>
  );
};

export default Play;
