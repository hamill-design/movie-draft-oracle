import type { LeagueStanding } from '@/hooks/useLeagues';

export type DraftParticipantRow = { draft_id: string; user_id: string | null; participant_name: string };
export type DraftPickRow = { draft_id: string; player_name: string; calculated_score: number | null };

export type LeagueDraftMetricPack = {
  participantCount: number;
  byParticipantName: Record<string, number>;
  contributionByUserId: Record<string, number>;
};

/** Aggregate picks + participants into per-draft metrics for placement + league rank delta. */
export function buildLeagueDraftMetrics(
  draftId: string,
  picks: DraftPickRow[],
  participants: DraftParticipantRow[],
): LeagueDraftMetricPack {
  const parts = participants.filter(p => p.draft_id === draftId);
  const byParticipantName: Record<string, number> = {};
  for (const p of parts) {
    byParticipantName[p.participant_name] = 0;
  }
  for (const pick of picks) {
    if (pick.draft_id !== draftId) continue;
    const add = Number(pick.calculated_score) || 0;
    byParticipantName[pick.player_name] = (byParticipantName[pick.player_name] ?? 0) + add;
  }

  const contributionByUserId: Record<string, number> = {};
  for (const p of parts) {
    if (p.user_id) {
      contributionByUserId[p.user_id] = byParticipantName[p.participant_name] ?? 0;
    }
  }

  return {
    participantCount: parts.length,
    byParticipantName,
    contributionByUserId,
  };
}

/** 1-based placement among all participants (including guests) by total pick score. */
export function draftPlacementRank(
  userId: string | undefined,
  participants: DraftParticipantRow[],
  draftId: string,
  byParticipantName: Record<string, number>,
): number | null {
  if (!userId) return null;
  const myName = participants.find(
    p => p.draft_id === draftId && p.user_id === userId,
  )?.participant_name;
  if (!myName) return null;

  const sorted = Object.entries(byParticipantName).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const idx = sorted.findIndex(([name]) => name === myName);
  return idx >= 0 ? idx + 1 : null;
}

/** F1-style league points for a draft finish (matches DB standings view). */
export function f1PositionPoints(finishRank: number): number {
  if (finishRank === 1) return 10;
  if (finishRank === 2) return 7;
  if (finishRank === 3) return 5;
  if (finishRank === 4) return 3;
  if (finishRank === 5) return 2;
  return 1;
}

/** League points earned per authenticated member for one completed draft. */
export function draftLeaguePointsByUserId(
  draftId: string,
  participants: DraftParticipantRow[],
  byParticipantName: Record<string, number>,
): Record<string, number> {
  const sorted = Object.entries(byParticipantName).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const rankByName = new Map(sorted.map(([name], index) => [name, index + 1]));
  const points: Record<string, number> = {};

  for (const p of participants) {
    if (p.draft_id !== draftId || !p.user_id) continue;
    const rank = rankByName.get(p.participant_name);
    if (rank) points[p.user_id] = f1PositionPoints(rank);
  }

  return points;
}

export function placementOrdinalLabel(rank: number): string {
  if (rank === 1) return 'First Place';
  if (rank === 2) return 'Second Place';
  if (rank === 3) return 'Third Place';
  const v = rank % 100;
  const suffix = (() => {
    if (v >= 11 && v <= 13) return 'th';
    switch (rank % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  })();
  return `${rank}${suffix} Place`;
}

/**
 * How many league rank positions the user moved up (positive) or down (negative)
 * after this draft, vs standings if this draft's scores were excluded.
 */
export function computeLeagueRankDelta(
  standings: LeagueStanding[],
  contributionByUserId: Record<string, number>,
  currentUserId: string | undefined,
): number | null {
  if (!currentUserId || standings.length === 0) return null;
  const me = standings.find(s => s.user_id === currentUserId);
  if (!me) return null;
  if (!Object.prototype.hasOwnProperty.call(contributionByUserId, currentUserId)) {
    return null;
  }

  const adjusted = standings.map(s => ({
    user_id: s.user_id,
    adj: s.total_score - (contributionByUserId[s.user_id] ?? 0),
  }));
  adjusted.sort((a, b) => {
    if (b.adj !== a.adj) return b.adj - a.adj;
    return a.user_id.localeCompare(b.user_id);
  });
  const oldIndex = adjusted.findIndex(x => x.user_id === currentUserId);
  if (oldIndex < 0) return null;
  const oldRank = oldIndex + 1;
  return oldRank - me.rank;
}
