
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGuestSession, GuestSession } from '@/hooks/useGuestSession';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { getPendingDraft, clearPendingDraft } from '@/utils/draftStorage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  guestSession: GuestSession | null;
  isGuest: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  migrateGuestDraftsToUser: () => Promise<void>;
  getOrCreateGuestSession: () => Promise<GuestSession | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  guestSession: null,
  isGuest: false,
  loading: true,
  signOut: async () => {},
  migrateGuestDraftsToUser: async () => {},
  getOrCreateGuestSession: async () => null,
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
    migrateGuestDraftsToUser,
    getOrCreateGuestSession
  } = useGuestSession(user);

  // Only include guest loading if user is not authenticated
  const loading = authLoading || (!user && guestLoading);
  const isGuest = !user && !!guestSession;

  // Component to handle pending draft processing after login
  const PendingDraftProcessor: React.FC = () => {
    const { saveDraft } = useDraftOperations();
    const [hasProcessed, setHasProcessed] = useState(false);

    useEffect(() => {
      // Only process if user is authenticated and we haven't processed yet
      if (!user || hasProcessed) return;

      const processPendingDraft = async () => {
        const pendingDraft = getPendingDraft();
        if (!pendingDraft) {
          setHasProcessed(true);
          return;
        }

        try {
          console.log('Processing pending draft in AuthContext fallback:', pendingDraft);
          
          // Generate a default title with timestamp if not provided
          const now = new Date();
          const defaultTitle = pendingDraft.draftData.title || 
            `Copy of ${pendingDraft.draftData.option || 'Draft'} - ${now.toLocaleDateString()}`;
          
          // Save the draft
          await saveDraft({
            title: defaultTitle,
            ...pendingDraft.draftData,
          });

          // Clear the pending draft
          clearPendingDraft();
          setHasProcessed(true);
          
          console.log('Successfully processed pending draft in AuthContext');
        } catch (error) {
          console.error('Failed to process pending draft in AuthContext:', error);
          // Don't set hasProcessed to true on error - might want to retry
        }
      };

      // Wait a bit for migration to complete, then check for pending drafts
      const timer = setTimeout(() => {
        processPendingDraft();
      }, 1000); // 1 second delay to allow migration to complete

      return () => clearTimeout(timer);
    }, [user, hasProcessed, saveDraft]);

    return null; // This component doesn't render anything
  };

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
  }, []); // Remove guestSession dependency to prevent loops

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
    getOrCreateGuestSession: async () => {
      try {
        return await getOrCreateGuestSession();
      } catch {
        return null;
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      <PendingDraftProcessor />
      {children}
    </AuthContext.Provider>
  );
};
