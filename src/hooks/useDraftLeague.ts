import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLeagueMembers } from '@/hooks/useLeagues';

export interface LeaguePerson {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * The league a draft belongs to (if any) and its members, so the invite window can offer them.
 * Only looks when `enabled` (the host of a draft that hasn't started).
 */
export function useDraftLeague(draftId?: string | null, enabled = true) {
  const [league, setLeague] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setLeague(null);
    if (!draftId || !enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: link } = await supabase.from('league_drafts').select('league_id').eq('draft_id', draftId).maybeSingle();
        const leagueId = (link as { league_id?: string } | null)?.league_id;
        if (!leagueId || cancelled) return;
        const { data: row } = await supabase.from('leagues').select('id, name').eq('id', leagueId).maybeSingle();
        if (!cancelled && row) setLeague({ id: (row as any).id, name: (row as any).name });
      } catch {
        // No league (or none we can read): the invite window just has no league section.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, enabled]);

  const { members } = useLeagueMembers(league?.id);
  const people: LeaguePerson[] = league
    ? members
        .filter((m) => m.league_id === league.id && !!m.profile?.email)
        .map((m) => ({
          userId: m.user_id,
          name: m.profile?.name || (m.profile?.email as string),
          email: m.profile?.email as string,
          avatarUrl: m.profile?.avatar_url ?? null,
        }))
    : [];

  return { league, people };
}
