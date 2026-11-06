import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { publicPlayApi, type PublicPlayStatus } from '@/lib/publicPlayApi';

/**
 * Whether the signed-in person may use public play, and what they still need (a display name).
 * `installed` is false until the public-play migrations are applied to the database, in which case
 * the app should show nothing about public play.
 */
export function usePublicPlay() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<PublicPlayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await publicPlayApi.statusWithName();
      setStatus(s);
      setInstalled(true);
    } catch {
      setStatus(null);
      setInstalled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    void refresh();
  }, [authLoading, user?.id, refresh]);

  return { status, loading, installed, refresh };
}
