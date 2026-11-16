import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePublicPlay } from '@/hooks/usePublicPlay';
import { useQuickPlay } from '@/hooks/useQuickPlay';
import { publicPlayApi, type MyTableRow } from '@/lib/publicPlayApi';
import { PublicNameForm } from '@/components/play/PublicNameForm';
import { OpenDraftsBrowser } from '@/components/play/OpenDraftsBrowser';
import { useOpenGames } from '@/components/home/OpenGamesList';
import { GuestPlayHub } from '@/components/play/GuestPlayHub';
import { useSignInPrompt } from '@/components/play/SignInPrompt';
import { LeaderboardPanel } from '@/components/play/LeaderboardPanel';
import { InviteLinkCard } from '@/components/play/InviteLinkCard';
import { formatWhen } from '@/config/publicPlay';

const PAGE_BG = 'linear-gradient(152deg, #100029 16%, #160038 50%, #100029 83%)';

const panel = 'mx-auto w-full max-w-[640px] rounded-xl border border-[#49474B] bg-[#1D1D1F] p-8 text-center flex flex-col items-center gap-3';

const primaryButton =
  'h-auto rounded-[2px] bg-[#7142FF] px-[18px] py-3 font-brockmann text-base font-semibold leading-6 tracking-[0.32px] text-[#FCFFFF] hover:bg-[#5e32e0]';

/** One half of the pill-shaped tab switch: dark when idle, brand purple when selected. */
const tabTrigger =
  'rounded-none bg-[#1D1D1F] px-4 py-3 text-sm sm:px-6 font-medium leading-5 text-[#FCFFFF] shadow-none data-[state=active]:bg-[#7142FF] data-[state=active]:text-[#FCFFFF] data-[state=active]:shadow-none';

