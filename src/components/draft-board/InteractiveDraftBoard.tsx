import { User } from 'lucide-react';
import { Movie } from '@/data/movies';
import type { DraftBoardPickerState } from '@/hooks/useDraftBoardPicker';
import {
  getCategoryDisplayName,
  type InteractiveBoardPick,
} from '@/utils/interactiveBoardModel';
import type { BoardPlayer } from '@/utils/finalScoresBoardModel';
import { BoardAvatar, type BoardRailParticipant } from './DraftBoardPlayerRail';
import {
  DraftBoardPickCell,
  DraftBoardTurnCell,
  DraftBoardAiThinkingRow,
} from './DraftBoardTurnCell';
import { DraftBoardInlinePicker } from './DraftBoardInlinePicker';

const RAIL_WIDTH = 56;
const HEADER_HEIGHT = 48;
const ROW_MIN_HEIGHT = 56;

interface InteractiveDraftBoardProps {
  players: BoardPlayer[];
  categories: string[];
  picks: InteractiveBoardPick[];
  theme: string;
  draftOption: string;
  currentPlayer?: { id: number; name: string };
  railParticipants: BoardRailParticipant[];
  isMyTurn?: boolean;
  isAiThinking?: boolean;
  aiThinkingName?: string;
  aiPicking?: boolean;
  pickerState: DraftBoardPickerState;
  movies: Movie[];
  moviesLoading: boolean;
  onStartSelect: (category: string) => void;
  onCancel: () => void;
  onSearchChange: (query: string) => void;
  onMovieSelect: (movie: Movie) => void;
  onConfirm: (houseOverride?: boolean) => void;
  confirming?: boolean;
  isCategoryAvailable: (category: string) => boolean;
  specCategories?: Map<string, number[]>;
  showScores?: boolean;
}

export function InteractiveDraftBoard({
  players,
  categories,
  picks,
  theme,
  draftOption,
  currentPlayer,
  railParticipants,
  isMyTurn = false,
  isAiThinking = false,
  aiThinkingName,
  aiPicking = false,
  pickerState,
  movies,
  moviesLoading,
  onStartSelect,
  onCancel,
  onSearchChange,
  onMovieSelect,
  onConfirm,
  confirming = false,
  isCategoryAvailable,
  specCategories,
  showScores = false,
}: InteractiveDraftBoardProps) {
  const pickerActive = Boolean(pickerState.activeCategory);

  const getPick = (playerId: number, category: string) =>
    picks.find((p) => p.playerId === playerId && p.category === category);

  const minGridWidth = RAIL_WIDTH + categories.length * 150;

  const railCellClassName =
    'sticky left-0 z-10 flex items-center justify-center bg-[hsl(var(--section-container))]';

  const railCellStyle = {
    width: RAIL_WIDTH,
    flexShrink: 0,
  } as const;

  const railBorderStyle = {
    borderRight: '1px solid hsl(var(--greyscale-purp-850))',
  } as const;

  return (
    <div className="w-full border-y border-[hsl(var(--greyscale-blue-800))] bg-[hsl(var(--section-container))] px-0 py-[12px] sm:px-6 sm:py-[18px]">
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: minGridWidth, width: '100%' }}>
          {/* Header row — rail + categories share one flex row so borders align */}
          <div
            className="flex border-b border-[hsl(var(--text-purple))]"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className={`${railCellClassName} border-b border-[hsl(var(--text-purple))]`}
              style={{ ...railCellStyle, ...railBorderStyle, height: HEADER_HEIGHT }}
            >
              <User className="w-4 h-4 text-[hsl(var(--text-purple))]" />
            </div>
            <div className="flex flex-1 min-w-0">
              {categories.map((category) => (
                <div
                  key={category}
                  className="flex-1 min-w-[150px] px-4 flex items-center justify-center text-center text-[hsl(var(--text-purple))] text-sm font-brockmann font-medium"
                >
                  {getCategoryDisplayName(category)}
                </div>
              ))}
            </div>
          </div>

          {/* Player rows */}
          <div className="flex flex-col">
            {players.map((player, rowIndex) => {
              const isCurrentRow = currentPlayer?.id === player.id;
              const showPicker =
                isCurrentRow && pickerActive && isMyTurn && pickerState.activeCategory;
              const railParticipant = railParticipants[rowIndex];

              return (
                <div key={player.id} className="flex flex-col">
                  <div className="flex" style={{ minHeight: ROW_MIN_HEIGHT }}>
                    <div
                      className={railCellClassName}
                      style={{ ...railCellStyle, ...railBorderStyle, minHeight: ROW_MIN_HEIGHT }}
                    >
                      {railParticipant && (
                        <BoardAvatar participant={railParticipant} size="sm" />
                      )}
                    </div>

                    <div className="flex flex-1 min-w-0 p-1">
                      {categories.map((category) => {
                        const pick = getPick(player.id, category);
                        const empty = !pick;
                        const isSelectingCol = pickerState.activeCategory === category;

                        if (!empty) {
                          return (
                            <div key={category} className="flex-1 min-w-[150px] p-2">
                              <DraftBoardPickCell title={pick?.movie.title} />
                              {showScores && pick?.movie.calculated_score != null && (
                                <div className="text-center text-[hsl(var(--text-purple))] text-xs font-brockmann font-semibold tabular-nums mt-1">
                                  {Number(pick.movie.calculated_score).toFixed(2)}
                                </div>
                              )}
                            </div>
                          );
                        }

                        let variant: 'empty' | 'yourTurn' | 'selecting' | 'inactive' | 'otherTurn' =
                          'empty';
                        if (isCurrentRow && isMyTurn) {
                          if (isSelectingCol) {
                            variant = 'selecting';
                          } else if (isCategoryAvailable(category)) {
                            variant = 'yourTurn';
                          } else {
                            variant = 'inactive';
                          }
                        } else if (isCurrentRow && !isMyTurn) {
                          variant = 'otherTurn';
                        }

                        return (
                          <div
                            key={category}
                            className="flex flex-1 min-w-[150px] flex-col items-center justify-start p-2"
                          >
                            <DraftBoardTurnCell
                              variant={variant}
                              onActivate={() => onStartSelect(category)}
                              onCancel={onCancel}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {showPicker && (
                    <div className="flex">
                      <div className={railCellClassName} style={{ ...railCellStyle, ...railBorderStyle }} aria-hidden />
                      <div
                        className="min-w-0 max-w-full p-1 max-sm:sticky max-sm:z-20 max-sm:w-[calc(100vw-3.5rem)] max-sm:pr-0 sm:flex-1"
                        style={{ left: RAIL_WIDTH }}
                      >
                        <DraftBoardInlinePicker
                          theme={theme}
                          draftOption={draftOption}
                          categories={categories}
                          specCategories={specCategories}
                          pickerState={pickerState}
                          movies={movies}
                          moviesLoading={moviesLoading}
                          onSearchChange={onSearchChange}
                          onMovieSelect={onMovieSelect}
                          onConfirm={onConfirm}
                          confirming={confirming}
                        />
                      </div>
                    </div>
                  )}

                  {isCurrentRow && isAiThinking && (
                    <div className="flex">
                      <div className={railCellClassName} style={{ ...railCellStyle, ...railBorderStyle }} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <DraftBoardAiThinkingRow
                          playerName={aiThinkingName || player.name}
                          loading={aiPicking}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
