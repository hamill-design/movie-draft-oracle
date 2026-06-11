import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Settings, Film, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useLeague, useLeagueMembers, useLeagueStandings, useLeagueSeasonStandings,
  useLeagueDrafts, useLeagueSeasons, useLeagueActions, usePendingLeagueInvites,
  type LeagueStanding, type LeagueDraftEntry,
} from '@/hooks/useLeagues';
import LeagueStandingsChart from '@/components/league/LeagueStandingsChart';
import LeagueMessageBoard from '@/components/league/LeagueMessageBoard';
import { LeagueDraftCard } from '@/components/league/LeagueDraftCard';
import { LeagueUpcomingDraftCard } from '@/components/league/LeagueUpcomingDraftCard';
import { ScheduledDraftDetailModal } from '@/components/league/ScheduledDraftDetailModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MOVIE_DRAFTER_PURPLE_SHELL } from '@/lib/pageGradients';
import { cn, getCleanActorName } from '@/lib/utils';
import leagueTrophyIllustration from '@/assets/illustrations/illus/league-trophy.svg';
import { supabase } from '@/integrations/supabase/client';
import {
  buildLeagueDraftMetrics,
  draftPlacementRank,
  draftLeaguePointsByUserId,
  tieRanksForStandings,
  type LeagueDraftMetricPack,
  type DraftParticipantRow,
} from '@/lib/leagueDraftMetrics';
import { HomeDraftSection } from '@/components/home/HomeDraftSection';

const DRAFT_TYPE_LABELS: Record<string, string> = {
  classic: 'Classic', year: 'By Year', people: 'By Filmmaker',
  'spec-draft': 'Special Draft', filmography: 'By Filmography',
};

/** Schedule tab card title — matches Profile drafts: name/theme only, no "By Filmography ·" prefix. */
function upcomingScheduledHeadline(
  entry: LeagueDraftEntry,
  specMeta: { name: string; photo_url: string | null } | undefined,
): string {
  const t = entry.draft_type;
  if (t === 'spec-draft') return specMeta?.name ?? 'Special draft';
  if (t === 'filmography' || t === 'people') {
    const name = getCleanActorName(entry.theme ?? '');
    return name || entry.theme?.trim() || 'Draft';
  }
  if (t === 'year') {
    const y = entry.theme?.trim();
    return y || 'Draft';
  }
  if (entry.theme?.trim()) return entry.theme.trim();
  return DRAFT_TYPE_LABELS[t ?? ''] ?? 'Draft';
}

type MainTab = 'standings' | 'drafts' | 'schedule';

const MAIN_TABS: readonly MainTab[] = ['standings', 'drafts', 'schedule'];

function isMainTab(value: string | null): value is MainTab {
  return !!value && (MAIN_TABS as readonly string[]).includes(value);
}

/** Matches FinalScores pill tabs: gap-px separators, single outer border — avoids uneven inner outlines on rounded hull. */
const LEAGUE_MAIN_TAB_SEGMENT_CLASS =
  'min-w-0 flex-1 shrink basis-0 md:min-w-[127px] md:w-[127px] md:max-w-[127px] md:shrink-0 md:grow-0 md:basis-[127px]';
const LEAGUE_MAIN_TAB_BUTTON_CLASS =
  'min-h-0 rounded-none border-0 px-6 py-3 font-brockmann text-sm font-medium leading-5 text-[var(--Text-Primary,#FCFFFF)] shadow-none ring-0 ring-offset-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#7142FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E0F]';

