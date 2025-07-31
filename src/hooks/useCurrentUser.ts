import { useAuth } from '@/contexts/AuthContext';
import { useGuestSession } from './useGuestSession';

/**
 * Unified user hook that provides a single participant ID for both authenticated users and guests
 * This hook simplifies authentication logic across the application by providing:
 * - A single getCurrentUserId() function that works for both user types
 * - A single participantId that can be used consistently throughout the app
 * - Unified loading states
 */
export const useCurrentUser = () => {
  const { user } = useAuth();
  const { guestSession, loading: guestLoading } = useGuestSession();

  const getCurrentUserId = (): string | null => {
    // Always prioritize authenticated user ID over guest session
    if (user?.id) {
      return user.id;
    }
    if (guestSession?.id) {
      return guestSession.id;
    }
    return null;
  };

  const participantId = getCurrentUserId();
  const isAuthenticated = !!user;
  const isGuest = !!guestSession && !user;
  const loading = guestLoading;

  return {
    participantId,
    isAuthenticated,
    isGuest,
    loading,
    getCurrentUserId,
    // Legacy support - keep these for backward compatibility during transition
    user,
    guestSession
  };
};
