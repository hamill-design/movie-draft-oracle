import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'contact@roberthamill.design';

/**
 * Hook to check if the current user has admin access
 * Currently uses email whitelist (contact@roberthamill.design)
 */
export const useAdminAccess = () => {
  const { user, loading } = useAuth();

  const isAdmin = useMemo(() => {
    if (!user || !user.email) return false;
    return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }, [user]);

  return {
    isAdmin,
    adminEmail: ADMIN_EMAIL,
    loading,
    user
  };
};

