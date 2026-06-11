import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, Film, User } from 'lucide-react';
import { TrophyIcon } from '@/components/icons/TrophyIcon';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { useLeagueActions, usePendingLeagueInvites, type LeagueInvite } from '@/hooks/useLeagues';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import { resolveYearDraftIconSrc } from '@/lib/yearDraftIcon';
import { cn, getCleanActorName } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isStartingSoon(metadata: Record<string, unknown>): boolean {
  const scheduledAt = metadata?.scheduled_at as string | undefined;
  if (!scheduledAt) return false;
  const diff = new Date(scheduledAt).getTime() - Date.now();
  return diff > 0 && diff < 60 * 60 * 1000;
}

function leagueSubtitle(notification: AppNotification, invite?: LeagueInvite): string {
  if (invite?.league?.name) return invite.league.name;
  const body = notification.body ?? '';
  const marker = ' invited you to ';
  const idx = body.lastIndexOf(marker);
  if (idx >= 0) return body.slice(idx + marker.length).trim();
  return body;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DraftMeta = { theme: string; option: string | null; title: string | null };

type NotificationEnrichment = {
  drafts: Map<string, DraftMeta>;
  specPhotos: Map<string, string | null>;
};

function LeagueTrophyThumbnail() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3B0394]">
      <TrophyIcon className="h-5 w-5 shrink-0" style={{ color: '#BCB2FF' }} aria-hidden />
    </div>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function NotificationThumbnail({
  notification,
  draftMeta,
  specPhoto,
}: {
  notification: AppNotification;
  draftMeta?: DraftMeta;
  specPhoto?: string | null;
}) {
  const shell = 'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full';

  if (notification.type === 'league_invite') {
    return <LeagueTrophyThumbnail />;
  }

  if (notification.type === 'draft_invite') {
    const theme = draftMeta?.theme ?? '';
    const option = draftMeta?.option ?? '';
    const label = draftMeta?.title ?? notification.body ?? '';
    const displayLabel = option || label || notification.body || '';

    if (theme === 'year' || (!theme && resolveYearDraftIconSrc(displayLabel))) {
      const yearSrc = resolveYearDraftIconSrc(theme === 'year' ? (option || label) : displayLabel);
      if (yearSrc) {
        return (
          <div className={cn(shell, 'rounded-[4px] bg-transparent')}>
            <img src={yearSrc} alt="" className="h-full w-full object-contain p-0.5" draggable={false} />
          </div>
        );
      }
    }

    if (theme === 'spec-draft' && specPhoto) {
      return (
        <img
          src={specPhoto}
          alt=""
          className={cn(shell, 'rounded-[4px] object-cover')}
        />
      );
    }

    const actorName = getCleanActorName(
      theme === 'people' || theme === 'filmography' ? (option || label) : displayLabel,
    );
    if (
      actorName
      && (theme === 'people' || theme === 'filmography' || (!theme && !UUID_RE.test(displayLabel)))
    ) {
      return (
        <DraftActorPortrait
          actorName={actorName}
          size="sm"
          className="h-9 w-9 rounded-full object-cover"
        />
      );
    }

    return (
      <div className={cn(shell, 'bg-[#3B2050]')}>
        <Film className="h-4 w-4 text-[#907AFF]" aria-hidden />
      </div>
    );
  }

  if (notification.type === 'upcoming_draft') {
    return (
      <div className={cn(shell, 'bg-[#3B2050]')}>
        <CalendarDays className="h-4 w-4 text-[#907AFF]" aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn(shell, 'bg-[#3B2050]')}>
      <User className="h-4 w-4 text-[#907AFF]" aria-hidden />
    </div>
  );
}

function itemBackground(isRead: boolean, hovered: boolean): string {
  if (hovered) return '#252528';
  return isRead ? '#1D1D1F' : '#160038';
}

// ── Notification item ─────────────────────────────────────────────────────────

type InviteActionState = 'pending' | 'accepted' | 'declined' | undefined;

interface NotificationItemProps {
  notification: AppNotification;
  onAction: (notification: AppNotification) => void;
  invite?: LeagueInvite;
  draftMeta?: DraftMeta;
  specPhoto?: string | null;
  inviteState?: InviteActionState;
  inviteLoading?: 'accept' | 'decline' | null;
  onAcceptInvite?: (e: React.MouseEvent) => void;
  onDeclineInvite?: (e: React.MouseEvent) => void;
}