// ── Standing row (dashboard spec) ─────────────────────────────────────────────
const StandingRow: React.FC<{ s: LeagueStanding; rank: number; isYou?: boolean }> = ({
  s, rank: r, isYou,
}) => {
  // total_score = F1 position points (integer); raw_score = movie score tiebreaker
  const scoreStr = String(s.total_score);
  const subline =
    `${s.draft_count} ${s.draft_count === 1 ? 'draft' : 'drafts'} · ${s.raw_score.toFixed(1)} movie score`;

  let rankBadge: React.ReactNode;

  if (r === 1) {
    rankBadge = (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFD60A] text-base font-bold leading-6 text-[#1D1D1F] outline outline-2 -outline-offset-2 outline-[#FFF2B2] font-brockmann tabular-nums"
        aria-hidden
      >
        {r}
      </div>
    );
  } else if (r === 2) {
    rankBadge = (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#CCCCCC] text-base font-bold leading-6 text-[#1D1D1F] outline outline-2 -outline-offset-2 outline-[#E5E5E5] font-brockmann tabular-nums"
        aria-hidden
      >
        {r}
      </div>
    );
  } else if (r === 3) {
    rankBadge = (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#DE7E3E] text-base font-bold leading-6 text-[#1D1D1F] outline outline-2 -outline-offset-2 outline-[#FFAE78] font-brockmann tabular-nums"
        aria-hidden
      >
        {r}
      </div>
    );
  } else {
    rankBadge = (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#907AFF] text-base font-bold leading-6 text-[#0E0F0F] font-brockmann tabular-nums"
        aria-hidden
      >
        {r}
      </div>
    );
  }

  const nameClass = 'text-base font-semibold leading-6 tracking-[0.32px] text-greyscale-blue-100 font-brockmann m-0';
  const subClass = 'text-sm font-normal leading-5 font-brockmann m-0 text-[#BDC3C2]';
  const scoreClass = 'text-[32px] font-bold leading-9 tracking-wide tabular-nums font-brockmann m-0 text-[#907AFF]';

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg py-4 pl-4 pr-6',
        isYou
          ? 'bg-[#160038] outline outline-2 -outline-offset-1 outline-[#907AFF]'
          : 'bg-[#1D1D1F] outline outline-1 -outline-offset-1 outline-[#49474B]',
      )}
    >
      {rankBadge}
      <div className="min-w-0 flex-1 pb-0.5">
        <p className={`${nameClass} truncate`}>
          {s.display_name ?? 'Unknown'}
        </p>
        <p className={subClass}>{subline}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={scoreClass}>{scoreStr}</p>
        <p className="text-xs font-brockmann m-0 text-greyscale-blue-400">
          pts
        </p>
      </div>
    </div>
  );
};

