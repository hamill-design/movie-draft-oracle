
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGuestSession, GuestSession } from '@/hooks/useGuestSession';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  guestSession: GuestSession | null;
  isGuest: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  migrateGuestDraftsToUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  guestSession: null,
  isGuest: false,
  loading: true,
  signOut: async () => {},
  migrateGuestDraftsToUser: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const {
    guestSession,
    loading: guestLoading,
    migrateGuestDraftsToUser
  } = useGuestSession(user);

  // Only include guest loading if user is not authenticated
  const loading = authLoading || (!user && guestLoading);
  const isGuest = !user && !!guestSession;

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setAuthLoading(false);

        // If user just signed in and we have a guest session, migrate drafts
        if (event === 'SIGNED_IN' && session?.user && guestSession) {
          try {
            await migrateGuestDraftsToUser();
          } catch (error) {
            console.error('Failed to migrate guest drafts on sign in:', error);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [guestSession, migrateGuestDraftsToUser]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    guestSession,
    isGuest,
    loading,
    signOut,
    migrateGuestDraftsToUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