function MyTables() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MyTableRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    publicPlayApi.myTables().then((r) => !cancelled && setRows(r)).catch(() => !cancelled && setRows([]));
    return () => { cancelled = true; };
  }, []);

  if (rows === null) return <div className="h-24 animate-pulse rounded-xl border border-[#49474B] bg-[#1D1D1F]" aria-busy="true" />;
  if (rows.length === 0) {
    return <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">You're not in any public draft right now. Join one from "Open Drafts".</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((t) => (
        <li key={t.draft_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#49474B] bg-[#1D1D1F] p-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-brockmann text-base font-semibold text-white">{t.title}</span>
            <span className="font-brockmann text-xs text-[#BDC3C2]">
              {t.status === 'active' ? 'Draft in progress' : t.scheduled_start_at ? `Starts ${formatWhen(t.scheduled_start_at)}` : 'Waiting for the host to start'}
              {t.i_am_host ? ' · You are the host' : ''} · {t.speed === 'live' ? 'Live' : 'Slow'}
            </span>
          </div>
          <Button onClick={() => navigate(`/draft/${t.draft_id}`)} className="rounded-[2px] bg-[#7142FF] font-semibold text-white hover:bg-[#5e32e0]">
            Open
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Shown until the page has everything it needs, so nothing flickers in piece by piece. */
function LoadingScreen({ message }: { message: string }) {
  return (
    <>
      <Helmet>
        <title>Play with others | Movie Drafter</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex min-h-screen w-full items-center justify-center" style={{ background: PAGE_BG }}>
        <div role="status" className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#907AFF]" aria-hidden />
          <p className="m-0 font-brockmann text-base text-greyscale-blue-100">{message}</p>
        </div>
      </div>
    </>
  );
}

interface PlayHeaderProps {
  /** What the Quick Play button does; null hides it (public play isn't open to this visitor right now). */
  onQuickPlay: (() => void) | null;
  quickBusy: boolean;
  /** Goes to the draft setup pages (where a draft can be opened to the public); null hides the button. */
  onSetUp: (() => void) | null;
}

/** Page heading, one line about what you can do here, and the Quick Play (and Host a Draft) buttons. */
function PlayHeader({ onQuickPlay, quickBusy, onSetUp }: PlayHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4 p-6">
      <div className="flex min-w-[260px] flex-1 flex-col items-start gap-4">
        <h1 className="m-0 font-chaney text-4xl font-normal uppercase leading-none text-[#FAFEFF] md:text-5xl">Play now online</h1>
        <p className="m-0 max-w-[560px] font-brockmann text-base font-medium leading-6 text-[#FAFEFF]">
          Join an open draft or host your own. Pick how fast you want to play: live or asynchronous.
        </p>
      </div>
      {(onQuickPlay || onSetUp) && (
        <div className="flex flex-wrap items-center gap-3">
          {onSetUp && (
            <Button
              variant="outline"
              onClick={onSetUp}
              className="h-auto rounded-[2px] border-[#BDC3C2]/50 bg-transparent px-[18px] py-3 font-brockmann text-base font-semibold leading-6 tracking-[0.32px] text-[#FCFFFF] hover:bg-[#1D1D1F] hover:text-[#FCFFFF]"
            >
              Set Up Draft
            </Button>
          )}
          {onQuickPlay && (
            <Button onClick={onQuickPlay} disabled={quickBusy} className={primaryButton}>
              {quickBusy ? 'Finding a game…' : 'Quick Play'}
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

/**
 * Play hub: browse and join open drafts, or host your own.
 * Public play is switched on or off in the database (admin-only at first), so this page
 * shows the right message for each situation.
 */
const Play = () => {
  const { status, loading, installed, refresh } = usePublicPlay();
  // Loaded here, alongside the status, so the page can wait for both before it shows anything.
  const { games, reload: reloadGames } = useOpenGames(50);
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
  const { quickPlay, busy: quickBusy } = useQuickPlay();
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
  // Setting up a public draft happens on the normal draft setup pages (pick the draft, then "Open to the public"),
  // not in a pop-up window.
  const navigate = useNavigate();
  const onSetUp = useCallback(() => navigate('/draft'), [navigate]);

  // The header's Quick Play button: plays for a ready player, asks a guest to sign in, and is hidden otherwise.
  const isGuest = !loading && installed && !!status && !status.signed_in && status.available;
  const onQuickPlay = canQuickPlay
    ? () => void quickPlay()
    : isGuest
      ? () => signIn.ask({ reason: 'quick-play', returnTo: '/play?quick=play' })
      : null;

  let body: React.ReactNode;
  if (loading) {
    body = null; // the loading screen is shown instead (below)
  } else if (!installed || !status) {
    body = (
      <div className={panel}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">Public play isn't set up yet</h2>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">Check back soon.</p>
      </div>
    );
  } else if (!status.signed_in && status.available) {
    // A guest: show them everything (Quick Play and the open drafts) as a reason to sign up.
    body = <GuestPlayHub games={games} reload={reloadGames} inviteTable={inviteTable} ask={signIn.ask} />;
  } else if (!status.signed_in) {
    // Public play isn't open to everyone yet (the admin may be signed out): signing in is the way forward.
    body = (
      <div className={panel}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">Sign in to play with others</h2>
        <p className="m-0 font-brockmann text-sm text-[#BDC3C2]">You need an account to join or host public drafts.</p>
        <Button className="rounded-[2px] bg-[#7142FF] font-semibold text-white hover:bg-[#5e32e0]" onClick={() => signIn.ask({ reason: 'general', returnTo: '/play' })}>Sign in</Button>
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
        <Button asChild variant="outline" className="rounded-[2px] border-[#BDC3C2]/50 bg-transparent text-white hover:bg-[#1D1D1F] hover:text-white"><Link to="/draft">Start a private draft</Link></Button>
      </div>
    );
  } else if (!status.has_public_name) {
    body = (
      <div className="mx-auto w-full max-w-[640px]">
        <PublicNameForm reason={status.name_reason} onSaved={() => void refresh()} />
      </div>
    );
  } else {
    body = (
      <>
        {inviteTable && (
          <div className="w-full max-w-[1000px]">
            <InviteLinkCard draftId={inviteTable} />
          </div>
        )}

        <Tabs defaultValue="open" className="flex w-full flex-col gap-[18px]">
          <TabsList className="h-auto w-fit gap-px overflow-hidden rounded-full border border-[#49474B] bg-[#49474B] p-0">
            <TabsTrigger value="open" className={tabTrigger}>Open Drafts</TabsTrigger>
            <TabsTrigger value="mine" className={tabTrigger}>My Drafts</TabsTrigger>
            <TabsTrigger value="leaderboard" className={tabTrigger}>Leaderboard</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-0">
            <OpenDraftsBrowser games={games} reload={reloadGames} canJoinHere onSetUpClick={onSetUp} />
          </TabsContent>
          <TabsContent value="mine" className="mt-0">
            <MyTables />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-0">
            <LeaderboardPanel />
          </TabsContent>
        </Tabs>
      </>
    );
  }

  if (findingGame) return <LoadingScreen message="Finding a game…" />;

  // Hold the loading screen until the status is known and, when the Open Drafts list is going to be on the page
  // (a guest or a ready player), until that list has arrived too. Otherwise the header, tabs, skeleton cards and
  // the real cards each pop in one after another.
  const showsDraftList = isGuest || canQuickPlay;
  if (loading || (showsDraftList && games === null)) return <LoadingScreen message="Loading…" />;

  return (
    <>
      <Helmet>
        <title>Play with others | Movie Drafter</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen w-full pb-24 pt-14 lg:pb-[236px]" style={{ background: PAGE_BG }}>
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
          <PlayHeader
            onQuickPlay={onQuickPlay}
            quickBusy={quickBusy}
            onSetUp={canQuickPlay ? onSetUp : null}
          />
          <div className="flex flex-col gap-6 px-6 pb-16">{body}</div>
        </div>
        {signIn.prompt}
      </div>
    </>
  );
};

export default Play;
