import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// A lean, signed-in-only version of the web app's useMultiplayerDraft hook —
// just what the lobby needs: load the draft, stay in sync live, show who's
// online, and let the host start. (Picks + turns come with the live-draft screen.)

export const PRESENCE_HEARTBEAT_MS = 15_000;
const PRESENCE_ONLINE_THRESHOLD_MS = 30_000;

export interface DraftParticipant {
  id: string;
  user_id: string | null;
  guest_participant_id: string | null;
  participant_id?: string;
  participant_name: string;
  is_ai?: boolean;
  status: "invited" | "joined" | "left";
  is_host: boolean;
  joined_at: string | null;
  created_at?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
}

export interface DraftPickRow {
  id?: string;
  player_id: number | string;
  player_name: string;
  movie_id: number;
  movie_title: string;
  movie_year?: number | null;
  poster_path?: string | null;
  category: string;
  pick_order: number;
  calculated_score?: number | null;
}

export interface DraftRoom {
  id: string;
  title: string;
  theme: string;
  option: string;
  categories: string[];
  current_turn_user_id: string | null;
  current_turn_participant_id?: string | null;
  current_pick_number: number;
  is_complete: boolean;
  is_multiplayer: boolean;
  invite_code: string | null;
  turn_order: any;
}

export function isParticipantOnline(p: DraftParticipant, nowMs = Date.now()): boolean {
  if (p.is_ai || !p.last_seen_at) return false;
  const seen = new Date(p.last_seen_at).getTime();
  return !Number.isNaN(seen) && nowMs - seen <= PRESENCE_ONLINE_THRESHOLD_MS;
}

