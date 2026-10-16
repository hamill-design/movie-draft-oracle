import type { DraftPick } from '@/hooks/useDrafts';
import {
  buildBoardCategories,
  type BoardPlayer,
  type DraftBoardParticipant,
} from '@/utils/finalScoresBoardModel';

export type InteractiveBoardPick = {
  playerId: number;
  playerName: string;
  movie: {
    id?: number;
    title: string;
    year?: number;
    poster_path?: string | null;
    calculated_score?: number | null;
  };
  category: string;
};

export type InteractiveBoardModel = {
  boardCategories: string[];
  boardPlayers: BoardPlayer[];
  boardPicks: InteractiveBoardPick[];
};

export function getCategoryDisplayName(category: string): string {
  const categoryDisplayNames: Record<string, string> = {
    'Academy Award Nominee or Winner': 'Academy Award',
    'Blockbuster (minimum of $50 Mil)': 'Blockbuster',
    Sequel: 'Sequel',
  };
  return categoryDisplayNames[category] || category;
}

type RawMultiplayerPick = {
  player_id: number | string;
  player_name: string;
  movie_id: number;
  movie_title: string;
  movie_year?: number | null;
  poster_path?: string | null;
  category: string;
  calculated_score?: number | null;
};

/**
 * Live draft board. Rows are fixed to `boardParticipants` (turn order) for the
 * whole draft, and row ids line up with the ids the picker/turn logic uses
 * (index + 1 in the same list).
 *
 * Deliberately does NOT use buildDraftBoardModel: that re-orders rows by who
 * picked the first category first, which is fine for a finished draft but
 * mid-draft it shuffled rows while the turn/"already picked" checks kept the
 * old order — picks looked swapped between players and the last pick showed
 * as already taken.
 */
export function buildInteractiveBoardModelFromMultiplayer(
  draft: { categories?: string[] | null } | null | undefined,
  rawPicks: RawMultiplayerPick[],
  boardParticipants: DraftBoardParticipant[],
  getRowIdForPlayerId: (playerId: number | string) => number | undefined
): InteractiveBoardModel {
  const boardCategories = buildBoardCategories(draft, rawPicks as unknown as DraftPick[]);

  const boardPlayers: BoardPlayer[] = boardParticipants.map((p, i) => ({
    id: i + 1,
    name: p.participant_name,
  }));

  const boardPicks: InteractiveBoardPick[] = rawPicks.map((p) => {
    const score = p.calculated_score;
    return {
      playerId:
        getRowIdForPlayerId(p.player_id) ??
        boardPlayers.find((bp) => bp.name === p.player_name)?.id ??
        0,
      playerName: p.player_name,
      movie: {
        id: p.movie_id,
        title: p.movie_title,
        year: p.movie_year ?? undefined,
        poster_path: p.poster_path,
        calculated_score: score != null && !Number.isNaN(Number(score)) ? Number(score) : null,
      },
      category: p.category,
    };
  });

  return { boardCategories, boardPlayers, boardPicks };
}

export function buildInteractiveBoardModelFromLocal(
  categories: string[],
  players: BoardPlayer[],
  picks: Array<{
    playerId: number;
    playerName: string;
    movie: { id: number; title: string; year?: number; poster_path?: string | null };
    category: string;
  }>
): InteractiveBoardModel {
  return {
    boardCategories: categories,
    boardPlayers: players,
    boardPicks: picks.map((p) => ({
      playerId: p.playerId,
      playerName: p.playerName,
      movie: {
        id: p.movie.id,
        title: p.movie.title,
        year: p.movie.year,
        poster_path: p.movie.poster_path,
      },
      category: p.category,
    })),
  };
}
