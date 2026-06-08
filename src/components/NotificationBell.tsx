import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Film, Users, CalendarDays } from 'lucide-react';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';

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

// ── Notification item ─────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  draft_invite: {
    Icon: Film,
    iconColor: '#907aff',
    iconBg: 'rgba(144, 122, 255, 0.15)',
  },
  league_invite: {
    Icon: Users,
    iconColor: '#d3cfff',
    iconBg: 'rgba(211, 207, 255, 0.12)',
  },
  upcoming_draft: {
    Icon: CalendarDays,
    iconColor: '#680aff',
    iconBg: 'rgba(104, 10, 255, 0.2)',
  },
};

interface NotificationItemProps {
  notification: AppNotification;
  onAction: (notification: AppNotification) => void;
}

const NotificationItem = ({ notification, onAction }: NotificationItemProps) => {
  const cfg = TYPE_CONFIG[notification.type];
  const soon = notification.type === 'upcoming_draft' && isStartingSoon(notification.metadata);

  return (
    <button
      type="button"
      onClick={() => onAction(notification)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        padding: '12px 16px',
        background: notification.is_read ? 'transparent' : 'rgba(104, 10, 255, 0.1)',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background =
          notification.is_read ? 'transparent' : 'rgba(104, 10, 255, 0.1)';
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: cfg.iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        <cfg.Icon size={16} color={cfg.iconColor} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            color: '#FCFFFF',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.3,
          }}>
            {notification.title}
          </span>
          {soon && (
            <span style={{
              background: 'rgba(255, 120, 50, 0.2)',
              color: '#ff9f60',
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 10,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}>
              STARTING SOON
            </span>
          )}
        </div>
        {notification.body && (
          <div style={{
            color: 'rgba(252, 255, 255, 0.55)',
            fontSize: 12,
            lineHeight: 1.4,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {notification.body}
          </div>
        )}
        <div style={{
          color: 'rgba(252, 255, 255, 0.35)',
          fontSize: 11,
          marginTop: 4,
        }}>
          {timeAgo(notification.created_at)}
        </div>
      </div>

      {/* Unread dot */}
      {!notification.is_read && (
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#680aff',
          flexShrink: 0,
          marginTop: 6,
        }} />
      )}
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleNotificationClick = async (notification: AppNotification) => {
    setOpen(false);
    if (!notification.is_read) await markAsRead(notification.id);

    // For upcoming_draft notifications, navigate to the league page.
    // The league page shows the correct button state:
    //   • If draft_id is set → "Join Draft" button → /draft/:id (the waiting room)
    //   • If not yet opened → admin sees "Open Draft Room", members see details
    if (notification.link) navigate(notification.link);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen(prev => !prev)}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          color: 'rgba(252, 255, 255, 0.7)',
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLButtonElement).style.color = '#FCFFFF';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(252, 255, 255, 0.7)';
          }
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: '#680aff',
            color: '#FCFFFF',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#1a1a1d',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            position: 'sticky',
            top: 0,
            background: '#1a1a1d',
            zIndex: 1,
          }}>
            <span style={{ color: '#FCFFFF', fontSize: 14, fontWeight: 600 }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#907aff',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#d3cfff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#907aff'; }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: 'rgba(252, 255, 255, 0.35)',
              fontSize: 13,
            }}>
              No notifications
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onAction={handleNotificationClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