export function useDraftRoom(draftId: string | undefined) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [draft, setDraft] = useState<DraftRoom | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [picks, setPicks] = useState<DraftPickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (background = false) => {
      if (!draftId || !userId) return;
      if (!background) setLoading(true);
      const { data, error: rpcError } = await supabase.rpc("load_draft_unified", {
        p_draft_id: draftId,
        p_participant_id: userId,
      });
      if (rpcError || !data || data.length === 0) {
        if (!background) {
          setError(rpcError?.message ?? "This draft does not exist or you do not have permission to view it.");
          setLoading(false);
        }
        return;
      }
      const d = data[0];
      setDraft({
        id: d.draft_id,
        title: d.draft_title,
        theme: d.draft_theme,
        option: d.draft_option,
        categories: d.draft_categories ?? [],
        current_turn_user_id: d.draft_current_turn_user_id,
        current_turn_participant_id: d.draft_current_turn_participant_id,
        current_pick_number: d.draft_current_pick_number,
        is_complete: d.draft_is_complete,
        is_multiplayer: d.draft_is_multiplayer,
        invite_code: d.draft_invite_code,
        turn_order: d.draft_turn_order,
      });

      let rows: DraftParticipant[] = Array.isArray(d.participants_data) ? d.participants_data : [];
      const userIds = rows.map((p) => p.user_id).filter((id): id is string => !!id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, avatar_url")
          .in("id", userIds);
        const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        rows = rows.map((p) => {
          const prof: any = p.user_id ? byId.get(p.user_id) : null;
          return prof ? { ...p, email: prof.email ?? p.email, avatar_url: prof.avatar_url ?? p.avatar_url } : p;
        });
      }
      setParticipants(rows);
      setPicks(Array.isArray(d.picks_data) ? d.picks_data : []);
      setError(null);
      setLoading(false);
    },
    [draftId, userId],
  );

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => load(true), 300);
  }, [load]);

  // First load (or a clear message if nobody is signed in).
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setError("Sign in to view this draft.");
      setLoading(false);
      return;
    }
    load();
  }, [load, authLoading, userId]);

  // Live updates: the draft row (host started it) and the participant list (joins, presence).
  useEffect(() => {
    if (!draftId) return;
    const channel = supabase
      .channel(`mobile-draft-room-${draftId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drafts", filter: `id=eq.${draftId}` },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_participants", filter: `draft_id=eq.${draftId}` },
        (payload) => {
          // Presence heartbeats only touch last_seen_at — patch in place instead of reloading.
          const next: any = payload.new;
          const prev: any = payload.old;
          if (payload.eventType === "UPDATE" && next && prev && next.last_seen_at !== prev.last_seen_at) {
            const onlyPresence = Object.keys(prev).every(
              (k) => k === "last_seen_at" || k === "id" || !(k in next) || prev[k] === next[k],
            );
            if (onlyPresence) {
              setParticipants((rows) =>
                rows.map((p) => (p.id === next.id ? { ...p, last_seen_at: next.last_seen_at } : p)),
              );
              return;
            }
          }
          scheduleReload();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "draft_picks", filter: `draft_id=eq.${draftId}` },
        scheduleReload,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [draftId, scheduleReload]);

  // Presence: tell the server we're here every 15s while the app is open, and
  // reload when the app returns from the background (realtime may have dropped).
  useEffect(() => {
    if (!draftId || !userId) return;
    let active = AppState.currentState === "active";
    const beat = () => {
      if (!active) return;
      supabase
        .rpc("heartbeat_draft_presence", { p_draft_id: draftId, p_participant_id: userId })
        .then(({ error: e }) => e && console.warn("Presence heartbeat failed:", e.message));
    };
    beat();
    const interval = setInterval(() => {
      beat();
      setNow(Date.now());
    }, PRESENCE_HEARTBEAT_MS);
    // Supabase calls only fire once awaited/then'd, so attach a no-op then().
    const clearPresence = () => {
      supabase
        .rpc("clear_draft_presence", { p_draft_id: draftId, p_participant_id: userId })
        .then(() => {});
    };
    const sub = AppState.addEventListener("change", (state) => {
      active = state === "active";
      if (active) {
        beat();
        load(true);
      } else {
        clearPresence();
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
      clearPresence();
    };
  }, [draftId, userId, load]);

  const sorted = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const at = a.created_at ?? a.joined_at ?? "";
        const bt = b.created_at ?? b.joined_at ?? "";
        if (at !== bt) {
          if (!at) return 1;
          if (!bt) return -1;
          return new Date(at).getTime() - new Date(bt).getTime();
        }
        return String(a.id).localeCompare(String(b.id));
      }),
    [participants],
  );

  const isHost = participants.some((p) => p.is_host && p.user_id === userId);
  const hasStarted = !!draft?.turn_order && draft.turn_order.length > 0;
  const joinedCount = sorted.filter((p) => p.status === "joined").length;

  const startDraft = useCallback(async (): Promise<string | null> => {
    if (!draftId || !userId) return "Not signed in.";
    setStarting(true);
    const { error: rpcError } = await supabase.rpc("start_multiplayer_draft_unified", {
      p_draft_id: draftId,
      p_participant_id: userId,
    });
    setStarting(false);
    if (rpcError) return rpcError.message;
    await load(true);
    return null;
  }, [draftId, userId, load]);

  // Draft a movie into a category for the signed-in player. Returns an error
  // message on failure (not your turn, movie already taken, ...), null on success.
  const makePick = useCallback(
    async (movie: {
      id: number;
      title: string;
      year: number;
      genre: string;
      category: string;
      posterPath?: string;
    }): Promise<string | null> => {
      if (!draftId || !userId) return "Not signed in.";
      const { data, error: rpcError } = await supabase.rpc("make_multiplayer_pick_unified", {
        p_draft_id: draftId,
        p_participant_id: userId,
        p_movie_id: movie.id,
        p_movie_title: movie.title,
        p_movie_year: movie.year,
        p_movie_genre: movie.genre,
        p_category: movie.category,
        p_poster_path: movie.posterPath,
        p_caller_participant_id: null,
      });
      if (rpcError) {
        const msg = rpcError.message ?? "Could not make the pick.";
        if (rpcError.code === "23505" || msg.includes("already been drafted") || msg.includes("unique_movie_per_draft")) {
          return "That movie was already picked in this draft. Choose another.";
        }
        return msg;
      }
      const result = data?.[0];
      if (!result?.success) return result?.message ?? "Failed to make pick.";
      // Realtime should deliver the new pick; reload shortly as a fallback.
      setTimeout(() => load(true), 1500);
      return null;
    },
    [draftId, userId, load],
  );

  return {
    draft,
    picks,
    makePick,
    participants: sorted,
    loading,
    error,
    isHost,
    hasStarted,
    joinedCount,
    now,
    starting,
    startDraft,
    refetch: () => load(true),
  };
}
