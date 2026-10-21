import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLeagueMembers, useUserLeagues } from '@/hooks/useLeagues';

/**
 * League state for the draft setup pages. `?league=<id>` (the league page's
 * "Start New Draft") starts with the toggle on and that league selected; from
 * anywhere else it starts off and the user can turn it on themselves.
 */
export const useLeagueSetup = () => {
  const [searchParams] = useSearchParams();
  const leagueParam = searchParams.get('league');
  const { user } = useAuth();
  const { leagues, loading: leaguesLoading } = useUserLeagues();

  const [enabled, setEnabled] = useState(!!leagueParam);
  const [leagueId, setLeagueId] = useState<string | null>(leagueParam);

  // Auto-select when there's only one league to choose from, and drop a
  // `?league=` that isn't one of the user's leagues. Guarded on `leagues.length`
  // so the brief empty list before sign-in finishes never clears a valid league.
  useEffect(() => {
    if (!user || leaguesLoading || leagues.length === 0) return;
    const valid = leagueId !== null && leagues.some((l) => l.id === leagueId);
    if (valid) return;
    setLeagueId(leagues.length === 1 && enabled ? leagues[0].id : null);
  }, [user, leaguesLoading, leagues, leagueId, enabled]);

  const league = useMemo(
    () => (enabled ? leagues.find((l) => l.id === leagueId) ?? null : null),
    [enabled, leagues, leagueId],
  );

  const { members: fetchedMembers } = useLeagueMembers(league?.id);
  const members = useMemo(
    () => (league ? fetchedMembers.filter((m) => m.league_id === league.id) : []),
    [league, fetchedMembers],
  );

  return {
    leagues,
    leaguesLoading,
    enabled,
    setEnabled,
    leagueId,
    setLeagueId,
    /** The selected league, only while the toggle is on. */
    league,
    members,
  };
};

export type LeagueSetup = ReturnType<typeof useLeagueSetup>;
