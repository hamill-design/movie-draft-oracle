import { useNavigate } from 'react-router-dom';
import { usePublicPlayAccess } from '@/hooks/usePublicPlayAvailable';
import { useQuickPlay } from '@/hooks/useQuickPlay';
import { useSignInPrompt } from '@/components/play/SignInPrompt';

/**
 * What the homepage's Quick Play button does, shared by the big button under the headline and the band lower down.
 *
 * - A guest (signed out): the prompt asks them to sign in or create an account, then brings them back to Quick Play.
 * - A signed-in player with a name: goes straight into a lobby.
 * - A signed-in player who still has to choose a name: goes to the Play page, which asks and then carries on.
 */
export function useHomeQuickPlay() {
  const navigate = useNavigate();
  const access = usePublicPlayAccess();
  const { busy, quickPlay } = useQuickPlay();
  const { ask, prompt } = useSignInPrompt();

  const guest = !access.signedIn;
  const direct = access.signedIn && access.hasName;

  const onQuickPlay = () => {
    if (guest) ask({ reason: 'quick-play', returnTo: '/play?quick=play' });
    else if (direct) void quickPlay();
    else navigate('/play?quick=play');
  };

  return { access, ask, prompt, busy, guest, direct, onQuickPlay };
}
