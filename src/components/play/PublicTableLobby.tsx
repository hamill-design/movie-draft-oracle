import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi, type TableInfo } from '@/lib/publicPlayApi';
import { inviteApi } from '@/lib/inviteApi';
import { PlayerActions } from '@/components/play/PlayerActions';
import { PlayerHoverCard } from '@/components/play/PlayerHoverCard';
import {
  DraftLobbyStatusParticipants,
  type LobbyDetails,
  type LobbyParticipant,
} from '@/components/draft-board/DraftLobbyStatusParticipants';
import { LobbyButton, LobbyHero } from '@/components/draft-board/LobbyHero';
import { LobbySettingsDialog } from '@/components/draft-board/LobbySettingsDialog';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import { InviteSeatDialog } from '@/components/draft-board/InviteSeatDialog';
import { RevokeInviteButton } from '@/components/draft-board/RevokeInviteButton';
import {
  CANCEL_REASON_TEXT, describeClock, formatCountdown, formatWhen, hostGraceMs,
} from '@/config/publicPlay';
import { cn } from '@/lib/utils';

interface PublicTableLobbyProps {
  draftId: string;
  /** Called once when the draft has started so the draft screen can load the board. */
  onStarted: () => void;
  /** The table's join code: the same 8 characters a private draft shows, and the homepage's "Join a Draft" box takes. */
  inviteCode?: string | null;
}

const card = 'rounded-lg border border-[#49474B] bg-[#0E0E0F] p-5';
const muted = 'font-brockmann text-sm text-[#BDC3C2]';

/**
 * The waiting room for a public table. It draws the same pre-draft screen private drafts use
 * (DraftLobbyStatusParticipants) and supplies what only a public table has: the call to action,
 * the host's settings, the ready check, the start time, bots and the report / block controls.
 * Everything here goes through the table functions in the database: the host starts the draft
 * (never a timer; empty seats fill with bots), everyone in the lobby counts as ready, anyone who has
 * wandered off gets a 15-second check on a live draft, and a host who doesn't show is replaced.
 */
