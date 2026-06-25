import type { DraftPick } from '@/hooks/useDrafts';

/** Matches draft_participants columns needed for board row order and pick mapping */
export type DraftBoardParticipant = {
  id: string;
  participant_name: string;
  is_ai?: boolean;
  user_id?: string | null;
  guest_participant_id?: string | null;
  created_at?: string | null;
  participant_id?: string | null;
};

export type BoardPlayer = { id: number; name: string };

export type BoardPick = {
  playerId: number;
  playerName: string;
  movie: { title: string; calculated_score?: number | null };
  category: string;
};

function participantCanonicalId(p: DraftBoardParticipant): string | null {
  const id =
    p.participant_id ?? p.user_id ?? p.guest_participant_id ?? (p.is_ai ? p.id : null);
  return id != null ? String(id) : null;
}

function sameParticipant(a: DraftBoardParticipant, b: DraftBoardParticipant): boolean {
  const aId =
    a.participant_id ?? a.user_id ?? a.guest_participant_id ?? (a.is_ai ? a.id : null);
  const bId =
    b.participant_id ?? b.user_id ?? b.guest_participant_id ?? (b.is_ai ? b.id : null);
  return aId != null && bId != null && String(aId) === String(bId);
}

export function sortParticipantsByCreatedAt<T extends { created_at?: string | null; id?: string }>(
  participants: T[]
): T[] {
  return [...participants].sort((a, b) => {
    const aHas = Boolean(a.created_at);
    const bHas = Boolean(b.created_at);
    if (!aHas && !bHas) return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    if (!aHas) return 1;
    if (!bHas) return -1;
    const aTime = new Date(a.created_at as string).getTime();
    const bTime = new Date(b.created_at as string).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

/**
 * Match MultiplayerDraftInterface getPlayersInTurnOrder (without ref caching).
 * When turn_order is missing, returns participants sorted by created_at (stable board).
 */
export function getPlayersInTurnOrderPure(
  participants: DraftBoardParticipant[],
  turnOrder: unknown
): DraftBoardParticipant[] {
  const sorted = sortParticipantsByCreatedAt(participants);
  if (!turnOrder || !Array.isArray(turnOrder) || turnOrder.length === 0) {
    return sorted;
  }

  const firstRound = turnOrder
    .filter((item: { round?: number | string }) => item.round === 1 || item.round === '1')
    .sort(
      (a: { pick_number?: number }, b: { pick_number?: number }) =>
        (Number(a.pick_number) ?? 0) - (Number(b.pick_number) ?? 0)
    );

  const orderedIds: string[] = [];
  const seenIds = new Set<string>();
  firstRound.forEach((item: Record<string, unknown>) => {
    const pid = item.participant_id ?? item.user_id ?? item.guest_participant_id;
    if (pid && !seenIds.has(String(pid))) {
      seenIds.add(String(pid));
      orderedIds.push(String(pid));
    }
  });

  // Legacy JSON may only expose user_id / names
  if (orderedIds.length === 0) {
    firstRound.forEach((item: Record<string, unknown>) => {
      const name = item.participant_name;
      if (typeof name === 'string' && name) {
        const p = sorted.find((x) => x.participant_name === name);
        const key = p ? participantCanonicalId(p) : null;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          orderedIds.push(key);
        }
      }
    });
  }

  const turnOrderParticipants: DraftBoardParticipant[] = [];
  orderedIds.forEach((pid) => {
    const participant = sorted.find((p) => {
      const pId = participantCanonicalId(p);
      return pId && String(pId) === pid;
    });
    if (participant) turnOrderParticipants.push(participant);
  });

  sorted.forEach((p) => {
    const pId = participantCanonicalId(p);
    if (pId && !seenIds.has(String(pId))) turnOrderParticipants.push(p);
  });

  return turnOrderParticipants.length > 0 ? turnOrderParticipants : sorted;
}

/**
 * Backend pick player_id = row_number over draft_participants ORDER BY created_at, id (1-based).
 * Map that to DraftBoard row id (1-based) = position in snake/turn display order.
 */
function backendPickPlayerIdToDisplayRowId(
  participantsSorted: DraftBoardParticipant[],
  playersInDisplayOrder: DraftBoardParticipant[]
): Map<number, number> {
  const map = new Map<number, number>();
  participantsSorted.forEach((participant, i) => {
    const backendPlayerId = i + 1;
    const displayIndex = playersInDisplayOrder.findIndex((p) => sameParticipant(p, participant));
    if (displayIndex >= 0) map.set(backendPlayerId, displayIndex + 1);
  });
  return map;
}

export function buildBoardCategories(
  draft: { categories?: string[] | null } | null | undefined,
  picks: DraftPick[]
): string[] {
  if (draft?.categories?.length) return draft.categories;
  const ordered: string[] = [];
  const seen = new Set<string>();
  [...picks]
    .sort((a, b) => a.pick_order - b.pick_order)
    .forEach((p) => {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        ordered.push(p.category);
      }
    });
  return ordered;
}

/**
 * Row order for a standard snake draft: round 1 fills the first category column in pick_order.
 * That sequence matches draft-night board rows without relying on turn_order or DB join order.
 */
function multiplayerLayoutFromFirstCategoryPicks(
  picks: DraftPick[],
  boardCategories: string[],
  expectedPlayers: number
): { boardPlayers: BoardPlayer[]; backendPlayerIdToRowId: Map<number, number> } | null {
  if (!boardCategories.length || !picks.length || expectedPlayers <= 0) return null;

  const firstCat = boardCategories[0];
  const round1 = picks
    .filter((p) => p.category === firstCat)
    .sort((a, b) => a.pick_order - b.pick_order);

  const seen = new Set<number>();
  const orderedRound1: DraftPick[] = [];
  for (const p of round1) {
    const pid = Number(p.player_id);
    if (Number.isNaN(pid) || seen.has(pid)) continue;
    seen.add(pid);
    orderedRound1.push(p);
  }

  // Only trust the picks-derived layout once every participant has made their
  // round-1 (first category) pick. Before that, fall back to turn/join order so
  // participants who haven't picked yet still get a board row.
  if (orderedRound1.length !== expectedPlayers) return null;

  const boardPlayers: BoardPlayer[] = orderedRound1.map((p, i) => ({
    id: i + 1,
    name: p.player_name,
  }));

  const backendPlayerIdToRowId = new Map<number, number>();
  orderedRound1.forEach((p, i) => {
    backendPlayerIdToRowId.set(Number(p.player_id), i + 1);
  });

  return { boardPlayers, backendPlayerIdToRowId };
}

/**
 * Shared layout for DraftBoard on Vote page, Final Scores, etc.
 * Multiplayer row order is derived from round-1 picks (first category) when the round is complete;
 * otherwise turn_order, then participant join order.
 */
export function buildDraftBoardModel(
  draft: { categories?: string[] | null; is_multiplayer?: boolean | null; turn_order?: unknown } | null | undefined,
  picks: DraftPick[],
  participants: DraftBoardParticipant[],
  options?: { includeMovieYear?: boolean }
): {
  boardCategories: string[];
  boardPlayers: BoardPlayer[];
  boardPicks: BoardPick[];
} {
  const boardCategories = buildBoardCategories(draft, picks);
  const { includeMovieYear = true } = options ?? {};

  const pickDisplayScore = (p: DraftPick): number | null => {
    const raw = (p as { calculated_score?: number | null }).calculated_score;
    return raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
  };

  const movieTitle = (p: DraftPick) =>
    includeMovieYear && p.movie_year ? `${p.movie_title} (${p.movie_year})` : p.movie_title;

  if (draft?.is_multiplayer && participants.length > 0) {
    const sorted = sortParticipantsByCreatedAt(participants);
    const fromPicks = multiplayerLayoutFromFirstCategoryPicks(
      picks,
      boardCategories,
      sorted.length
    );

    let boardPlayers: BoardPlayer[];
    let idMap: Map<number, number>;

    if (fromPicks) {
      boardPlayers = fromPicks.boardPlayers;
      idMap = fromPicks.backendPlayerIdToRowId;
    } else {
      const playersInTurnOrder = getPlayersInTurnOrderPure(sorted, draft.turn_order);
      boardPlayers = playersInTurnOrder.map((p, index) => ({
        id: index + 1,
        name: p.participant_name,
      }));
      idMap = backendPickPlayerIdToDisplayRowId(sorted, playersInTurnOrder);
    }

    const boardPicks: BoardPick[] = picks.map((p) => {
      const rowId = idMap.get(Number(p.player_id)) ?? boardPlayers.find((bp) => bp.name === p.player_name)?.id ?? 1;
      return {
        playerId: rowId,
        playerName: p.player_name,
        movie: {
          title: movieTitle(p),
          calculated_score: pickDisplayScore(p),
        },
        category: p.category,
      };
    });

    return { boardCategories, boardPlayers, boardPicks };
  }

  // Solo / local: stable roster names from picks (first appearance by pick_order)
  const nameOrder: string[] = [];
  const seen = new Set<string>();
  [...picks].sort((a, b) => a.pick_order - b.pick_order).forEach((p) => {
    if (!seen.has(p.player_name)) {
      seen.add(p.player_name);
      nameOrder.push(p.player_name);
    }
  });
  const playerNameToId = new Map(nameOrder.map((name, i) => [name, i + 1]));
  const boardPlayers: BoardPlayer[] = nameOrder.map((name, i) => ({ id: i + 1, name }));
  const boardPicks: BoardPick[] = picks.map((p) => ({
    playerId: playerNameToId.get(p.player_name) ?? 1,
    playerName: p.player_name,
    movie: {
      title: movieTitle(p),
      calculated_score: pickDisplayScore(p),
    },
    category: p.category,
  }));

  return { boardCategories, boardPlayers, boardPicks };
}
