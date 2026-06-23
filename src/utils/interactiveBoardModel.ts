import type { DraftPick } from '@/hooks/useDrafts';
import {
  buildDraftBoardModel,
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

export function buildInteractiveBoardModelFromMultiplayer(
  draft: {
    categories?: string[] | null;
    is_multiplayer?: boolean | null;
    turn_order?: unknown;
    player_id_to_display_row?: Record<string, number> | null;
  } | null | undefined,
  rawPicks: RawMultiplayerPick[],
  participants: DraftBoardParticipant[],
  getDisplayIndexForPlayerId: (playerId: number | string) => number
): InteractiveBoardModel {
  const draftPicks: DraftPick[] = rawPicks.map((p) => ({
    ...p,
    player_id: Number(p.player_id),
    pick_order: 0,
    movie_genre: null,
    id: '',
    draft_id: '',
    created_at: '',
  }));

  const { boardCategories, boardPlayers, boardPicks } = buildDraftBoardModel(
    draft,
    draftPicks,
    participants,
    { includeMovieYear: false }
  );

  const rawByPlayerCategory = new Map<string, RawMultiplayerPick>();
  rawPicks.forEach((p) => {
    const displayIndex =
      draft?.player_id_to_display_row &&
      Object.keys(draft.player_id_to_display_row).length > 0
        ? (draft.player_id_to_display_row[String(p.player_id)] ?? getDisplayIndexForPlayerId(p.player_id))
        : getDisplayIndexForPlayerId(p.player_id);
    rawByPlayerCategory.set(`${displayIndex + 1}:${p.category}`, p);
  });

  const enrichedPicks: InteractiveBoardPick[] = boardPicks.map((pick) => {
    const raw = rawByPlayerCategory.get(`${pick.playerId}:${pick.category}`);
    return {
      ...pick,
      movie: {
        id: raw?.movie_id,
        title: pick.movie.title,
        year: raw?.movie_year ?? undefined,
        poster_path: raw?.poster_path,
        calculated_score: pick.movie.calculated_score,
      },
    };
  });

  return { boardCategories, boardPlayers, boardPicks: enrichedPicks };
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
