
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGuestSession, GuestSession } from '@/hooks/useGuestSession';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { getPendingDraft, clearPendingDraft } from '@/utils/draftStorage';
import { uploadPendingAvatar } from '@/utils/avatarUpload';
import {
  MARKETING_AUDIENCE_SYNC_LS_PREFIX,
  syncMarketingAudience,
} from '@/lib/marketingAudienceSync';

/** Legacy per-tab keys (no longer written; cleared on sign-out). */
const MARKETING_SYNC_SESSION_LEGACY_PREFIX = 'md_ma_sync_';

function clearMarketingSyncFlags() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(MARKETING_SYNC_SESSION_LEGACY_PREFIX)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(MARKETING_AUDIENCE_SYNC_LS_PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

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

// Rendered inside BrowserRouter (see App.tsx) so it can both read auth state
// (context from the ancestor AuthProvider) and navigate. This is the fallback
// path for OAuth sign-ins (e.g. Google): the redirect round-trip to the
// provider drops any in-page returnTo/saveDraft state, but the pending draft
// stashed in localStorage beforehand (see FinalScores.tsx handleAuthRedirect)
// survives it, including where to send the user back to.
export const PendingDraftProcessor: React.FC = () => {
  const { user } = useAuth();
  const { saveDraft } = useDraftOperations();
  const navigate = useNavigate();
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

        // Send the user back to where they started the save (e.g. the
        // final-scores page), instead of leaving them on the OAuth landing page.
        if (pendingDraft.returnPath) {
          navigate(pendingDraft.returnPath, { replace: true });
        }
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
  }, [user, hasProcessed, saveDraft, navigate]);

  return null; // This component doesn't render anything
};

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

  const PendingAvatarProcessor: React.FC = () => {
    const [hasProcessed, setHasProcessed] = useState(false);

    useEffect(() => {
      if (!user || hasProcessed) return;
      setHasProcessed(true);
      uploadPendingAvatar(user.id).catch(() => {});
    }, [user, hasProcessed]);

    return null;
  };

  const MarketingAudienceSync: React.FC<{ user: User | null }> = ({ user }) => {
    useEffect(() => {
      if (!user?.id || !user.email_confirmed_at) return;

      (async () => {
        try {
          await syncMarketingAudience();
        } catch (e) {
          console.warn('Marketing audience sync failed:', e);
        }
      })();
    }, [user?.id, user?.email_confirmed_at]);

    return null;
  };

  useEffect(() => {
    let initialCheckResolved = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        initialCheckResolved = true;
        setSession(session);
        setUser(session?.user ?? null);
        setAuthLoading(false);

        if (event === 'SIGNED_OUT') {
          clearMarketingSyncFlags();
        }

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
      initialCheckResolved = true;
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Supabase holds an internal lock while checking/refreshing a saved
    // session. On a flaky mobile connection that refresh can hang forever
    // and never release the lock, leaving the checks above unresolved. Fall
    // back to "logged out for now" so the app doesn't get stuck loading.
    //
    // Right after an OAuth or email-link redirect (e.g. Google sign-in),
    // detectSessionInUrl has to exchange the code/token in the URL for a
    // session before the checks above resolve — on a slow connection that
    // can take longer than the usual 5s, and firing the "logged out"
    // fallback mid-exchange makes a successful sign-in look like a failed
    // one. Give that case more time.
    const isAuthRedirect =
      new URLSearchParams(window.location.search).has('code') ||
      /access_token=/.test(window.location.hash);
    const timeoutId = setTimeout(() => {
      if (!initialCheckResolved) {
        setAuthLoading(false);
      }
    }, isAuthRedirect ? 15000 : 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []); // Remove guestSession dependency to prevent loops

  const signOut = async () => {
    clearMarketingSyncFlags();
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
      <PendingAvatarProcessor />
      <MarketingAudienceSync user={user} />
      {children}
    </AuthContext.Provider>
  );
};
