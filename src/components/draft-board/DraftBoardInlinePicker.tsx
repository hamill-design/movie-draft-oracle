import { DraftMovieSearchList } from './DraftMovieSearchList';
import { Movie } from '@/data/movies';
import type { DraftBoardPickerState } from '@/hooks/useDraftBoardPicker';

interface DraftBoardInlinePickerProps {
  theme: string;
  draftOption: string;
  categories: string[];
  specCategories?: Map<string, number[]>;
  pickerState: DraftBoardPickerState;
  movies: Movie[];
  moviesLoading: boolean;
  onSearchChange: (query: string) => void;
  onMovieSelect: (movie: Movie) => void;
  onConfirm: (houseOverride?: boolean) => void;
  confirming?: boolean;
}

export function DraftBoardInlinePicker({
  theme,
  draftOption,
  categories,
  specCategories,
  pickerState,
  movies,
  moviesLoading,
  onSearchChange,
  onMovieSelect,
  onConfirm,
  confirming,
}: DraftBoardInlinePickerProps) {
  if (!pickerState.activeCategory) return null;

  return (
    <div className="col-span-full w-full border-t border-[hsl(var(--greyscale-blue-800))]">
      <DraftMovieSearchList
        theme={theme}
        option={draftOption}
        categories={categories}
        specCategories={specCategories}
        searchQuery={pickerState.searchQuery}
        onSearchChange={onSearchChange}
        movies={movies}
        loading={moviesLoading}
        selectedMovie={pickerState.selectedMovie}
        onMovieSelect={onMovieSelect}
        activeCategory={pickerState.activeCategory}
        onConfirm={onConfirm}
        confirming={confirming}
        compact
      />
    </div>
  );
}