export function PublicTableLobby({ draftId, onStarted, inviteCode }: PublicTableLobbyProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const serverOffsetRef = useRef(0);
  const wasHostRef = useRef<boolean | null>(null);
  const startedFiredRef = useRef(false);
  const finalizeFiredRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await publicPlayApi.tableInfo(draftId);
      serverOffsetRef.current = Date.parse(next.server_now) - Date.now();
      setInfo(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this table.');
    }
  }, [draftId]);

  const checkActive = !!info?.ready_check_expires_at;
  // A live table has people watching who is here and a ready check can begin at any moment, so keep it fresh.
  // Slow (hours-per-pick) tables are relaxed.
  const fastPoll = checkActive || info?.speed === 'live';
  // The categories a host can pick from (a special draft keeps its own).
  const categoryChoices = useDraftCategories(info && info.theme !== 'spec-draft' ? info.theme : null);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), fastPoll ? 1500 : 4000);
    return () => clearInterval(id);
  }, [load, fastPoll]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hand the screen over to the draft board once it has started.
  useEffect(() => {
    if (info?.status === 'active' && !startedFiredRef.current) {
      startedFiredRef.current = true;
      onStarted();
    }
  }, [info?.status, onStarted]);

  // Tell someone who has just been handed the host role.
  useEffect(() => {
    if (!info) return;
    if (wasHostRef.current === false && info.i_am_host) {
      toast({ title: "You're now the host", description: 'The previous host was away. Start the draft when everyone is ready.' });
    }
    wasHostRef.current = info.i_am_host;
  }, [info?.i_am_host]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverNow = nowMs + serverOffsetRef.current;
  const checkExpiresMs = info?.ready_check_expires_at ? Date.parse(info.ready_check_expires_at) : null;
  const checkSecondsLeft = checkExpiresMs != null ? Math.max(0, Math.ceil((checkExpiresMs - serverNow) / 1000)) : null;

  // When a ready check runs out, the host's screen finishes it straight away (the server's
  // once-a-minute sweep is only the backstop).
  useEffect(() => {
    if (!info?.i_am_host || info.status !== 'forming' || checkExpiresMs == null) return;
    if (checkExpiresMs > serverNow || finalizeFiredRef.current === info.ready_check_expires_at) return;
    finalizeFiredRef.current = info.ready_check_expires_at;
    void publicPlayApi.startTable(draftId).then(() => load()).catch(() => load());
  }, [checkExpiresMs, serverNow, info, draftId, load]);

  const run = async (key: string, fn: () => Promise<unknown>, failTitle: string) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (err) {
      toast({ title: failTitle, description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (error && !info) {
    return <div className={cn(card, 'text-center')}><p role="alert" className={muted}>{error}</p></div>;
  }
  if (!info) {
    return <div className={cn(card, 'h-48 animate-pulse')} aria-busy="true" />;
  }

  // A held seat (an invited friend who hasn't taken it yet) is a seat, but not a player.
  const humans = info.participants.filter((p) => !p.is_ai && p.status !== 'invited');
  const heldSeats = info.participants.filter((p) => p.status === 'invited');
  const emptySeats = Math.max(info.table_size - info.participants.length, 0);
  // Every seat that isn't a real player when the host starts is a bot (held seats are released first).
  const botCount = Math.max(info.table_size - humans.length, 0);
  const me = info.participants.find((p) => p.is_me);
  const scheduledMs = info.scheduled_start_at ? Date.parse(info.scheduled_start_at) : null;
  const graceMs = hostGraceMs(info.pick_clock_seconds);
  const late = scheduledMs != null && scheduledMs <= serverNow;
  const readyCount = humans.filter((p) => p.ready).length;
  const inCheck = checkSecondsLeft != null && checkSecondsLeft > 0;
  // Anyone seated can open the invite window from an open seat; only the host can add emails in it.
  const canOpenSeats = info.i_joined && info.status === 'forming' && emptySeats > 0 && !inCheck;

  if (info.status === 'cancelled') {
    return (
      <div className={cn(card, 'flex flex-col items-center gap-3 text-center')}>
        <h2 className="m-0 font-brockmann text-xl font-medium text-white">This table was cancelled</h2>
        <p className={muted}>{CANCEL_REASON_TEXT[info.cancel_reason ?? ''] ?? 'The table is no longer running.'}</p>
        <Button onClick={() => navigate('/play')} className="bg-[#680AFF] hover:bg-[#794DFF] text-white">Find another table</Button>
      </div>
    );
  }

  const canSchedule = !info.is_quick;
  const showStart = info.i_am_host && !inCheck;
  const canEdit = info.i_am_host && !inCheck;

  // The headline and one-line explanation.
  let heading: string;
  let sub: string | undefined;
  // The host on their own gets a small alert under the participants rather than a line in the headline.
  let notice: string | undefined;
  if (showStart && humans.length === 1) {
    heading = 'Waiting For Players';
    notice = `You're the only real player so far. Bots take the empty seats when you start.${info.rated ? " With just you and bots, the game won't count toward the leaderboard." : ''}`;
  } else if (showStart) {
    heading = 'Ready To Start?';
    sub = botCount === 0
      ? 'The table is full. Start when you are ready.'
      : botCount === 1
        ? `${humans.length} players at the table. A bot takes the last seat when you start.`
        : `${humans.length} players at the table. Bots take the other ${botCount} seats when you start.`;
  } else {
    heading = 'Waiting on the Host';
    sub = "The host will begin the draft when ready. You'll be notified.";
  }

  // The same pre-draft screen private drafts use. This file works out what a public table says and does;
  // DraftLobbyStatusParticipants draws it.
  const lobbyParticipants: LobbyParticipant[] = info.participants.map((p, i) => ({
    // A held seat's id is what the host needs to take the invitation back.
    id: p.participant_id ?? `${p.user_id ?? 'bot'}-${i}`,
    // A held seat shows the address to the host who typed it, and just "Friend" to everyone else.
    participant_name: p.status === 'invited' ? (p.email ?? 'Friend') : p.name,
    user_id: p.user_id,
    is_ai: p.is_ai,
    is_host: p.is_host,
    status: p.status ?? 'joined',
    avatar_url: p.avatar_url,
    ready: p.ready,
    online: p.online,
    is_me: p.is_me,
  }));

  const detailRows: LobbyDetails['rows'] = [
    { label: 'Pick clock', value: `${info.speed === 'live' ? 'Live' : 'Slow'} · ${describeClock(info.pick_clock_seconds)}` },
    { label: 'Game', value: info.rated ? 'Rated' : 'Casual' },
    { label: 'Seats', value: String(info.table_size) },
  ];
  if (canSchedule) {
    detailRows.push({
      label: 'Starts',
      value:
        scheduledMs != null
          ? late
            ? `Was due ${formatWhen(info.scheduled_start_at as string)}`
            : `${formatWhen(info.scheduled_start_at as string)} · in ${formatCountdown(scheduledMs - serverNow)}`
          : 'When the host is ready',
    });
  }
  const linkButton = 'self-start bg-transparent font-brockmann text-sm text-[#C9B8FF] underline';
  const detailsFooter =
    (canEdit && canSchedule) || (canSchedule && late && !info.i_am_host) ? (
      <>
        {canEdit && canSchedule && (
          <button
            type="button"
            onClick={() => {
              setScheduleValue('');
              setScheduleOpen(true);
            }}
            className={linkButton}
          >
            {scheduledMs != null ? 'Change time' : 'Set a start time'}
          </button>
        )}
        {!info.i_am_host && late && (
          <p className={cn(muted, 'm-0')}>
            The host is running late. If they haven't started the draft {formatCountdown(Math.max(scheduledMs! + graceMs - serverNow, 0))} from now, the next player takes over.
          </p>
        )}
      </>
    ) : undefined;

  // The call to action: while a ready check runs the check panel above takes over, so there is none.
  const hero = inCheck ? null : (
    <LobbyHero heading={heading} sub={sub}>
      {showStart && (
        <LobbyButton
          disabled={busy === 'start'}
          onClick={() => void run('start', () => publicPlayApi.startTable(draftId), "Couldn't start the draft")}
        >
          {busy === 'start' ? 'Starting...' : 'Start Draft'}
        </LobbyButton>
      )}
      {showStart && (
        <button type="button" onClick={() => setCancelOpen(true)} className="bg-transparent font-brockmann text-sm text-[#BDC3C2] underline hover:text-white">
          Cancel table
        </button>
      )}
    </LobbyHero>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Ready check: everyone confirms they're at their screen */}
      {inCheck && (
        <section role="alertdialog" aria-label="Ready check" className="rounded-lg border-2 border-[#680AFF] bg-[#25015E] p-6 flex flex-col items-center gap-3 text-center">
          <Timer size={28} className="text-[#FFD60A]" aria-hidden />
          <h2 className="m-0 font-brockmann text-xl font-semibold text-white">Ready check</h2>
          <p className="m-0 font-brockmann text-sm text-white">
            {me?.ready
              ? `You're ready. Waiting for the others (${readyCount} of ${humans.length}).`
              : "The host is about to start. Confirm you're here."}
          </p>
          <div className="font-brockmann text-4xl font-semibold tabular-nums text-[#FFD60A]">{checkSecondsLeft}s</div>
          {!me?.ready && info.i_joined && (
            <Button onClick={() => void run('ready', () => publicPlayApi.confirmReady(draftId), "Couldn't confirm")} disabled={busy === 'ready'} className="bg-[#FFD60A] hover:bg-[#FFE55C] text-black font-semibold">
              {busy === 'ready' ? 'Confirming…' : "I'm here"}
            </Button>
          )}
        </section>
      )}

      <DraftLobbyStatusParticipants
        draft={{ id: draftId, invite_code: null }}
        isComplete={false}
        draftHasStarted={false}
        isHost={info.i_am_host}
        isMyTurn={false}
        participants={lobbyParticipants}
        sortedParticipants={lobbyParticipants}
        joinedParticipantsCount={humans.length}
        presenceNowMs={nowMs}
        copySuccess={false}
        loading={false}
        onCopyInviteCode={() => {}}
        onStartDraft={() => {}}
        details={{ rows: detailRows, footer: detailsFooter, categories: info.categories, onEdit: canEdit ? () => setSettingsOpen(true) : undefined }}
        ready={{
          // Only during the 15-second check, to show who has answered.
          enabled: inCheck,
          busy: busy === 'ready',
          onToggle: () => {},
          showFor: (p) => !p.is_ai && p.status !== 'invited',
          inCheck,
        }}
        hero={hero}
        notice={inCheck ? undefined : notice}
        invite={
          info.i_joined && emptySeats > 0 && !inCheck
            ? inviteCode
              ? {
                  // The same Join Code row a private draft shows. Entering it on the homepage takes a seat here.
                  label: 'Join Code',
                  code: inviteCode,
                  copied: codeCopied,
                  onCopy: () => {
                    navigator.clipboard?.writeText(inviteCode).then(
                      () => {
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                        toast({ title: 'Join code copied', description: 'Friends enter it under Join a Draft on the homepage.' });
                      },
                      () => toast({ title: 'Copy this code', description: inviteCode })
                    );
                  },
                }
              : {
                  label: 'Invite Link',
                  copyOnly: true,
                  onCopy: () => {
                    const link = `${window.location.origin}/play?join=${draftId}`;
                    navigator.clipboard?.writeText(link).then(
                      () => toast({ title: 'Invite link copied', description: 'Anyone with an account can use it to take a seat.' }),
                      () => toast({ title: 'Copy this link', description: link })
                    );
                  },
                }
            : null
        }
        seats={info.table_size}
        onOpenSeat={canOpenSeats ? () => setInviteOpen(true) : undefined}
        renderName={(p) =>
          p.is_ai || p.status === 'invited' ? p.participant_name : <PlayerHoverCard userId={p.user_id} name={p.participant_name} />
        }
        renderTileActions={(p) => {
          if (p.status === 'invited') {
            // The host can take back an invitation nobody has used yet (a mistyped address, say).
            return info.i_am_host && !inCheck ? (
              <RevokeInviteButton
                disabled={busy === 'revoke'}
                onRevoke={() => void run('revoke', () => inviteApi.revoke(draftId, p.id), "Couldn't take that back")}
              />
            ) : null;
          }
          return !p.is_me && !p.is_ai && p.user_id ? <PlayerActions userId={p.user_id} name={p.participant_name} draftId={draftId} /> : null;
        }}
      />
      {/* Open seats are buttons: this is where they lead */}
      <InviteSeatDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        draftId={draftId}
        draftTitle={info.title}
        hostName={me?.name ?? 'A friend'}
        theme={info.theme}
        option={info.option}
        canInvite={info.i_am_host}
        seatsLeft={emptySeats}
        share={{ label: 'Invite link', value: `${window.location.origin}/play?join=${draftId}` }}
        taken={{
          emails: heldSeats.map((p) => p.email ?? '').filter(Boolean),
          userIds: info.participants.map((p) => p.user_id ?? '').filter(Boolean),
        }}
        onChanged={() => void load()}
      />
      {/* The host's settings */}
      <LobbySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={{ seats: info.table_size, clock: info.pick_clock_seconds, rated: info.rated, categories: info.categories }}
        seatRange={{ min: Math.max(info.participants.length, 2), max: 6 }}
        allowNoClock={false}
        categoryOptions={info.theme === 'spec-draft' || categoryChoices.length === 0 ? null : categoryChoices}
        theme={info.theme}
        option={info.option}
        playerCount={info.participants.length}
        onSave={async (change) => {
          await publicPlayApi.setTableSettings(draftId, { ...change, clock: change.clock ?? undefined });
          await load();
        }}
      />
      {/* Edit schedule */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="border-[#49474B] bg-[#0E0E0F] text-white sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-brockmann">Start time</DialogTitle>
            <DialogDescription className="font-brockmann text-sm text-[#BDC3C2]">
              Players are told when it changes. You still press Start yourself.
            </DialogDescription>
          </DialogHeader>
          <input
            type="datetime-local"
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            aria-label="New start time"
            className="h-10 w-full rounded border border-[#49474B] bg-[#1D1D1F] px-3 font-brockmann text-sm text-white"
          />
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              className="border-[#49474B] bg-transparent text-white"
              onClick={() => void run('schedule', async () => { await publicPlayApi.setSchedule(draftId, null); setScheduleOpen(false); }, "Couldn't change the time")}
            >
              Clear time
            </Button>
            <Button
              disabled={!scheduleValue || busy === 'schedule'}
              className="bg-[#680AFF] hover:bg-[#794DFF] text-white"
              onClick={() => void run('schedule', async () => { await publicPlayApi.setSchedule(draftId, new Date(scheduleValue).toISOString()); setScheduleOpen(false); }, "Couldn't change the time")}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="border-[#49474B] bg-[#0E0E0F] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-brockmann">Cancel this table?</AlertDialogTitle>
            <AlertDialogDescription className="font-brockmann text-[#BDC3C2]">
              Everyone at the table is told it was cancelled. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#49474B] bg-transparent text-white">Keep table</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#B3261E] hover:bg-[#CE3B33] text-white"
              onClick={() => void run('cancel', () => publicPlayApi.cancelTable(draftId), "Couldn't cancel the table")}
            >
              Cancel table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
