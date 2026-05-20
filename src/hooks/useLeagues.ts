import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────

export interface League {
  id: string;
  name: string;
  slug: string;
  admin_id: string;
  created_at: string;
  updated_at: string;
  /** Filled by useUserLeagues when available */
  member_count?: number;
  draft_count?: number;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: {
    name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

export interface LeagueInvite {
  id: string;
  league_id: string;
  invited_by: string;
  invited_email: string | null;
  invited_user_id: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
  league?: { name: string };
  inviter?: { name: string | null };
}

export interface LeagueStanding {
  league_id: string;
  user_id: string;
  display_name: string | null;
  photo_url: string | null;
  draft_count: number;
  total_score: number;
  rank: number;
}

export interface LeagueSeasonStanding extends LeagueStanding {
  season_id: string;
}

export interface LeagueDraftEntry {
  id: string;
  league_id: string;
  draft_id: string | null;
  season_id: string | null;
  scheduled_at: string | null;
  draft_type: string | null;
  theme: string | null;
  categories: string[];
  notes: string | null;
  added_at: string;
  draft?: {
    id: string;
    title: string;
    theme: string;
    is_complete: boolean;
    created_at: string;
    calculated_score: number | null;
    user_id: string;
    option?: string;
    is_multiplayer?: boolean | null;
    categories?: string[] | null;
  };
}

export interface LeagueSeason {
  id: string;
  league_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface LeagueMessage {
  id: string;
  league_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    name: string | null;
    avatar_url: string | null;
  };
}

// ── User's leagues ───────────────────────────────────────────────────────────

export const useUserLeagues = () => {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeagues = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('league_members')
      .select(
        `
        league_id,
        joined_at,
        leagues (
          id,
          name,
          slug,
          admin_id,
          created_at,
          updated_at,
          league_members (count),
          league_drafts (count)
        )
      `,
      )
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (!error && data) {
      setLeagues(
        data
          .map((row: any) => {
            const L = row.leagues;
            if (!L) return null;
            const nestedMembers = L.league_members;
            const nestedDrafts = L.league_drafts;
            const member_count =
              Array.isArray(nestedMembers) && nestedMembers[0] && 'count' in nestedMembers[0]
                ? Number(nestedMembers[0].count)
                : 0;
            const draft_count =
              Array.isArray(nestedDrafts) && nestedDrafts[0] && 'count' in nestedDrafts[0]
                ? Number(nestedDrafts[0].count)
                : 0;
            const { league_members: _lm, league_drafts: _ld, ...rest } = L;
            return { ...rest, member_count, draft_count } as League;
          })
          .filter(Boolean) as League[],
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);
  return { leagues, loading, refetch: fetchLeagues };
};

// ── Single league ────────────────────────────────────────────────────────────

export const useLeague = (leagueId: string | undefined) => {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!leagueId) return;
    const { data } = await supabase.from('leagues').select('*').eq('id', leagueId).maybeSingle();
    setLeague(data ?? null);
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) {
      setLeague(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setLeague(data ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  return { league, loading, refetch };
};

// ── League members ───────────────────────────────────────────────────────────

export const useLeagueMembers = (leagueId: string | undefined) => {
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!leagueId) { setLoading(false); return; }

    // Fetch members without an embedded join — avoids INNER JOIN filtering
    // out members whose profiles can't be read under the old RLS policy.
    const { data: memberRows, error } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true });

    if (error || !memberRows) { setLoading(false); return; }

    // Separately fetch profiles for all member user_ids.
    const userIds = memberRows.map((m: any) => m.user_id as string);
    let profileMap: Record<string, { name: string | null; avatar_url: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, email')
        .in('id', userIds);
      if (profileData) {
        profileMap = Object.fromEntries(
          (profileData as any[]).map((p) => [p.id, { name: p.name, avatar_url: p.avatar_url, email: p.email }])
        );
      }
    }

    const merged = memberRows.map((m: any) => ({
      ...m,
      profile: profileMap[m.user_id] ?? null,
    }));

    setMembers(merged as unknown as LeagueMember[]);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return;
    fetchMembers();

    channelRef.current = supabase
      .channel(`league_members:${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'league_members',
        filter: `league_id=eq.${leagueId}`,
      }, () => { fetchMembers(); })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [leagueId, fetchMembers]);

  return { members, loading, refetch: fetchMembers };
};

// ── All-time standings ───────────────────────────────────────────────────────

export const useLeagueStandings = (leagueId: string | undefined) => {
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) { setLoading(false); return; }
    supabase.from('league_standings').select('*').eq('league_id', leagueId)
      .order('rank', { ascending: true })
      .then(({ data }) => {
        setStandings((data as unknown as LeagueStanding[]) ?? []);
        setLoading(false);
      });
  }, [leagueId]);

  return { standings, loading };
};

// ── Season standings ─────────────────────────────────────────────────────────

export const useLeagueSeasonStandings = (leagueId: string | undefined, seasonId: string | undefined) => {
  const [standings, setStandings] = useState<LeagueSeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !seasonId) { setStandings([]); setLoading(false); return; }
    setLoading(true);
    supabase.from('league_season_standings').select('*')
      .eq('league_id', leagueId)
      .eq('season_id', seasonId)
      .order('rank', { ascending: true })
      .then(({ data }) => {
        setStandings((data as unknown as LeagueSeasonStanding[]) ?? []);
        setLoading(false);
      });
  }, [leagueId, seasonId]);

  return { standings, loading };
};

// ── Seasons ──────────────────────────────────────────────────────────────────

export const useLeagueSeasons = (leagueId: string | undefined) => {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSeasons = useCallback(async () => {
    if (!leagueId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('league_seasons')
      .select('*')
      .eq('league_id', leagueId)
      .order('starts_at', { ascending: false });
    if (!error && data) setSeasons(data as LeagueSeason[]);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

  /** The season whose date range contains today, if any. */
  const activeSeason = seasons.find(s => {
    const now = Date.now();
    return new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() >= now;
  }) ?? null;

  return { seasons, activeSeason, loading, refetch: fetchSeasons };
};

// ── League drafts ────────────────────────────────────────────────────────────

export const useLeagueDrafts = (leagueId: string | undefined) => {
  const [drafts, setDrafts] = useState<LeagueDraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!leagueId) { setLoading(false); return; }

    // Fetch all league_drafts rows — no embedded join so scheduled entries
    // (draft_id = null) are never filtered out by a PostgREST inner-join.
    const { data: entries, error } = await supabase
      .from('league_drafts')
      .select('*')
      .eq('league_id', leagueId)
      .order('added_at', { ascending: false });

    if (error || !entries) { setLoading(false); return; }

    // Separately enrich rows that have a linked draft.
    const draftIds = entries
      .filter((e: any) => e.draft_id)
      .map((e: any) => e.draft_id as string);

    let draftMap: Record<string, any> = {};
    if (draftIds.length > 0) {
      const { data: draftData } = await supabase
        .from('drafts')
        .select('id, title, theme, is_complete, created_at, calculated_score, user_id, option, is_multiplayer, categories')
        .in('id', draftIds);
      if (draftData) {
        draftMap = Object.fromEntries((draftData as any[]).map((d) => [d.id, d]));
      }
    }

    const merged = entries.map((e: any) => ({
      ...e,
      draft: e.draft_id ? (draftMap[e.draft_id] ?? null) : null,
    }));

    setDrafts(merged as unknown as LeagueDraftEntry[]);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return;
    fetchDrafts();

    // No row-level filter here because league_drafts lacks REPLICA IDENTITY FULL;
    // filtered UPDATE events would be silently dropped. We re-fetch on any change
    // to the table and filter by league_id in the query instead.
    channelRef.current = supabase
      .channel(`league_drafts:${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'league_drafts',
      }, () => { fetchDrafts(); })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [leagueId, fetchDrafts]);

