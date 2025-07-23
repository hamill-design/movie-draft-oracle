
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export interface GuestSession {
  id: string;
  created_at: string;
  expires_at: string;
  last_active: string;
}

export const useGuestSession = (user: User | null = null) => {
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [loading, setLoading] = useState(true);

  const createGuestSession = async (): Promise<GuestSession> => {
    const { data, error } = await supabase
      .from('guest_sessions')
      .insert({})
      .select()
      .single();

    if (error) {
      console.error('Error creating guest session:', error);
      throw error;
    }

    const session = data as GuestSession;
    localStorage.setItem('guest_session_id', session.id);
    setGuestSession(session);
    return session;
  };

  const updateGuestSessionActivity = async (sessionId: string) => {
    await supabase
      .from('guest_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('id', sessionId);
  };

  const getOrCreateGuestSession = async (): Promise<GuestSession> => {
    const storedSessionId = localStorage.getItem('guest_session_id');
    
    if (storedSessionId) {
      // Check if session still exists and is valid
      const { data, error } = await supabase
        .from('guest_sessions')
        .select('*')
        .eq('id', storedSessionId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!error && data) {
        const session = data as GuestSession;
        setGuestSession(session);
        // Update activity
        await updateGuestSessionActivity(session.id);
        return session;
      }
    }

    // Create new session if none exists or expired
    return await createGuestSession();
  };

  const clearGuestSession = useCallback(() => {
    localStorage.removeItem('guest_session_id');
    setGuestSession(null);
  }, []);

  const migrateGuestDraftsToUser = useCallback(async () => {
    if (!guestSession) return;

    try {
      const { error } = await supabase.rpc('migrate_guest_drafts_to_user', {
        p_guest_session_id: guestSession.id
      });

      if (error) {
        console.error('Error migrating guest drafts:', error);
        throw error;
      }

      // Clear guest session after successful migration
      clearGuestSession();
    } catch (error) {
      console.error('Failed to migrate guest drafts:', error);
      throw error;
    }
  }, [guestSession, clearGuestSession]);

  useEffect(() => {
    const initializeGuestSession = async () => {
      try {
        // Skip guest session initialization if user is authenticated
        if (user) {
          setLoading(false);
          return;
        }

        await getOrCreateGuestSession();
      } catch (error) {
        console.error('Failed to initialize guest session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeGuestSession();
  }, [user]);

  return {
    guestSession,
    loading,
    createGuestSession,
    getOrCreateGuestSession,
    clearGuestSession,
    migrateGuestDraftsToUser,
    updateGuestSessionActivity
  };
};