const SeasonStandingRows: React.FC<{
  standings: LeagueStanding[];
  currentUserId?: string;
}> = ({ standings, currentUserId }) => {
  const tieRanks = useMemo(() => tieRanksForStandings(standings), [standings]);

  if (!standings.length) {
    return (
      <div className="space-y-2 py-12 text-center">
        <p className="m-0 text-sm font-brockmann text-greyscale-blue-300">No scores yet.</p>
        <p className="m-0 text-xs font-brockmann text-greyscale-blue-400">
          Add completed drafts to start tracking standings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {standings.map((s, i) => (
        <StandingRow
          key={s.user_id}
          s={s}
          rank={tieRanks[i]}
          isYou={s.user_id === currentUserId}
        />
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const LeaguePage = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const { league, loading: leagueLoading } = useLeague(leagueId);
  const { members } = useLeagueMembers(leagueId);
  const { seasons, activeSeason } = useLeagueSeasons(leagueId);
  const { drafts, loading: draftsLoading } = useLeagueDrafts(leagueId);
  const { removeScheduledDraft, acceptInvite, declineInvite } = useLeagueActions();
  const { invites: pendingInvites, loading: invitesLoading } = usePendingLeagueInvites();

  const [mainTab, setMainTab] = useState<MainTab>(() => {
    const initialTab = searchParams.get('tab');
    return isMainTab(initialTab) ? initialTab : 'standings';
  });
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all-time');
  const [showNewDraftFlow, setShowNewDraftFlow] = useState(false);

  /** Pending invite for this league, if the current user hasn't joined yet */
  const myInvite = useMemo(
    () => pendingInvites.find(inv => inv.league_id === leagueId) ?? null,
    [pendingInvites, leagueId],
  );
  const [inviteActionLoading, setInviteActionLoading] = useState<'accept' | 'decline' | null>(null);

  // ── Scheduled draft detail modal ──────────────────────────────────────────
  const [detailModalEntry, setDetailModalEntry] = useState<LeagueDraftEntry | null>(null);

  /** Entry ID currently being opened as a draft room (shows loading state on button) */
  const [openingDraftId, setOpeningDraftId] = useState<string | null>(null);

  /** Entry pending admin delete confirmation */
  const [entryToDelete, setEntryToDelete] = useState<LeagueDraftEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** One hour threshold — within this window admins can open the draft room */
  const ONE_HOUR_MS = 60 * 60 * 1000;

  useEffect(() => {
    setShowNewDraftFlow(false);
  }, [leagueId]);

  useEffect(() => {
    if (activeSeason && selectedSeasonId === 'all-time') {
      setSelectedSeasonId(activeSeason.id);
    }
  }, [activeSeason?.id]);

  /** Keep selection valid when seasons load/change (e.g. none yet, or current season deleted). */
  useEffect(() => {
    if (seasons.length === 0) {
      if (selectedSeasonId !== 'all-time') setSelectedSeasonId('all-time');
      return;
    }
    if (selectedSeasonId !== 'all-time' && !seasons.some(s => s.id === selectedSeasonId)) {
      setSelectedSeasonId(activeSeason?.id ?? 'all-time');
    }
  }, [seasons, selectedSeasonId, activeSeason?.id]);

  const effectiveSeasonId = selectedSeasonId === 'all-time' ? undefined : selectedSeasonId;

  const { standings: allTimeStandings, loading: allTimeLoading } = useLeagueStandings(
    effectiveSeasonId ? undefined : leagueId,
  );
  const { standings: seasonStandings, loading: seasonLoading } = useLeagueSeasonStandings(
    leagueId, effectiveSeasonId,
  );

  const standings = effectiveSeasonId ? seasonStandings : allTimeStandings;
  const standingsLoading = effectiveSeasonId ? seasonLoading : allTimeLoading;

  const isAdmin = league?.admin_id === user?.id;

  // ── Open draft room (admin only, within 1hr of scheduled time) ────────────
  // Calls the RPC which creates the draft and pre-joins ALL selected members
  // into draft_participants. Admin then navigates to /draft/:id (the lobby).
  // Members on the league page get a realtime refresh via useLeagueDrafts and
  // see the card change to "Join Draft" → /draft/:id.
  const handleOpenDraftRoom = useCallback(
    async (entry: LeagueDraftEntry) => {
      if (openingDraftId) return;
      setOpeningDraftId(entry.id);
      try {
        const { data: draftId, error } = await (supabase as any).rpc(
          'start_league_scheduled_draft',
          { p_entry_id: entry.id },
        );
        if (error || !draftId) {
          toast({
            title: 'Could not open draft room',
            description: error?.message ?? 'Something went wrong. Please try again.',
            variant: 'destructive',
          });
          setOpeningDraftId(null);
          return;
        }
        navigate(`/draft/${draftId}`);
      } catch (err: any) {
        toast({
          title: 'Could not open draft room',
          description: err?.message ?? 'Unexpected error.',
          variant: 'destructive',
        });
        setOpeningDraftId(null);
      }
    },
    [openingDraftId, navigate, toast],
  );

  // ── Scheduled draft click handler ─────────────────────────────────────────
  const handleScheduledDraftClick = useCallback(
    (entry: LeagueDraftEntry) => {
      if (!entry.scheduled_at) return;
      const msUntil = new Date(entry.scheduled_at).getTime() - Date.now();
      if (msUntil <= ONE_HOUR_MS) {
        if (isAdmin) {
          handleOpenDraftRoom(entry);
        } else {
          toast({
            title: 'Waiting for the admin',
            description: "The admin will open the draft room. You'll see a \"Join Draft\" button as soon as it's ready.",
          });
        }
      } else {
        // More than an hour away — show detail modal
        setDetailModalEntry(entry);
      }
    },
    [isAdmin, handleOpenDraftRoom, toast],
  );

  const draftInSelectedScope = useCallback(
    (d: LeagueDraftEntry) => {
      if (!effectiveSeasonId) return true;
      return d.season_id === effectiveSeasonId;
    },
    [effectiveSeasonId],
  );

  // Scheduled (upcoming) drafts are always shown regardless of season scope —
  // they are future placeholders and may not have a season_id yet.
  const scheduled = useMemo(
    () => drafts.filter(d => !d.draft_id && d.scheduled_at),
    [drafts],
  );
  const active = useMemo(
    () => drafts.filter(d => d.draft_id && !d.draft?.is_complete).filter(draftInSelectedScope),
    [drafts, draftInSelectedScope],
  );
  const completed = useMemo(
    () => drafts.filter(d => d.draft_id && d.draft?.is_complete).filter(draftInSelectedScope),
    [drafts, draftInSelectedScope],
  );

  const [specDraftData, setSpecDraftData] = useState<Map<string, { name: string; photo_url: string | null }>>(
    () => new Map(),
  );

  const linkedDraftIdsKey = useMemo(
    () =>
      [...new Set(drafts.filter(d => d.draft_id).map(d => d.draft_id as string))]
        .sort()
        .join(','),
    [drafts],
  );

  const [draftPickData, setDraftPickData] = useState<{
    metrics: Record<string, LeagueDraftMetricPack>;
    participants: DraftParticipantRow[];
  } | null>(null);

  useEffect(() => {
    const opts: string[] = [];
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const d of drafts) {
      if (d.draft?.theme === 'spec-draft' && d.draft.option) opts.push(d.draft.option);
      if (!d.draft_id && d.draft_type === 'spec-draft' && d.theme && uuidLike.test(d.theme)) {
        opts.push(d.theme);
      }
    }
    const unique = [...new Set(opts)];
    if (unique.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('spec_drafts').select('id, name, photo_url').in('id', unique);
      if (error || cancelled || !data) return;
      setSpecDraftData(prev => {
        const next = new Map(prev);
        for (const row of data as { id: string; name: string; photo_url: string | null }[]) {
          next.set(row.id, { name: row.name, photo_url: row.photo_url });
        }
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [drafts]);

  useEffect(() => {
    if (!linkedDraftIdsKey) {
      setDraftPickData(null);
      return;
    }
    const ids = linkedDraftIdsKey.split(',').filter(Boolean);
    if (ids.length === 0) {
      setDraftPickData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [picksRes, partsRes] = await Promise.all([
        supabase.from('draft_picks').select('draft_id, calculated_score, player_name').in('draft_id', ids),
        supabase.from('draft_participants').select('draft_id, user_id, participant_name, status').in('draft_id', ids),
      ]);
      if (cancelled) return;
      if (picksRes.error || partsRes.error) {
        setDraftPickData(null);
        return;
      }
      const picks = picksRes.data ?? [];
      const participants = (partsRes.data ?? []) as DraftParticipantRow[];
      const metrics: Record<string, LeagueDraftMetricPack> = {};
      for (const id of ids) {
        metrics[id] = buildLeagueDraftMetrics(id, picks, participants);
      }
      setDraftPickData({ metrics, participants });
    })();
    return () => { cancelled = true; };
  }, [linkedDraftIdsKey]);

  const handleViewLeagueDraft = useCallback(
    (entry: LeagueDraftEntry) => {
      const id = entry.draft_id;
      if (!id) return;
      if (entry.draft?.is_complete) {
        navigate(`/final-scores/${id}`);
      } else {
        navigate(`/draft/${id}`);
      }
    },
    [navigate],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!entryToDelete || deleting) return;
    setDeleting(true);
    const ok = await removeScheduledDraft(entryToDelete.id);
    setDeleting(false);
    setEntryToDelete(null);
    if (!ok) {
      toast({ title: 'Could not remove draft', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  }, [entryToDelete, deleting, removeScheduledDraft, toast]);

  const handleAcceptInvite = useCallback(async () => {
    if (!myInvite || inviteActionLoading) return;
    setInviteActionLoading('accept');
    const acceptedLeagueId = await acceptInvite(myInvite.id);
    if (acceptedLeagueId) {
      // Reload so every membership-gated query (members, drafts, standings,
      // message board, etc.) re-fetches with the user's new access.
      window.location.reload();
      return;
    }
    setInviteActionLoading(null);
    toast({ title: 'Could not accept invite', description: 'Something went wrong. Please try again.', variant: 'destructive' });
  }, [myInvite, inviteActionLoading, acceptInvite, toast]);

  const handleDeclineInvite = useCallback(async () => {
    if (!myInvite || inviteActionLoading) return;
    setInviteActionLoading('decline');
    const ok = await declineInvite(myInvite.id);
    setInviteActionLoading(null);
    if (ok) {
      navigate('/profile');
    } else {
      toast({ title: 'Could not decline invite', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  }, [myInvite, inviteActionLoading, declineInvite, navigate, toast]);

  if (leagueLoading || invitesLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-brockmann"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <p className="text-sm text-greyscale-blue-300">Loading…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 font-brockmann"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <p className="m-0 text-sm text-greyscale-blue-200">League not found.</p>
        <Button variant="outline" onClick={() => navigate('/profile')}>Back to profile</Button>
      </div>
    );
  }

  // ── Invite preview: the user has a pending invite to this league but
  // hasn't joined yet. Show Accept/Decline instead of the full dashboard
  // (most of which would be empty/inaccessible until they're a member).
  const isMember = members.some(m => m.user_id === user?.id);
  if (myInvite && !isMember) {
    return (
      <>
        <Helmet>
          <title>{league.name} — Movie Drafter</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 font-brockmann"
          style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
        >
          <div
            className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[8px] bg-greyscale-purp-900 p-6 text-center"
            style={{ boxShadow: '0px 0px 6px #3B0394', borderLeft: '3px solid #7142FF' }}
          >
            <p className="m-0 font-brockmann text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              League invite
            </p>
            <h1 className="m-0 font-brockmann text-xl font-bold leading-7 tracking-[0.8px] text-greyscale-blue-100">
              {league.name}
            </h1>
            <p className="m-0 font-brockmann text-sm text-greyscale-blue-300">
              {myInvite.inviter?.name ?? 'Someone'} invited you to join this league.
            </p>
            <div className="flex w-full flex-wrap justify-center gap-3 pt-2">
              <Button
                className="bg-brand-primary text-greyscale-blue-100 hover:bg-purple-300 font-brockmann"
                disabled={inviteActionLoading !== null}
                onClick={handleAcceptInvite}
              >
                {inviteActionLoading === 'accept' ? 'Joining…' : 'Accept invite'}
              </Button>
              <Button
                variant="outline"
                className="border-greyscale-purp-500 text-greyscale-blue-300 hover:border-greyscale-blue-300 hover:bg-transparent hover:text-greyscale-blue-100 font-brockmann"
                disabled={inviteActionLoading !== null}
                onClick={handleDeclineInvite}
              >
                {inviteActionLoading === 'decline' ? 'Declining…' : 'Decline'}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="font-brockmann text-greyscale-blue-300 hover:text-greyscale-blue-100"
              onClick={() => navigate('/profile')}
            >
              Back to profile
            </Button>
          </div>
        </div>
      </>
    );
  }

  const standingsHeading = effectiveSeasonId ? 'CURRENT SEASON STANDINGS' : 'ALL-TIME STANDINGS';

  return (
    <>
      <Helmet>
        <title>{league.name} — Movie Drafter</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div
        className="min-h-screen w-full inline-flex flex-col items-center px-3 pt-6 pb-12 font-brockmann md:px-6 md:pt-5"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <div className="flex w-full max-w-[1200px] flex-col items-center gap-6">
          {/* Hero — mobile: trophy absolute left; copy + settings align bottom */}
          <div className="relative w-full px-3 py-6 md:flex md:flex-nowrap md:items-center md:gap-0 md:px-6">
            <div
              className="pointer-events-none absolute -left-8 top-0 h-[118px] w-[124px] opacity-70 mix-blend-screen md:relative md:left-auto md:top-auto md:shrink-0"
              aria-hidden
            >
              <img
                src={leagueTrophyIllustration}
                alt=""
                width={124}
                height={118}
                decoding="async"
                className="h-full w-full object-contain object-center"
              />
            </div>
            <div className="relative flex w-full flex-1 flex-wrap items-end justify-end gap-6 md:-ml-10 md:flex-nowrap md:items-start md:justify-start">
              <div className="flex min-w-0 flex-1 flex-col gap-4 md:min-h-[94px]">
                <h1 className="m-0 font-chaney text-[48px] font-normal leading-[50px] tracking-wide text-greyscale-blue-100">
                  {league.name}
                </h1>
                <p className="m-0 text-xl font-medium leading-7 text-greyscale-blue-100">
                  {members.length} {members.length === 1 ? 'member' : 'members'} · {drafts.length}{' '}
                  {drafts.length === 1 ? 'draft' : 'drafts'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate(`/league/${leagueId}/settings`)}
                  className="inline-flex shrink-0 items-center gap-2 self-end rounded-[2px] bg-[#1D1D1F] px-3 py-2 outline outline-1 -outline-offset-1 outline-[#666469] transition-colors hover:bg-[#252528] md:self-auto"
                >
                  <Settings className="size-4 text-[#BDC3C2]" aria-hidden />
                  <span className="text-center text-sm font-medium leading-5 text-[#BDC3C2]">
                    Settings
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Pill tabs + season */}
          <div className="flex w-full flex-col gap-4 px-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-6">
            <div
              role="tablist"
              aria-label="League sections"
              className="flex h-auto w-full min-w-0 items-start justify-start gap-px overflow-hidden rounded-full border border-solid border-[var(--Item-Stroke,#49474B)] bg-[var(--Item-Stroke,#49474B)] p-0 shadow-none md:w-fit"
            >
              {([
                ['standings', 'Standings'],
                ['drafts', 'Drafts'],
                ['schedule', 'Schedule'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  id={`league-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={mainTab === key}
                  onClick={() => setMainTab(key)}
                  className={cn(
                    LEAGUE_MAIN_TAB_SEGMENT_CLASS,
                    LEAGUE_MAIN_TAB_BUTTON_CLASS,
                    mainTab === key
                      ? 'bg-[var(--Brand-Primary,#7142FF)] text-[var(--Text-Primary,#FCFFFF)]'
                      : 'bg-[var(--UI-Primary,#1D1D1F)] text-[var(--Text-Primary,#FCFFFF)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
              <SelectTrigger
                className="h-auto w-full rounded-[2px] border-0 bg-[#1D1D1F] px-4 py-3 text-sm font-brockmann text-[#BDC3C2] outline outline-1 -outline-offset-1 outline-[#BDC3C2] focus:ring-0 focus:ring-offset-0 md:w-[min(100%,229px)]"
              >
                <SelectValue placeholder="Previous Seasons" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map(s => (
                  <SelectItem key={s.id} value={s.id} className="font-brockmann">
                    {s.name}
                    {s.id === activeSeason?.id && (
                      <span className="ml-2 text-xs text-purple-400">· active</span>
                    )}
                  </SelectItem>
                ))}
                <SelectItem value="all-time" className="font-brockmann">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tab bodies */}
          {mainTab === 'standings' && (
            <div
              className="flex w-full flex-col gap-6 self-stretch rounded-lg p-6"
              style={{
                background: 'var(--Section-Container, #0E0E0F)',
                boxShadow: '0px 0px 6px #3B0394',
              }}
            >
              <div className="flex flex-col items-center gap-2 self-stretch">
                <h2 className="m-0 text-center text-2xl font-bold leading-8 tracking-[0.96px] text-greyscale-blue-100">
                  {standingsHeading}
                </h2>
              </div>

              {standingsLoading ? (
                <p className="py-8 text-center text-sm text-greyscale-blue-300">Loading standings…</p>
              ) : (
                <>
                  <SeasonStandingRows standings={standings} currentUserId={user?.id} />
                  {standings.length > 0 && completed.length > 0 && (
                    <div className="w-full border-t border-white/10 pt-6">
                      <LeagueStandingsChart
                        standings={standings}
                        completedDrafts={completed}
                        draftPickData={draftPickData}
                        specDraftData={specDraftData}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {mainTab === 'drafts' && (
            <div
              className="flex w-full flex-col gap-6 rounded-lg p-6"
              style={{
                background: 'var(--Section-Container, #0E0E0F)',
                boxShadow: '0px 0px 6px #3B0394',
              }}
            >
              <div className="flex flex-col items-center gap-2 self-stretch">
                <h2 className="m-0 text-center text-2xl font-bold leading-8 tracking-[0.96px] text-greyscale-blue-100 font-brockmann">
                  {effectiveSeasonId ? 'CURRENT SEASON DRAFTS' : 'LEAGUE DRAFTS'}
                </h2>
              </div>

              <div className="flex flex-col gap-4">
                {draftsLoading && (
                  <p className="py-6 text-center text-sm text-greyscale-blue-300 font-brockmann">Loading drafts…</p>
                )}

                {!draftsLoading && scheduled.length === 0 && active.length === 0 && completed.length === 0 && (
                  <div className="space-y-2 py-12 text-center">
                    <Film className="mx-auto h-8 w-8 text-greyscale-blue-400" />
                    <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">No drafts yet.</p>
                    {isAdmin && (
                      <p className="m-0 text-xs text-greyscale-blue-400 font-brockmann">
                        {'Click Start New Draft below or schedule one in settings.'}
                      </p>
                    )}
                  </div>
                )}

                {!draftsLoading && scheduled.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-widest text-greyscale-blue-400 font-brockmann">
                      Upcoming
                    </p>
                    {scheduled.map((entry) => {
                      const specId =
                        entry.draft_type === 'spec-draft' && entry.theme ? entry.theme : null;
                      const specMeta = specId ? specDraftData.get(specId) : undefined;
                      const withinHour = entry.scheduled_at
                        ? new Date(entry.scheduled_at).getTime() - Date.now() <= ONE_HOUR_MS
                        : false;
                      const isOpening = openingDraftId === entry.id;
                      // Admin within 1hr: "Open Draft Room". Admin otherwise: "Edit".
                      const adminLabel = withinHour
                        ? (isOpening ? 'Opening…' : 'Open Draft Room')
                        : 'Edit';
                      const adminHandler = withinHour
                        ? () => handleOpenDraftRoom(entry)
                        : () => navigate(`/league/${leagueId}/settings?tab=schedule&edit=${entry.id}`);
                      return (
                        <LeagueDraftCard
                          key={entry.id}
                          entry={entry}
                          headline={upcomingScheduledHeadline(entry, specMeta)}
                          specInfo={entry.draft_type === 'spec-draft' ? specMeta : undefined}
                          participantCount={0}
                          categoriesCount={entry.categories?.length ?? 0}
                          displayDate={entry.scheduled_at ? new Date(entry.scheduled_at) : null}
                          isScheduled
                          isComplete={false}
                          isMultiplayer={!!entry.is_multiplayer}
                          canEditSchedule={!!isAdmin}
                          viewLabel={isAdmin ? adminLabel : 'View Details'}
                          viewDisabled={isAdmin && isOpening}
                          onView={isAdmin ? adminHandler : () => handleScheduledDraftClick(entry)}
                          onDetails={!isAdmin ? () => handleScheduledDraftClick(entry) : undefined}
                        />
                      );
                    })}
                  </div>
                )}

                {!draftsLoading && active.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-widest text-greyscale-blue-400 font-brockmann">
                      In progress
                    </p>
                    {active.map(entry => {
                      const id = entry.draft_id!;
                      const m = draftPickData?.metrics[id];
                      const participants = draftPickData?.participants ?? [];
                      const placement =
                        user && m
                          ? draftPlacementRank(user.id, participants, id, m.byParticipantName)
                          : null;
                      // League members are pre-joined into draft_participants when the
                      // admin opens the draft room — never send them through the
                      // invite-code join flow. Always navigate directly to /draft/:id.
                      // Their draft_participants row starts as 'invited' until they
                      // open the draft for the first time (load_draft_unified flips it
                      // to 'joined'), so "Continue Draft" is misleading the first time
                      // — show "Join Draft" until this viewer has actually shown up.
                      const viewerParticipant = user
                        ? participants.find(p => p.draft_id === id && p.user_id === user.id)
                        : undefined;
                      const viewerHasJoined = viewerParticipant?.status === 'joined';
                      return (
                        <LeagueDraftCard
                          key={entry.id}
                          entry={entry}
                          specInfo={entry.draft?.theme === 'spec-draft' ? specDraftData.get(entry.draft.option ?? '') : undefined}
                          participantCount={m?.participantCount ?? 0}
                          categoriesCount={entry.draft?.categories?.length ?? entry.categories?.length ?? 0}
                          displayDate={entry.draft?.created_at ? new Date(entry.draft.created_at) : null}
                          isScheduled={false}
                          isComplete={false}
                          // Prefer the live drafts.is_multiplayer when the secondary join
                          // succeeded; fall back to league_drafts.is_multiplayer (always
                          // readable by members via is_league_member RLS) so the badge
                          // doesn't flip to "Local" just because the drafts-table fetch
                          // was blocked (e.g. member not yet in draft_participants).
                          // start_league_scheduled_draft always keeps these two in sync.
                          isMultiplayer={entry.draft ? !!entry.draft.is_multiplayer : !!entry.is_multiplayer}
                          placementRank={placement}
                          leaguePointsEarned={null}
                          viewLabel={viewerHasJoined ? 'Continue Draft' : 'Join Draft'}
                          onView={() => handleViewLeagueDraft(entry)}
                          onDelete={isAdmin ? () => setEntryToDelete(entry) : undefined}
                        />
                      );
                    })}
                  </div>
                )}

                {!draftsLoading && completed.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-widest text-greyscale-blue-400 font-brockmann">
                      Completed
                    </p>
                    {completed.map(entry => {
                      const id = entry.draft_id!;
                      const m = draftPickData?.metrics[id];
                      const participants = draftPickData?.participants ?? [];
                      const placement =
                        user && m
                          ? draftPlacementRank(user.id, participants, id, m.byParticipantName)
                          : null;
                      const leaguePointsEarned =
                        user && m
                          ? draftLeaguePointsByUserId(id, participants, m.byParticipantName)[user.id] ?? null
                          : null;
                      return (
                        <LeagueDraftCard
                          key={entry.id}
                          entry={entry}
                          specInfo={entry.draft?.theme === 'spec-draft' ? specDraftData.get(entry.draft.option ?? '') : undefined}
                          participantCount={m?.participantCount ?? 0}
                          categoriesCount={entry.draft?.categories?.length ?? entry.categories?.length ?? 0}
                          displayDate={entry.draft?.created_at ? new Date(entry.draft.created_at) : null}
                          isScheduled={false}
                          isComplete
                          // See "In progress" card above: fall back to league_drafts.is_multiplayer
                          // when the secondary drafts-table join didn't return a row.
                          isMultiplayer={entry.draft ? !!entry.draft.is_multiplayer : !!entry.is_multiplayer}
                          placementRank={placement}
                          leaguePointsEarned={leaguePointsEarned}
                          viewLabel="View Draft"
                          onView={() => handleViewLeagueDraft(entry)}
                          onDelete={isAdmin ? () => setEntryToDelete(entry) : undefined}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {mainTab === 'schedule' && (
            <div
              className="flex w-full flex-col gap-6 rounded-lg p-6"
              style={{
                background: 'var(--Section-Container, #0E0E0F)',
                boxShadow: '0px 0px 6px #3B0394',
              }}
            >
              <div className="flex flex-col items-stretch gap-2 self-stretch">
                <h2 className="m-0 text-2xl font-bold leading-8 tracking-[0.96px] text-greyscale-blue-100 font-brockmann">
                  UPCOMING DRAFTS
                </h2>
              </div>

              {scheduled.length === 0 ? (
                <div className="space-y-2 py-8 text-center">
                  <CalendarClock className="mx-auto h-8 w-8 text-greyscale-blue-400" />
                  <p className="m-0 text-sm text-greyscale-blue-300 font-brockmann">Nothing on the calendar yet.</p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => navigate(`/league/${leagueId}/settings`)}
                      className="mt-2 inline-flex items-center justify-center rounded-[2px] bg-[#1D1D1F] px-3 py-2 text-sm font-medium leading-5 text-[#BDC3C2] outline outline-1 -outline-offset-1 outline-[#666469] transition-colors hover:bg-[#252528] font-brockmann"
                    >
                      Schedule in settings
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {scheduled.map(entry => {
                    const specId =
                      entry.draft_type === 'spec-draft' && entry.theme ? entry.theme : null;
                    const specMeta = specId ? specDraftData.get(specId) : undefined;
                    const headline = upcomingScheduledHeadline(entry, specMeta);
                    const withinHour = entry.scheduled_at
                      ? new Date(entry.scheduled_at).getTime() - Date.now() <= ONE_HOUR_MS
                      : false;
                    const isOpening = openingDraftId === entry.id;
                    const adminLabel = withinHour
                      ? (isOpening ? 'Opening…' : 'Open Draft Room')
                      : 'Edit Draft';
                    const adminHandler = withinHour
                      ? () => handleOpenDraftRoom(entry)
                      : () => navigate(`/league/${leagueId}/settings?tab=schedule&edit=${entry.id}`);
                    return (
                      <LeagueUpcomingDraftCard
                        key={entry.id}
                        entry={entry}
                        headline={headline}
                        specInfo={entry.draft_type === 'spec-draft' ? specMeta : undefined}
                        canEdit={!!isAdmin}
                        editLabel={adminLabel}
                        editDisabled={isAdmin && isOpening}
                        onEdit={adminHandler}
                        onDetails={() => handleScheduledDraftClick(entry)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex w-full flex-col items-stretch self-stretch gap-4">
            {!showNewDraftFlow ? (
              <div className="flex w-full flex-col items-center self-stretch">
                <button
                  type="button"
                  onClick={() => setShowNewDraftFlow(true)}
                  className="inline-flex items-center justify-center rounded-[2px] bg-[#FFD60A] px-6 py-3 text-center text-base font-semibold leading-6 tracking-[0.32px] text-[#2B2D2D] transition-colors hover:bg-[#e6c109] font-brockmann"
                >
                  Start New Draft
                </button>
              </div>
            ) : (
              <>
                <div className="flex w-full justify-center px-2">
                  <button
                    type="button"
                    onClick={() => setShowNewDraftFlow(false)}
                    className="text-sm font-brockmann font-medium text-purple-300 hover:text-purple-200 underline underline-offset-4 decoration-purple-400/70"
                  >
                    Hide draft setup
                  </button>
                </div>
                <HomeDraftSection
                  key={leagueId}
                  leagueId={leagueId}
                  className="w-full max-w-[1200px] mx-auto px-0 pb-8 pt-0"
                  innerClassName="max-w-[1200px] mx-auto w-full space-y-8"
                />
              </>
            )}
          </div>

          <div className="w-full max-w-[768px] self-center">
            <LeagueMessageBoard leagueId={leagueId!} isAdmin={isAdmin} layout="dashboard" />
          </div>
        </div>
      </div>

      {/* Scheduled draft detail modal (>1 hour before draft) */}
      <ScheduledDraftDetailModal
        entry={detailModalEntry}
        specName={
          detailModalEntry?.draft_type === 'spec-draft' && detailModalEntry.theme
            ? specDraftData.get(detailModalEntry.theme)?.name
            : undefined
        }
        isAdmin={isAdmin}
        leagueId={leagueId ?? ''}
        open={!!detailModalEntry}
        onClose={() => setDetailModalEntry(null)}
        onEditSettings={() => {
          setDetailModalEntry(null);
          navigate(`/league/${leagueId}/settings`);
        }}
      />

      {/* Delete draft confirmation (admin only) */}
      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => { if (!open) setEntryToDelete(null); }}>
        <AlertDialogContent className="font-brockmann bg-[#0E0E0F] border border-[#49474B]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-greyscale-blue-100">Remove from league history?</AlertDialogTitle>
            <AlertDialogDescription className="text-greyscale-blue-400">
              This removes the draft entry from this league's history. The draft itself is not deleted — it will still be accessible via its direct link. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[2px] border-[#49474B] bg-transparent text-greyscale-blue-300 hover:bg-[#1D1D1F] hover:text-greyscale-blue-100"
              disabled={deleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-[2px] bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LeaguePage;