  return { drafts, loading, refetch: fetchDrafts };
};

// ── Messages (real-time, threaded) ───────────────────────────────────────────

export const useLeagueMessages = (leagueId: string | undefined) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LeagueMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!leagueId) { setLoading(false); return; }

    // Step 1: fetch raw messages
    const { data: rawMessages, error } = await supabase
      .from('league_messages')
      .select('*')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true });

    if (error || !rawMessages) { setLoading(false); return; }

    // Step 2: fetch profiles for all unique authors
    const userIds = [...new Set(rawMessages.map((m: any) => m.user_id as string))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds)
      : { data: [] };

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, { name: p.name, avatar_url: p.avatar_url }])
    );

    const enriched: LeagueMessage[] = rawMessages.map((m: any) => ({
      ...m,
      author: profileMap[m.user_id] ?? { name: null, avatar_url: null },
    }));

    setMessages(enriched);
    setLoading(false);
  }, [leagueId]);

  // Subscribe to realtime inserts/deletes
  useEffect(() => {
    if (!leagueId) return;
    fetchMessages();

    channelRef.current = supabase
      .channel(`league_messages:${leagueId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'league_messages',
        filter: `league_id=eq.${leagueId}`,
      }, () => { fetchMessages(); })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'league_messages',
        filter: `league_id=eq.${leagueId}`,
      }, () => { fetchMessages(); })
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [leagueId, fetchMessages]);

  const sendMessage = async (content: string, parentId?: string): Promise<boolean> => {
    if (!user || !leagueId) return false;
    const { error } = await supabase.from('league_messages').insert({
      league_id: leagueId,
      user_id: user.id,
      content: content.trim(),
      parent_id: parentId ?? null,
    });
    if (!error) fetchMessages();
    return !error;
  };

  const deleteMessage = async (messageId: string): Promise<boolean> => {
    const { error } = await supabase.from('league_messages').delete().eq('id', messageId);
    if (!error) fetchMessages();
    return !error;
  };

  // Organise into top-level posts + replies map
  const posts = messages.filter(m => m.parent_id === null);
  const repliesMap = messages.reduce<Record<string, LeagueMessage[]>>((acc, m) => {
    if (m.parent_id) {
      acc[m.parent_id] = [...(acc[m.parent_id] ?? []), m];
    }
    return acc;
  }, {});

  return { posts, repliesMap, loading, sendMessage, deleteMessage, refetch: fetchMessages };
};

// ── Pending invites for current user ────────────────────────────────────────

export const usePendingLeagueInvites = () => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('league_invites')
      .select('*, league:leagues(name), inviter:profiles!league_invites_invited_by_fkey(name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');
    if (!error && data) setInvites(data as unknown as LeagueInvite[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);
  return { invites, loading, refetch: fetchInvites };
};

// ── All actions ──────────────────────────────────────────────────────────────

export const useLeagueActions = () => {
  const { user } = useAuth();

  const createLeague = async (name: string): Promise<League | null> => {
    if (!user) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data: league, error } = await supabase
      .from('leagues').insert({ name, slug, admin_id: user.id }).select().single();
    if (error || !league) { console.error('Error creating league:', error); return null; }
    await supabase.from('league_members').insert({ league_id: league.id, user_id: user.id, role: 'admin' });
    return league as League;
  };

  const updateLeagueName = async (leagueId: string, name: string): Promise<boolean> => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await supabase.from('leagues')
      .update({ name, slug, updated_at: new Date().toISOString() }).eq('id', leagueId);
    return !error;
  };

  // ── Seasons ──
  const createSeason = async (leagueId: string, name: string, startsAt: string, endsAt: string): Promise<LeagueSeason | null> => {
    const { data, error } = await supabase.from('league_seasons')
      .insert({ league_id: leagueId, name, starts_at: startsAt, ends_at: endsAt })
      .select().single();
    if (error) { console.error(error); return null; }
    return data as LeagueSeason;
  };

  const updateSeason = async (seasonId: string, updates: Partial<Pick<LeagueSeason, 'name' | 'starts_at' | 'ends_at'>>): Promise<boolean> => {
    const { error } = await supabase.from('league_seasons').update(updates).eq('id', seasonId);
    return !error;
  };

  const deleteSeason = async (seasonId: string): Promise<boolean> => {
    const { error } = await supabase.from('league_seasons').delete().eq('id', seasonId);
    return !error;
  };

  // ── Drafts ──
  const addDraftToLeague = async (leagueId: string, draftId: string, seasonId?: string): Promise<boolean> => {
    const { error } = await supabase.from('league_drafts')
      .insert({ league_id: leagueId, draft_id: draftId, season_id: seasonId ?? null });
    return !error;
  };

  const removeDraftFromLeague = async (leagueId: string, draftId: string): Promise<boolean> => {
    const { error } = await supabase.from('league_drafts')
      .delete().eq('league_id', leagueId).eq('draft_id', draftId);
    return !error;
  };

  const scheduleDraft = async (
    leagueId: string,
    scheduledAt: string,
    draftType: string,
    seasonId?: string,
    notes?: string,
    theme?: string,
    categories?: string[],
  ): Promise<boolean> => {
    const { error } = await supabase.from('league_drafts').insert({
      league_id: leagueId,
      draft_id: null,
      scheduled_at: scheduledAt,
      draft_type: draftType,
      season_id: seasonId ?? null,
      notes: notes ?? null,
      theme: theme ?? null,
      categories: categories ?? [],
    });
    return !error;
  };

  const removeScheduledDraft = async (entryId: string): Promise<boolean> => {
    const { error } = await supabase.from('league_drafts').delete().eq('id', entryId);
    return !error;
  };

  const assignDraftToSeason = async (leagueDraftId: string, seasonId: string | null): Promise<boolean> => {
    const { error } = await supabase.from('league_drafts')
      .update({ season_id: seasonId }).eq('id', leagueDraftId);
    return !error;
  };

  // ── Members ──
  const inviteByUsername = async (leagueId: string, targetUserId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('league_invites')
      .insert({ league_id: leagueId, invited_by: user.id, invited_user_id: targetUserId });
    return !error;
  };

  const removeMember = async (leagueId: string, userId: string): Promise<boolean> => {
    const { error } = await supabase.from('league_members')
      .delete().eq('league_id', leagueId).eq('user_id', userId);
    return !error;
  };

  // ── Invites ──
  const acceptInvite = async (inviteId: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('accept_league_invite', { invite_id_param: inviteId });
    if (error) { console.error(error); return null; }
    return data as string;
  };

  const declineInvite = async (inviteId: string): Promise<boolean> => {
    const { error } = await supabase.from('league_invites')
      .update({ status: 'declined' }).eq('id', inviteId);
    return !error;
  };

  const acceptInviteByToken = async (token: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('accept_league_invite_by_token', { token_param: token });
    if (error) { console.error(error); return null; }
    return data as string;
  };

  return {
    createLeague, updateLeagueName,
    createSeason, updateSeason, deleteSeason,
    addDraftToLeague, removeDraftFromLeague, scheduleDraft, removeScheduledDraft, assignDraftToSeason,
    inviteByUsername, removeMember,
    acceptInvite, declineInvite, acceptInviteByToken,
  };
};
