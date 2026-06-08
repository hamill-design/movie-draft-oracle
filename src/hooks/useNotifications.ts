import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'draft_invite' | 'league_invite' | 'upcoming_draft';
  title: string;
  body: string | null;
  link: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); setLoading(false); return; }

    const { data, error } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setNotifications(data as AppNotification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); setLoading(false); return; }

    fetchNotifications();

    channelRef.current = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as AppNotification, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev =>
          prev.map(n => n.id === (payload.new as AppNotification).id ? payload.new as AppNotification : n)
        );
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== (payload.old as AppNotification).id));
      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  }, [user]);

  // Filter out upcoming_draft notifications whose scheduled time has passed
  const visibleNotifications = notifications.filter(n => {
    if (n.type === 'upcoming_draft') {
      const scheduledAt = n.metadata?.scheduled_at as string | undefined;
      if (scheduledAt && new Date(scheduledAt) < new Date()) return false;
    }
    return true;
  });

  const unreadCount = visibleNotifications.filter(n => !n.is_read).length;

  return {
    notifications: visibleNotifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
};
