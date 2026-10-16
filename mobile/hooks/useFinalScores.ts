import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { calculateDetailedScore } from "../lib/scoreCalculator";
import { fetchOscarCacheMap, mergePicksOscarWithCache } from "../lib/oscarPickSync";
import { mergeOscarStatusFromSources } from "../lib/movieCategoryUtils";

// Mobile version of the logic inside the web FinalScores page: load a finished
// draft, score every pick, average per player, and fold in voting points.

export interface ScoredPick {
  id: string;
  player_id: number | string;
  player_name: string;
  movie_id: number;
  movie_title: string;
  movie_year?: number | null;
  poster_path?: string | null;
  category: string;
  pick_order: number;
  oscar_status?: string | null;
  movie_budget?: number | null;
  movie_revenue?: number | null;
  rt_critics_score?: number | null;
  rt_audience_score?: number | null;
  imdb_rating?: number | null;
  metacritic_score?: number | null;
  calculated_score?: number | null;
  /** Score using the current formula, null if the movie has no ratings yet. */
  score: number | null;
}

export interface TeamScore {
  playerName: string;
  picks: ScoredPick[];
  averageScore: number;
  scoredPicks: number;
  totalPicks: number;
  voteCount: number;
  votePoints: number;
  combinedScore: number;
}

function scorePick(p: any): number | null {
  if (!(p.movie_budget || p.rt_critics_score || p.imdb_rating || p.metacritic_score)) return null;
  return calculateDetailedScore({
    budget: p.movie_budget,
    revenue: p.movie_revenue,
    rtCriticsScore: p.rt_critics_score,
    rtAudienceScore: p.rt_audience_score,
    metacriticScore: p.metacritic_score,
    imdbRating: p.imdb_rating,
    oscarStatus: p.oscar_status,
  }).finalScore;
}

const withScore = (p: any): ScoredPick => ({ ...p, score: scorePick(p) });

