/**
 * Legacy redirect — the separate lobby page has been removed.
 * /draft/:id (MultiplayerDraftInterface) is now the lobby/waiting room.
 * Any old links to /league/:leagueId/lobby/:entryId fall back to the league page.
 */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const LeagueDraftLobbyPage = () => {
  const { leagueId, entryId } = useParams<{ leagueId: string; entryId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!entryId || !leagueId) {
      navigate('/', { replace: true });
      return;
    }
    // If a draft has already been created for this entry, go straight to it.
    // Otherwise fall back to the league page where the admin can open the room.
    (async () => {
      const { data } = await (supabase as any)
        .from('league_drafts')
        .select('draft_id')
        .eq('id', entryId)
        .single();
      if (data?.draft_id) {
        navigate(`/draft/${data.draft_id}`, { replace: true });
      } else {
        navigate(`/league/${leagueId}`, { replace: true });
      }
    })();
  }, [entryId, leagueId, navigate]);

  return null;
};

export default LeagueDraftLobbyPage;
