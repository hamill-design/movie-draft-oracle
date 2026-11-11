import type { ReactNode } from 'react';
import { Bot, Check, Clock, Copy, Crown, Edit2, Film, Info, Plus } from 'lucide-react';
import { isParticipantOnline } from '@/utils/draftPresence';
import { getCategoryConfig } from '@/config/categoryConfigs';
import { MultiPersonIcon } from '@/components/icons/MultiPersonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LobbyButton, LobbyHero } from '@/components/draft-board/LobbyHero';

export interface LobbyParticipant {
  id: string;
  participant_name: string;
  participant_id?: string;
  user_id?: string | null;
  guest_participant_id?: string | null;
  is_ai?: boolean;
  is_host?: boolean;
  status: 'invited' | 'joined' | 'left' | string;
  email?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
  /** Has marked themselves ready. */
  ready?: boolean;
  /** Is the person looking at this screen. Worked out from `myParticipantId` when not given. */
  is_me?: boolean;
  /** The server already decided whether they're online (public tables). Otherwise it's worked out from `last_seen_at`. */
  online?: boolean;
}

/** What the Draft Status card says before the draft starts: label/value rows, then what everyone will draft. */
export interface LobbyDetails {
  rows: { label: string; value: ReactNode }[];
  /** Anything extra under the rows (a link to change the start time, a "host is running late" note). */
  footer?: ReactNode;
  /** The host's edit icon, top right of the card. Leave out for everyone else. */
  onEdit?: () => void;
  categories?: string[];
}

/** The optional "I'm ready" for the waiting room. */
export interface LobbyReady {
  /** Show Ready / Not ready under each player (and, on a private draft, the toggle). */
  enabled: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
  /** Who gets a ready label. Default: real, joined players who aren't the host. */
  showFor?: (p: LobbyParticipant) => boolean;
  /** A ready check is running: players who haven't answered read "Waiting…". */
  inCheck?: boolean;
}

/** The row above the avatars: the join code on a private draft, an invite link on an open table. */
export interface LobbyInvite {
  label: string;
  code?: string | null;
  /** Show the Copy button even though there is no code to display (an invite link). */
  copyOnly?: boolean;
  copied?: boolean;
  onCopy: () => void;
}

const defaultShowReadyFor = (p: LobbyParticipant) => !p.is_ai && !p.is_host && p.status === 'joined';

function getParticipantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** The online circle at the bottom right of a portrait. One size for everyone (the host's holds a crown). */
const ONLINE_CIRCLE_SIZE = 18;

function ParticipantGridAvatar({
  avatarUrl,
  name,
  isMe,
  isHost,
  isOnline,
  isAi,
  isReady,
}: {
  avatarUrl?: string | null;
  name: string;
  /** Not shown (there is no "You" label), but read out by screen readers. */
  isMe?: boolean;
  /** The host's online circle (bottom right of the portrait) holds a black crown. */
  isHost?: boolean;
  isOnline: boolean;
  isAi?: boolean;
  isReady?: boolean;
}) {
  const avatarSize = 64;
  const face = isAi ? <Bot size={26} aria-hidden /> : getParticipantInitials(name);

  let avatarNode: React.ReactNode;

  if (isOnline) {
    avatarNode = (
      <div
        data-show-online-status="true"
        style={{
          width: avatarSize,
          height: avatarSize,
          position: 'relative',
          borderRadius: '9999px',
          backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: avatarUrl ? undefined : 'var(--Greyscale-Blue-800, #1A1D29)',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          display: 'flex',
        }}
      >
        {!avatarUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '9999px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--Text-Primary, #FCFFFF)',
              fontSize: '18px',
              fontFamily: 'Brockmann',
              fontWeight: '600',
            }}
          >
            {face}
          </div>
        )}
      </div>
    );
  } else if (avatarUrl) {
    avatarNode = (
      <img
        src={avatarUrl}
        alt=""
        data-show-online-status="false"
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '9999px',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  } else {
    avatarNode = (
      <div
        data-show-online-status="false"
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '9999px',
          background: 'var(--Greyscale-Blue-800, #1A1D29)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--Text-Primary, #FCFFFF)',
          fontSize: '18px',
          fontFamily: 'Brockmann',
          fontWeight: '600',
        }}
      >
        {face}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${name}${isMe ? ' (you)' : ''}${isHost ? ', host' : ''}`}
      style={{
        position: 'relative',
        padding: 0,
        cursor: 'default',
        display: 'inline-flex',
        borderRadius: '9999px',
        // A green ring around the avatar says "ready" without needing a second badge.
        boxShadow: isReady ? '0 0 0 2px #0E0E0F, 0 0 0 4px var(--Utility-Colors-Positive-Green-400, #41DA86)' : undefined,
      }}
    >
      {avatarNode}
      {(isOnline || isHost) && (
        // The online circle: green while they are here, the same size for every player. The host's holds a black
        // crown, and stays (grey) while the host is away; other players' circle only shows while they are here.
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: ONLINE_CIRCLE_SIZE,
            height: ONLINE_CIRCLE_SIZE,
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isOnline ? 'var(--Utility-Colors-Positive-Green-400, #41DA86)' : '#9AA0A1',
          }}
        >
          {isHost && <Crown size={11} strokeWidth={2.25} color="#000000" aria-hidden />}
        </div>
      )}
    </div>
  );
}

/**
 * Hovering a player's portrait or name shows their email (private drafts only: public tables never load one).
 * With no email there is nothing to show, so the tile is left as it is.
 */
function EmailTooltip({ name, email, children }: { name: string; email?: string | null; children: ReactNode }) {
  if (!email) return <>{children}</>;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="flex w-full cursor-default flex-col items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907AFF]">
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="border-0 bg-transparent p-0 shadow-none">
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--UI-Primary, #1D1D1F)',
            borderRadius: '9999px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: '2px',
            display: 'inline-flex',
            maxWidth: '280px',
          }}
        >
          <div style={{ color: 'var(--Text-Primary, #FCFFFF)', fontSize: '13px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '18px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {name}
          </div>
          <div style={{ color: 'var(--Text-Light-grey, #BDC3C2)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {email}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * One player: the round avatar (its host circle holds a crown), their name, and small labels (Bot, Invited, Ready).
 * The portrait and the name are one hover target, so both show the same thing: `wrapIdentity` supplies it (the
 * player card on public tables); without it a private draft shows the email, when there is one.
 */
function LobbyTile({
  p,
  isMe,
  online,
  showReady,
  inCheck,
  wrapIdentity,
  actions,
}: {
  p: LobbyParticipant;
  isMe: boolean;
  online: boolean;
  showReady: boolean;
  inCheck?: boolean;
  wrapIdentity?: (p: LobbyParticipant, identity: ReactNode) => ReactNode;
  actions?: ReactNode;
}) {
  // Words are separated by a dot. There is no "You" (your own name is on the screen) and no "Host": the host's circle on the portrait holds a crown.
  const words = [
    p.is_ai ? <span key="bot">Bot</span> : null,
    !p.is_ai && p.status === 'invited' ? <span key="invited">Invited</span> : null,
    showReady ? (
      <span key="ready" className={p.ready ? 'text-[#7CE0A0]' : undefined}>
        {p.ready ? 'Ready' : inCheck ? 'Waiting…' : 'Not ready'}
      </span>
    ) : null,
  ]
    .filter(Boolean)
    .flatMap((node, i) => (i === 0 ? [node] : [<span key={`dot-${i}`} aria-hidden>·</span>, node]));
  const labels = words;

  const identity = (
    <>
      <ParticipantGridAvatar
        avatarUrl={p.avatar_url}
        name={p.participant_name}
        isMe={isMe}
        isHost={p.is_host}
        isOnline={online}
        isAi={p.is_ai}
        isReady={showReady && !!p.ready}
      />
      <div className="w-full min-w-0 [overflow-wrap:anywhere] font-brockmann text-sm font-medium leading-4 text-white">
        {p.participant_name}
      </div>
    </>
  );
  const identityBlock = <div className="flex w-full flex-col items-center gap-2">{identity}</div>;

  return (
    <li className="relative flex w-[104px] flex-col items-center gap-2 text-center">
      {wrapIdentity ? (
        wrapIdentity(p, identityBlock)
      ) : (
        <EmailTooltip name={p.participant_name} email={p.email}>
          {identity}
        </EmailTooltip>
      )}
      {labels.length > 0 && (
        <div className="-mt-1 flex w-full flex-wrap items-center justify-center gap-x-1.5 font-brockmann text-xs text-[#BDC3C2]">
          {labels}
        </div>
      )}
      {actions ? <div className="absolute -right-1 -top-2">{actions}</div> : null}
    </li>
  );
}

/**
 * An empty seat. With `onOpen` it is a button (a plus in the circle) that opens the invite window;
 * without it, a plain dashed circle.
 */
function OpenSeat({ onOpen }: { onOpen?: () => void }) {
  if (!onOpen) {
    return (
      <li className="flex w-[104px] flex-col items-center gap-2 text-center">
        <div className="h-16 w-16 rounded-full border border-dashed border-[#49474B]" aria-hidden />
        <span className="font-brockmann text-xs text-[#BDC3C2]">Open seat</span>
      </li>
    );
  }
  return (
    <li className="flex w-[104px] flex-col items-center text-center">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Invite someone to this seat"
        className="group flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907AFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E0F]"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[#49474B] text-[#BDC3C2] transition-colors group-hover:border-[#BDC3C2] group-hover:text-[#FCFFFF]">
          <Plus size={24} aria-hidden />
        </span>
        <span className="font-brockmann text-xs text-[#BDC3C2] transition-colors group-hover:text-[#FCFFFF]">Open seat</span>
      </button>
    </li>
  );
}

/** The Draft Status card before the draft starts: format, clock and so on, then what everyone will draft. */
function LobbyDetailsView({ details }: { details?: LobbyDetails }) {
  if (!details) return null;
  const categories = details.categories ?? [];
  return (
    <div className="flex w-full flex-col gap-6">
      {(details.rows.length > 0 || details.footer) && (
        <div className="flex w-full flex-col gap-3">
          {details.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="font-brockmann text-sm font-normal leading-5 text-[#BDC3C2]">{row.label}:</span>
              <span className="text-right font-brockmann text-sm font-medium leading-5 text-[#FCFFFF]">{row.value}</span>
            </div>
          ))}
          {details.footer}
        </div>
      )}
      {categories.length > 0 && (
        <div className="flex w-full flex-col gap-3" aria-label="Categories">
          <h3 className="m-0 font-brockmann text-base font-semibold text-[#FCFFFF]">
            Categories <span className="font-normal text-[#BDC3C2]">({categories.length})</span>
          </h3>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {categories.map((c) => (
              <li
                key={c}
                title={getCategoryConfig(c)?.description}
                className="rounded bg-[#1D1D1F] px-3 py-1.5 font-brockmann text-sm text-white"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** "Join Code" with the code and a Copy button (or "Invite Link" with just the button). */
function InviteRowView({ invite }: { invite: LobbyInvite }) {
  const showControls = Boolean(invite.code) || invite.copyOnly;
  return (
    <div style={{
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
      display: 'inline-flex',
      flexWrap: 'wrap',
      alignContent: 'center',
      rowGap: '12px',
    }}>
      <div style={{
        flex: '0 0 auto',
        minWidth: '120px',
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--Text-Primary, #FCFFFF)',
        fontSize: '24px',
        fontFamily: 'Brockmann',
        fontWeight: '700',
        lineHeight: '24px',
        letterSpacing: '0.24px',
        wordWrap: 'break-word',
      }}>
        {invite.label}
      </div>
      {showControls && (
        <div style={{
          flex: '1 1 auto',
          minWidth: 'min(100%, 295px)',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-end',
          gap: '10px',
          display: 'inline-flex',
        }}>
          <div style={{
            alignSelf: 'stretch',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            display: 'inline-flex',
          }}>
            {invite.code && (
              <div style={{
                paddingLeft: '14px',
                paddingRight: '14px',
                paddingTop: '4px',
                paddingBottom: '4px',
                background: 'var(--UI-Primary, #1D1D1F)',
                borderRadius: '9999px',
                outline: '1px var(--Text-Primary, #FCFFFF) solid',
                outlineOffset: '-1px',
                justifyContent: 'flex-start',
                alignItems: 'center',
                display: 'flex',
              }}>
                <div style={{
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '18px',
                  fontFamily: 'Replica-Mono, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                  fontWeight: '400',
                  lineHeight: '28px',
                  letterSpacing: '1.08px',
                  wordWrap: 'break-word',
                }}>
                  {invite.code}
                </div>
              </div>
            )}
            <button
              onClick={invite.onCopy}
              style={{
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                background: 'var(--UI-Primary, #1D1D1F)',
                borderRadius: '2px',
                outline: '1px var(--Text-Primary, #FCFFFF) solid',
                outlineOffset: '-1px',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                display: 'flex',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <div style={{
                textAlign: 'center',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '14px',
                fontFamily: 'Brockmann',
                fontWeight: '500',
                lineHeight: '20px',
                wordWrap: 'break-word',
              }}>
                {invite.copied ? 'Copied!' : 'Copy'}
              </div>
              <div style={{
                width: '16px',
                height: '16px',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                display: 'inline-flex',
              }}>
                {invite.copied ? <Check size={16} color="#FCFFFF" /> : <Copy size={16} color="#FCFFFF" />}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface DraftLobbyStatusParticipantsProps {
  draft: {
    id: string;
    current_pick_number?: number | null;
    invite_code?: string | number | null;
    current_turn_participant_id?: string | null;
    current_turn_user_id?: string | null;
  };
  isComplete: boolean;
  draftHasStarted: boolean;
  isHost: boolean;
  isMyTurn: boolean;
  currentTurnPlayer?: LobbyParticipant | null;
  participants: LobbyParticipant[];
  sortedParticipants: LobbyParticipant[];
  joinedParticipantsCount: number;
  presenceNowMs: number;
  copySuccess: boolean;
  loading: boolean;
  onCopyInviteCode: () => void;
  onStartDraft: () => void;
  /** Who is looking at the screen, so "You" and the Ready button know which tile is theirs. */
  myParticipantId?: string | null;
  /** Format, pick clock and categories, shown in the Draft Status card until the draft starts. */
  details?: LobbyDetails;
  /** The optional "I'm ready". Leave out to hide it. */
  ready?: LobbyReady;
  /** Left out: this draft's own call to action. `null`: none. A node: that instead (public tables bring their own). */
  hero?: ReactNode;
  /** Left out: the join code. `null`: hide the row. */
  invite?: LobbyInvite | null;
  /** A short heads-up shown as a small alert under the participants (for example how bots fill the table). */
  notice?: ReactNode;
  /** Seats at the table, so empty ones show as "Open seat". Leave out for drafts with no fixed size. */
  seats?: number;
  /** Show this many open seats instead (a draft with no fixed size shows one, so the host can add someone). */
  openSeats?: number;
  /** Makes each open seat a button, normally opening the invite window. Leave out for plain empty seats. */
  onOpenSeat?: () => void;
  /** Wraps a player's portrait and name in one hover target (the player card on public tables). */
  wrapIdentity?: (p: LobbyParticipant, identity: ReactNode) => ReactNode;
  /** Small controls on a tile (report / block on public tables). */
  renderTileActions?: (p: LobbyParticipant) => ReactNode;
}

/**
 * The pre-draft screen, and the draft's status card once it is under way. Private drafts and public
 * tables both come through here; the public side just passes a few extras (see the optional props).
 */
export function DraftLobbyStatusParticipants({
  draft,
  isComplete,
  draftHasStarted,
  isHost,
  isMyTurn,
  currentTurnPlayer,
  participants,
  sortedParticipants,
  joinedParticipantsCount,
  presenceNowMs,
  copySuccess,
  loading,
  onCopyInviteCode,
  onStartDraft,
  myParticipantId,
  details,
  ready,
  hero,
  invite,
  notice,
  seats,
  openSeats,
  onOpenSeat,
  wrapIdentity,
  renderTileActions,
}: DraftLobbyStatusParticipantsProps) {
  const getParticipantsSortedByCreatedAt = sortedParticipants;

  const isMe = (p: LobbyParticipant) =>
    p.is_me ??
    Boolean(
      myParticipantId &&
        [p.user_id, p.guest_participant_id, p.participant_id].some((id) => id && String(id) === String(myParticipantId)),
    );
  const showReadyFor = (p: LobbyParticipant) => (ready?.enabled ? (ready.showFor ?? defaultShowReadyFor)(p) : false);

  const inviteView: LobbyInvite | null =
    invite === undefined
      ? {
          label: 'Join Code',
          code: draft.invite_code ? String(draft.invite_code) : null,
          copied: copySuccess,
          onCopy: onCopyInviteCode,
        }
      : invite;
  const emptySeats = openSeats ?? (seats ? Math.max(seats - participants.length, 0) : 0);

  // The call to action under the cards. A private draft builds its own; a public table passes one in.
  let heroNode: ReactNode = null;
  if (hero !== undefined) {
    heroNode = hero;
  } else if (!draftHasStarted && !isComplete && participants.length >= 2) {
    if (isHost) {
      heroNode = (
        <LobbyHero
          heading="Ready To Start?"
          sub={`${joinedParticipantsCount} ${joinedParticipantsCount === 1 ? 'player has' : 'players have'} joined. Click below to randomize turn order and start the draft!`}
        >
          <LobbyButton onClick={onStartDraft} disabled={loading}>
            {loading ? 'Starting...' : 'Start Draft'}
          </LobbyButton>
        </LobbyHero>
      );
    } else {
      heroNode = <LobbyHero heading="Waiting on the Host" sub="The host will begin the draft when ready." />;
    }
  } else if (!draftHasStarted && !isComplete) {
    heroNode = (
      <LobbyHero
        heading="Waiting For Players"
        sub="Need at least 2 players to start the draft. Share the invite code above!"
      />
    );
  }

  return (
    <>
        {/* Status and Participants */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px 24px',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%'
        }}>
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: 'var(--shadow-card-glow)', 
            borderRadius: 'var(--radius-card)', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', display: 'inline-flex'}}>
              <div style={{width: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'inline-flex'}}>
                <Clock size={24} color="#907AFF" />
              </div>
              <div style={{
                flex: '1 1 0', 
                justifyContent: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'var(--Text-Primary, #FCFFFF)', 
                fontSize: '20px', 
                fontFamily: 'Brockmann', 
                fontWeight: '500', 
                lineHeight: '28px', 
                wordWrap: 'break-word'
              }}>Draft Status</div>
              {!isComplete && !draftHasStarted && details?.onEdit && (
                <button
                  type="button"
                  onClick={details.onEdit}
                  aria-label="Edit settings"
                  title="Edit settings"
                  className="-my-2 -mr-2 shrink-0 rounded-[2px] bg-transparent p-2 text-[#FCFFFF] transition-colors hover:bg-[#1D1D1F]"
                >
                  <Edit2 className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
            
            {isComplete ? (
              <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Primary, #FCFFFF)', 
                    fontSize: '16px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '600', 
                    lineHeight: '24px', 
                    wordWrap: 'break-word'
                  }}>Draft Complete</div>
                  <div style={{
                    alignSelf: 'stretch', 
                    textAlign: 'center', 
                    justifyContent: 'center', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--Text-Light-grey, #BDC3C2)', 
                    fontSize: '14px', 
                    fontFamily: 'Brockmann', 
                    fontWeight: '400', 
                    lineHeight: '20px', 
                    wordWrap: 'break-word'
                  }}>All picks have been made!</div>
                </div>
              </>
            ) : (
              <>
                {!draftHasStarted ? (
                  <LobbyDetailsView details={details} />
                ) : (
                <>
                <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: '12px', display: 'flex'}}>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Pick Number:</div>
                    </div>
                    <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Primary, #FCFFFF)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '500', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>{draft.current_pick_number}</div>
                    </div>
                  </div>
                  <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', gap: '12px', minWidth: 0}}>
                    <div style={{flexShrink: 0, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'}}>
                      <div style={{
                        justifyContent: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        color: 'var(--Text-Light-grey, #BDC3C2)', 
                        fontSize: '14px', 
                        fontFamily: 'Brockmann', 
                        fontWeight: '400', 
                        lineHeight: '20px', 
                        wordWrap: 'break-word'
                      }}>Current Turn:</div>
                    </div>
                    <div
                      title={currentTurnPlayer?.participant_name || 'Unknown'}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'var(--Text-Primary, #FCFFFF)',
                        fontSize: '14px',
                        fontFamily: 'Brockmann',
                        fontWeight: '500',
                        lineHeight: '20px',
                        textAlign: 'right',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >{currentTurnPlayer?.participant_name || 'Unknown'}</div>
                  </div>
                </div>
                {!isMyTurn && draftHasStarted && (
                  <div style={{
                    width: '100%', 
                    height: '100%', 
                    paddingTop: '22px', 
                    paddingBottom: '24px', 
                    paddingLeft: '24px', 
                    paddingRight: '24px', 
                    background: 'var(--UI-Primary, #1D1D1F)', 
                    borderRadius: '8px', 
                    outline: '1px var(--Item-Stroke, #49474B) solid', 
                    outlineOffset: '-1px', 
                    flexDirection: 'column', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start', 
                    display: 'inline-flex'
                  }}>
                    <div style={{
                      alignSelf: 'stretch', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-start', 
                      alignItems: 'center', 
                      gap: '12px', 
                      display: 'flex'
                    }}>
                      <div style={{
                        width: '24px', 
                        padding: '2px', 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '10px', 
                        display: 'flex'
                      }}>
                        <Clock size={20} color="#BDC3C2" />
                      </div>
                      <div style={{
                        alignSelf: 'stretch', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: '4px', 
                        display: 'flex'
                      }}>
                        <div
                          title={currentTurnPlayer?.participant_name ? `Waiting for ${currentTurnPlayer.participant_name}` : undefined}
                          style={{
                            alignSelf: 'stretch',
                            textAlign: 'center',
                            justifyContent: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            color: 'var(--Text-Primary, #FCFFFF)',
                            fontSize: '16px',
                            fontFamily: 'Brockmann',
                            fontWeight: '600',
                            lineHeight: '24px',
                            letterSpacing: '0.32px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            paddingLeft: '8px',
                            paddingRight: '8px',
                          }}
                        >
                          Waiting for {currentTurnPlayer?.participant_name}
                        </div>
                        <div style={{
                          alignSelf: 'stretch', 
                          textAlign: 'center', 
                          justifyContent: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          color: 'var(--Text-Light-grey, #BDC3C2)', 
                          fontSize: '14px', 
                          fontFamily: 'Brockmann', 
                          fontWeight: '400', 
                          lineHeight: '20px', 
                          wordWrap: 'break-word'
                        }}>
                          It's their turn to make a pick
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isMyTurn && (
                  <div style={{width: '100%', height: '100%', padding: '24px', background: 'var(--Purple-800, #25015E)', borderRadius: '8px', outline: '3px var(--Purple-500, #680AFF) solid', outlineOffset: '-3px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '12px', display: 'flex'}}>
                      <div style={{width: '24px', height: '24px', padding: '2px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', display: 'flex'}}>
                        <Film size={24} color="#FFD60A" />
                      </div>
                      <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: '3px', display: 'flex'}}>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '16px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '24px', letterSpacing: '0.32px', wordWrap: 'break-word'}}>It's Your Turn!</div>
                        <div style={{alignSelf: 'stretch', textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Text-Primary, #FCFFFF)', fontSize: '14px', fontFamily: 'Brockmann', fontWeight: '400', lineHeight: '20px', wordWrap: 'break-word'}}>Make your next pick to your movie roster</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
                )}
              </>
            )}
          </div>

          {/* Unified participants container with background treatment */}
          <div style={{
            flex: '1 1 0',
            minWidth: '342px',
            height: '100%', 
            padding: '24px', 
            background: 'var(--Section-Container, #0E0E0F)', 
            boxShadow: 'var(--shadow-card-glow)', 
            borderRadius: 'var(--radius-card)', 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: '24px', 
            display: 'inline-flex'
          }}>
            {inviteView && <InviteRowView invite={inviteView} />}
            
            {/* Participants section */}
            <div style={{
              width: '100%',
              height: '100%',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: '16px',
              display: 'inline-flex',
            }}>
              <div
                data-show-icons="true"
                style={{
                  alignSelf: 'stretch',
                  height: '28px',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'inline-flex',
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  padding: '2px',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px',
                  display: 'inline-flex',
                  color: 'var(--Text-Purple, #907AFF)',
                }}>
                  <MultiPersonIcon className="w-6 h-6" />
                </div>
                <div style={{
                  flex: '1 1 0',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '20px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '28px',
                  wordWrap: 'break-word',
                }}>
                  <span>Participants</span>
                </div>
              </div>

              <div style={{
                alignSelf: 'stretch',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                gap: '18px',
                display: 'inline-flex',
                flexWrap: 'wrap',
                alignContent: 'flex-start',
              }}>
                {getParticipantsSortedByCreatedAt.map((participant) => (
                  <LobbyTile
                    key={participant.id}
                    p={participant}
                    isMe={isMe(participant)}
                    online={participant.online ?? isParticipantOnline(participant, presenceNowMs)}
                    showReady={showReadyFor(participant)}
                    inCheck={ready?.inCheck}
                    wrapIdentity={wrapIdentity}
                    actions={renderTileActions?.(participant)}
                  />
                ))}
                {Array.from({ length: emptySeats }).map((_, i) => (
                  <OpenSeat key={`open-seat-${i}`} onOpen={onOpenSeat} />
                ))}
              </div>

              {notice && (
                <div
                  role="status"
                  className="flex items-start gap-2 self-stretch rounded-[2px] border border-[#49474B] bg-[#1D1D1F] px-3 py-2.5"
                >
                  <Info size={16} className="mt-0.5 shrink-0 text-[#907AFF]" aria-hidden />
                  <p className="m-0 font-brockmann text-sm leading-5 text-[#BDC3C2]">{notice}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* The call to action sits under the cards, in the same place for every draft and every state */}
        {heroNode}
    </>
  );
}
