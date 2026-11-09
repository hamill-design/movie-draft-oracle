import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { publicPlayApi } from '@/lib/publicPlayApi';

/**
 * Quick Play, the one button: join an open game if there is one, otherwise open a lobby of your own so the
 * next person to press it lands in yours. It never ends in "no games": you always end up in a lobby.
 * Shared by the homepage and the Play page.
 */
export function useQuickPlay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  /** Resolves true once it has sent the player to a lobby, false if it couldn't (a message is shown). */
  const quickPlay = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return true;
    inFlight.current = true;
    setBusy(true);
    try {
      const joined = await publicPlayApi.quickJoin();
      if (joined.found && joined.draft_id) {
        navigate(`/draft/${joined.draft_id}`);
        return true;
      }
      const started = await publicPlayApi.quickStart();
      navigate(`/draft/${started.draft_id}`);
      return true;
    } catch (err) {
      toast({
        title: "Couldn't start Quick Play",
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [navigate, toast]);

  return { busy, quickPlay };
}