export function useFinalScores(draftId: string | undefined) {
  const [draft, setDraft] = useState<any>(null);
  const [picks, setPicks] = useState<ScoredPick[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const cancelled = useRef(false);

  const enrich = useCallback(async (list: ScoredPick[], cache: Map<number, string>) => {
    // Same rule as the web: anything missing a score or key ratings gets looked up.
    const todo = list.filter(
      (p) => !p.calculated_score || !p.rt_critics_score || !p.imdb_rating || !p.metacritic_score || !p.poster_path,
    );
    if (todo.length === 0) return;
    setEnriching(true);
    try {
      for (let i = 0; i < todo.length; i++) {
        if (cancelled.current) return;
        const pick = todo[i];
        const { data, error: e } = await supabase.functions.invoke("enrich-movie-data", {
          body: { movieId: pick.movie_id, movieTitle: pick.movie_title, movieYear: pick.movie_year },
        });
        const en = data?.enrichmentData ?? (data?.success ? data : null);
        if (!e && en) {
          setPicks((prev) =>
            prev.map((p) => {
              if (p.id !== pick.id) return p;
              const oscar = mergeOscarStatusFromSources(
                p.oscar_status,
                en.oscarStatus ?? en.oscar_status ?? "none",
                cache.get(p.movie_id),
              );
              return withScore({
                ...p,
                rt_critics_score: en.rtCriticsScore || en.rt_critics_score || p.rt_critics_score || null,
                metacritic_score: en.metacriticScore || en.metacritic_score || p.metacritic_score || null,
                imdb_rating: en.imdbRating || en.imdb_rating || p.imdb_rating || null,
                movie_budget: en.budget || en.movie_budget || p.movie_budget || null,
                movie_revenue: en.revenue || en.movie_revenue || p.movie_revenue || null,
                poster_path: en.posterPath || en.poster_path || p.poster_path || null,
                oscar_status: oscar.oscar_status,
              });
            }),
          );
        }
        if (i < todo.length - 1) await new Promise((r) => setTimeout(r, 1000));
      }
    } finally {
      if (!cancelled.current) setEnriching(false);
    }
  }, []);

  useEffect(() => {
    if (!draftId) return;
    cancelled.current = false;
    (async () => {
      setLoading(true);
      const [draftRes, picksRes, partsRes, votesRes] = await Promise.all([
        supabase.from("drafts").select("*").eq("id", draftId).maybeSingle(),
        supabase.from("draft_picks").select("*").eq("draft_id", draftId).order("pick_order"),
        supabase
          .from("draft_participants")
          .select("id, participant_name, is_ai, user_id, created_at")
          .eq("draft_id", draftId)
          .order("created_at", { ascending: true }),
        supabase
          .from("draft_votes")
          .select("voted_participant_id, voted_player_name")
          .eq("draft_id", draftId),
      ]);
      if (cancelled.current) return;
      if (draftRes.error || !draftRes.data || picksRes.error) {
        setError("This draft could not be loaded.");
        setLoading(false);
        return;
      }
      const raw = picksRes.data ?? [];
      const cache = await fetchOscarCacheMap(supabase, raw.map((p: any) => p.movie_id));
      const merged = mergePicksOscarWithCache(raw as any[], cache).map(withScore);
      // Special drafts store an id as their "option" — swap in the readable name.
      let option: string = draftRes.data.option ?? "";
      if (draftRes.data.theme === "spec-draft" && option) {
        const { data: spec } = await supabase.from("spec_drafts").select("name").eq("id", option).maybeSingle();
        option = spec?.name ?? "";
      } else if (option.includes("|")) {
        option = option.split("|")[0];
      }
      setDraft({ ...draftRes.data, optionLabel: option });
      setParticipants(partsRes.data ?? []);
      setVotes(votesRes.data ?? []);
      setPicks(merged);
      setLoading(false);
      enrich(merged, cache);
    })();
    return () => {
      cancelled.current = true;
    };
  }, [draftId, enrich]);

  const teams = useMemo<TeamScore[]>(() => {
    const byPlayer = new Map<string, ScoredPick[]>();
    picks.forEach((p) => byPlayer.set(p.player_name, [...(byPlayer.get(p.player_name) ?? []), p]));

    const base = [...byPlayer.entries()].map(([playerName, list]) => {
      const scores = list.map((p) => p.score).filter((s): s is number => s != null);
      return {
        playerName,
        picks: list,
        averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        scoredPicks: scores.length,
        totalPicks: list.length,
      };
    });

    // Votes: who each voter picked, counted by player name.
    const idToName = new Map(participants.map((p) => [p.id, p.participant_name]));
    const counts = new Map<string, number>();
    votes.forEach((v) => {
      const name = v.voted_player_name ?? (v.voted_participant_id ? idToName.get(v.voted_participant_id) : null);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    const n = base.length;
    const totalVotes = [...counts.values()].reduce((a, b) => a + b, 0);
    if (n === 0) return [];
    if (totalVotes === 0 || n < 2) {
      return base
        .map((t) => ({ ...t, voteCount: 0, votePoints: 0, combinedScore: t.averageScore }))
        .sort((a, b) => b.averageScore - a.averageScore);
    }

    // Same vote-points formula as the web: rank by votes, (n - rank)/(n - 1) * 10, ties share the average.
    const withCounts = base.map((t) => ({ ...t, voteCount: counts.get(t.playerName) ?? 0 }));
    const byCount = [...withCounts].sort((a, b) => b.voteCount - a.voteCount);
    const rankOf = new Map<string, number>();
    let rank = 1;
    byCount.forEach((t, i) => {
      if (i > 0 && t.voteCount < byCount[i - 1].voteCount) rank = i + 1;
      rankOf.set(t.playerName, rank);
    });
    const groups = new Map<number, string[]>();
    rankOf.forEach((r, name) => groups.set(r, [...(groups.get(r) ?? []), name]));
    const points = new Map<string, number>();
    groups.forEach((names, start) => {
      let sum = 0;
      for (let r = start; r < start + names.length; r++) sum += ((n - r) / (n - 1)) * 10;
      const avg = Math.round((sum / names.length) * 100) / 100;
      names.forEach((name) => points.set(name, avg));
    });
    return withCounts
      .map((t) => {
        const votePoints = points.get(t.playerName) ?? 0;
        return { ...t, votePoints, combinedScore: t.averageScore + votePoints };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }, [picks, participants, votes]);

  return { draft, picks, participants, teams, loading, error, enriching, hasVotes: teams.some((t) => t.voteCount > 0) };
}
