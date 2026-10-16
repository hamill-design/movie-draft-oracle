import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// Voting for a finished multiplayer draft: the host switches it on (private, or
// public via a link), everyone else votes once for another player. Same tables
// and RPCs as the web: drafts.voting_ends_at / allow_public_voting, draft_votes,
// enable_draft_voting, submit_draft_vote.

export interface VotingParticipant {
  id: string;
  participant_name: string;
  is_ai: boolean;
  is_host: boolean;
  user_id: string | null;
}

export interface VoteRow {
  voted_participant_id: string | null;
  voter_user_id: string | null;
}

export const VOTING_DURATIONS = [
  { label: "5 min", value: 5 },
  { label: "1 hour", value: 60 },
  { label: "24 hours", value: 1440 },
] as const;

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function useDraftVoting(draftId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  const [meta, setMeta] = useState<{
    is_complete: boolean;
    is_multiplayer: boolean;
    voting_ends_at: string | null;
    allow_public_voting: boolean;
  } | null>(null);
  const [participants, setParticipants] = useState<VotingParticipant[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!draftId) return;
    const [d, p, v] = await Promise.all([
      supabase
        .from("drafts")
        .select("is_complete, is_multiplayer, voting_ends_at, allow_public_voting")
        .eq("id", draftId)
        .maybeSingle(),
      supabase
        .from("draft_participants")
        .select("id, participant_name, is_ai, is_host, user_id, status, created_at")
        .eq("draft_id", draftId)
        .order("created_at", { ascending: true }),
      supabase.from("draft_votes").select("voted_participant_id, voter_user_id").eq("draft_id", draftId),
    ]);
    if (d.data) setMeta(d.data as any);
    // Players who never showed up (still just "invited") aren't candidates.
    setParticipants(((p.data ?? []) as any[]).filter((x) => x.status !== "invited"));
    setVotes((v.data ?? []) as VoteRow[]);
    setLoading(false);
  }, [draftId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: host turns voting on, votes roll in.
  useEffect(() => {
    if (!draftId) return;
    const channel = supabase
      .channel(`mobile-voting-${draftId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drafts", filter: `id=eq.${draftId}` }, load)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "draft_votes", filter: `draft_id=eq.${draftId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftId, load]);

  const endsAt = meta?.voting_ends_at ? new Date(meta.voting_ends_at).getTime() : null;
  const configured = endsAt != null || meta?.allow_public_voting === true;
  const open = (meta?.allow_public_voting === true && endsAt == null) || (endsAt != null && now < endsAt);

  // Tick once a second only while a countdown is running.
  useEffect(() => {
    if (!open || endsAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, endsAt]);

  const me = participants.find((p) => p.user_id === userId) ?? null;
  const isHost = !!me?.is_host;
  const myVote = votes.find((v) => v.voter_user_id === userId) ?? null;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    votes.forEach((v) => v.voted_participant_id && map.set(v.voted_participant_id, (map.get(v.voted_participant_id) ?? 0) + 1));
    return map;
  }, [votes]);

  const enableVoting = useCallback(
    async (isPublic: boolean, minutes: number): Promise<string | null> => {
      if (!draftId) return "No draft.";
      const { error } = await supabase.rpc("enable_draft_voting", {
        p_draft_id: draftId,
        p_public: isPublic,
        p_duration_minutes: minutes,
        p_guest_session_id: null,
      });
      if (error) return error.message;
      await load();
      return null;
    },
    [draftId, load],
  );

  const vote = useCallback(
    async (participantId: string): Promise<string | null> => {
      if (!draftId) return "No draft.";
      const { error } = await supabase.rpc("submit_draft_vote", {
        p_draft_id: draftId,
        p_voted_participant_id: participantId,
        p_voted_player_name: null,
        p_guest_session_id: null,
      });
      if (error) return error.message;
      await load();
      return null;
    },
    [draftId, load],
  );

  return {
    loading,
    meta,
    participants,
    votes,
    counts,
    configured,
    open,
    endsAt,
    remainingMs: endsAt != null && now < endsAt ? endsAt - now : 0,
    me,
    isHost,
    myVote,
    enableVoting,
    vote,
  };
}