const NotificationItem = ({
  notification,
  onAction,
  invite,
  draftMeta,
  specPhoto,
  inviteState,
  inviteLoading,
  onAcceptInvite,
  onDeclineInvite,
}: NotificationItemProps) => {
  const [hovered, setHovered] = useState(false);
  const soon = notification.type === 'upcoming_draft' && isStartingSoon(notification.metadata);
  const showInviteActions = inviteState === 'pending';

  const subtitle =
    notification.type === 'league_invite'
      ? leagueSubtitle(notification, invite)
      : notification.type === 'draft_invite'
        ? (notification.body ?? draftMeta?.title ?? '')
        : notification.body ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAction(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAction(notification);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full cursor-pointer items-start gap-3 px-4 pb-4 pt-3 text-left font-brockmann transition-colors"
      style={{ background: itemBackground(notification.is_read, hovered) }}
    >
      <div className="flex shrink-0 items-center py-0.5">
        <NotificationThumbnail
          notification={notification}
          draftMeta={draftMeta}
          specPhoto={specPhoto}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-normal leading-5 text-[#FCFFFF]">
                {notification.title}
              </span>
              {soon && (
                <span className="whitespace-nowrap rounded-full bg-[rgba(255,120,50,0.2)] px-1.5 py-px text-[10px] font-semibold tracking-wide text-[#ff9f60]">
                  STARTING SOON
                </span>
              )}
            </div>
            {subtitle && (
              <div className="mt-0.5 text-xs font-semibold leading-4 text-[#907AFF]">
                {subtitle}
              </div>
            )}
          </div>
          {!notification.is_read && (
            <div
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#7142FF]"
              aria-hidden
            />
          )}
        </div>

        <div className="mt-1 pt-px text-xs font-normal leading-4 tracking-[0.36px] text-[#BDC3C2]">
          {timeAgo(notification.created_at)}
        </div>

        {showInviteActions && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={!!inviteLoading}
              onClick={onAcceptInvite}
              className="inline-flex flex-1 items-center justify-center rounded-[2px] bg-[#7142FF] px-[18px] py-2 text-sm font-medium leading-5 text-[#FCFFFF] transition-colors hover:bg-[#6338e0] disabled:pointer-events-none disabled:opacity-60"
            >
              {inviteLoading === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              disabled={!!inviteLoading}
              onClick={onDeclineInvite}
              className="inline-flex flex-1 items-center justify-center rounded-[2px] bg-[#1D1D1F] px-[18px] py-2 text-sm font-medium leading-5 text-[#FCFFFF] outline outline-1 -outline-offset-1 outline-[#666469] transition-colors hover:bg-[#252528] disabled:pointer-events-none disabled:opacity-60"
            >
              {inviteLoading === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
        )}

        {inviteState === 'accepted' && (
          <div className="mt-2 text-xs font-semibold text-[#9ee6a8]">✓ Joined</div>
        )}
        {inviteState === 'declined' && (
          <div className="mt-2 text-xs text-[#BDC3C2]/70">Invite declined</div>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { acceptInvite, declineInvite } = useLeagueActions();
  const { invites: pendingInvites, refetch: refetchPendingInvites } = usePendingLeagueInvites();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [enrichment, setEnrichment] = useState<NotificationEnrichment>({
    drafts: new Map(),
    specPhotos: new Map(),
  });

  const [inviteResults, setInviteResults] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [loadingInvite, setLoadingInvite] = useState<{ id: string; action: 'accept' | 'decline' } | null>(null);

  const inviteByLeagueId = useMemo(() => {
    const map = new Map<string, LeagueInvite>();
    for (const inv of pendingInvites) map.set(inv.league_id, inv);
    return map;
  }, [pendingInvites]);

  useEffect(() => {
    const draftIds = [
      ...new Set(
        notifications
          .filter((n) => n.type === 'draft_invite' && n.reference_id)
          .map((n) => n.reference_id as string),
      ),
    ];

    if (draftIds.length === 0) return;

    let cancelled = false;

    (async () => {
      const drafts = new Map<string, DraftMeta>();
      const specPhotos = new Map<string, string | null>();

      const { data: draftRows } = await supabase
        .from('drafts')
        .select('id, theme, option, title')
        .in('id', draftIds);

      const specIds: string[] = [];
      for (const row of draftRows ?? []) {
        const r = row as { id: string; theme: string; option: string | null; title: string | null };
        drafts.set(r.id, { theme: r.theme, option: r.option, title: r.title });
        if (r.theme === 'spec-draft' && r.option && UUID_RE.test(r.option)) {
          specIds.push(r.option);
        }
      }

      if (specIds.length > 0) {
        const { data: specRows } = await supabase
          .from('spec_drafts' as never)
          .select('id, photo_url')
          .in('id', specIds);
        for (const row of specRows ?? []) {
          const r = row as { id: string; photo_url: string | null };
          specPhotos.set(r.id, r.photo_url);
        }
      }

      if (!cancelled) {
        setEnrichment({ drafts, specPhotos });
      }
    })();

    return () => { cancelled = true; };
  }, [notifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleNotificationClick = async (notification: AppNotification) => {
    if (notification.type === 'league_invite' && inviteByLeagueId.has(notification.reference_id ?? '')) {
      return;
    }
    setOpen(false);
    if (!notification.is_read) await markAsRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  const handleAcceptInvite = async (
    e: React.MouseEvent, notification: AppNotification, invite: LeagueInvite,
  ) => {
    e.stopPropagation();
    if (loadingInvite) return;
    setLoadingInvite({ id: notification.id, action: 'accept' });
    const acceptedLeagueId = await acceptInvite(invite.id);
    setLoadingInvite(null);
    if (acceptedLeagueId) {
      setInviteResults((prev) => ({ ...prev, [notification.id]: 'accepted' }));
      if (!notification.is_read) markAsRead(notification.id);
      refetchPendingInvites();
      toast({ title: `Joined ${invite.league?.name ?? 'the league'}!` });
    } else {
      toast({ title: 'Could not accept invite', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDeclineInvite = async (
    e: React.MouseEvent, notification: AppNotification, invite: LeagueInvite,
  ) => {
    e.stopPropagation();
    if (loadingInvite) return;
    setLoadingInvite({ id: notification.id, action: 'decline' });
    const ok = await declineInvite(invite.id);
    setLoadingInvite(null);
    if (ok) {
      setInviteResults((prev) => ({ ...prev, [notification.id]: 'declined' }));
      if (!notification.is_read) markAsRead(notification.id);
      refetchPendingInvites();
    } else {
      toast({ title: 'Could not decline invite', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-none transition-colors',
          open ? 'bg-white/[0.08] text-[#FCFFFF]' : 'bg-transparent text-white/70 hover:bg-white/[0.07] hover:text-[#FCFFFF]',
        )}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#680aff] px-1 text-[10px] font-bold leading-none text-[#FCFFFF]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-[100] flex max-h-[420px] w-[340px] flex-col gap-0.5 overflow-y-auto rounded-xl font-brockmann outline outline-2 -outline-offset-2 outline-[#0E0E0F]"
          style={{
            background: '#0E0E0F',
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.50)',
          }}
        >
          <div className="flex items-center justify-between bg-[#1D1D1F] px-4 pb-3 pt-3.5">
            <span className="text-sm font-medium leading-5 text-[#FCFFFF]">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded px-1 py-0.5 text-xs text-[#907AFF] transition-colors hover:text-[#d3cfff]"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[#BDC3C2]/50">
              No notifications
            </div>
          ) : (
            notifications.map((n) => {
              const invite = n.type === 'league_invite' && n.reference_id
                ? inviteByLeagueId.get(n.reference_id)
                : undefined;
              const inviteState: InviteActionState =
                inviteResults[n.id] ?? (invite ? 'pending' : undefined);
              const draftMeta = n.reference_id ? enrichment.drafts.get(n.reference_id) : undefined;
              const specPhoto =
                draftMeta?.theme === 'spec-draft' && draftMeta.option
                  ? enrichment.specPhotos.get(draftMeta.option) ?? null
                  : null;

              return (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  invite={invite}
                  draftMeta={draftMeta}
                  specPhoto={specPhoto}
                  onAction={handleNotificationClick}
                  inviteState={inviteState}
                  inviteLoading={loadingInvite?.id === n.id ? loadingInvite.action : null}
                  onAcceptInvite={invite ? (e) => handleAcceptInvite(e, n, invite) : undefined}
                  onDeclineInvite={invite ? (e) => handleDeclineInvite(e, n, invite) : undefined}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
