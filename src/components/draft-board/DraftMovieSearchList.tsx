import { useEffect, useState } from 'react';
import { Movie } from '@/data/movies';
import { getCleanActorName } from '@/lib/utils';
import { INPUT_LIMITS } from '@/utils/inputValidation';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { Switch } from '@/components/ui/switch';
import { getEligibleCategories } from '@/utils/movieCategoryUtils';
import { Check, Loader2, X } from 'lucide-react';
import { getCategoryDisplayName } from '@/utils/interactiveBoardModel';

export function normalizeMovieSearchQuery(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[''']/g, "'")
    .replace(/[–—]/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function filterMoviesForSearch(
  movies: Movie[],
  searchQuery: string,
  theme: string
): Movie[] {
  if (theme === 'year') return movies;
  if (!searchQuery.trim()) return movies;
  const normalizedQuery = normalizeMovieSearchQuery(searchQuery);
  return movies.filter((movie) =>
    normalizeMovieSearchQuery(movie.title).includes(normalizedQuery)
  );
}

export function getMovieSearchPlaceholder(theme: string, option: string): string {
  if (theme === 'spec-draft') return 'Search movies...';
  if (theme === 'year') return `Search within ${option} movies...`;
  if (theme === 'people') return `Search within ${getCleanActorName(option)} movies...`;
  return 'Search for movies...';
}

export function shouldShowMovieSearchResults(theme: string, searchQuery: string): boolean {
  if (theme === 'year' || theme === 'people') return searchQuery.trim().length >= 2;
  return searchQuery.trim().length > 0;
}

function getGenreText(movie: Movie): string {
  if (movie.genre) return `${movie.year} • ${movie.genre}`;
  if (movie.genre_names?.[0]) return `${movie.year} • ${movie.genre_names[0]}`;
  return `${movie.year}`;
}

function getEmptyResultsMessage(theme: string, option: string, searchQuery: string): string {
  if (searchQuery.trim()) {
    const suffix =
      theme === 'spec-draft'
        ? ''
        : theme === 'year'
          ? ` from ${option}`
          : theme === 'people'
            ? ` featuring ${getCleanActorName(option)}`
            : '';
    return `No movies found matching "${searchQuery}"${suffix}`;
  }
  if (theme === 'spec-draft') return 'No movies available for this draft';
  if (theme === 'year') return `No movies available for ${option}`;
  if (theme === 'people') return `No movies available for ${getCleanActorName(option)}`;
  return 'No movies available for this search';
}

function getMovieYear(movie: Movie): number {
  if (movie.releaseDate) return new Date(movie.releaseDate).getFullYear();
  return movie.year || new Date().getFullYear();
}

function isMovieEligibleForCategory(
  movie: Movie,
  category: string,
  categories: string[],
  theme: string,
  option: string,
  specCategories?: Map<string, number[]>
): boolean {
  return getEligibleCategories(movie, categories, theme, option, specCategories).includes(category);
}

function hasYearMismatch(movie: Movie, theme: string, option: string): boolean {
  if (theme !== 'year' || !option) return false;
  const expectedYear = parseInt(option, 10);
  if (Number.isNaN(expectedYear)) return false;
  return getMovieYear(movie) !== expectedYear;
}

interface DraftMovieSearchListProps {
  theme: string;
  option: string;
  categories: string[];
  specCategories?: Map<string, number[]>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  movies: Movie[];
  loading: boolean;
  selectedMovie: Movie | null;
  onMovieSelect: (movie: Movie) => void;
  activeCategory: string | null;
  onConfirm: (houseOverride?: boolean) => void;
  confirming?: boolean;
  compact?: boolean;
}

function ConfirmPickButton({
  activeCategory,
  confirming,
  houseOverride,
  onConfirm,
  className,
}: {
  activeCategory: string;
  confirming: boolean;
  houseOverride: boolean;
  onConfirm: (houseOverride?: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onConfirm(houseOverride);
      }}
      disabled={confirming}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-[2px] bg-[hsl(var(--gold-primary))] px-3 py-2 text-sm font-brockmann font-medium leading-5 text-[hsl(var(--text-dark))] hover:opacity-90 disabled:opacity-60 sm:w-auto sm:shrink-0 ${className ?? ''}`}
    >
      {confirming ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <span className="text-center">
            Confirm in <strong className="font-bold">{getCategoryDisplayName(activeCategory)}</strong>
          </span>
          <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />
        </>
      )}
    </button>
  );
}

function CategoryMismatchBadge() {
  return (
    <div className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-[2px] bg-purple-800 px-3 py-2 opacity-80 sm:w-auto sm:min-w-[188px] sm:shrink-0">
      <span className="text-center text-sm font-brockmann font-medium leading-5 text-greyscale-blue-100">
        Category Mismatch
      </span>
      <X className="h-3 w-3 shrink-0 text-greyscale-blue-100" strokeWidth={2.5} />
    </div>
  );
}

function HouseOverrideToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-end gap-[13px] px-3 max-sm:w-full max-sm:items-end"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="w-[106px] text-center text-sm font-brockmann font-medium leading-5 text-greyscale-blue-100">
        House Override
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-brand-primary data-[state=unchecked]:bg-greyscale-blue-500"
      />
    </div>
  );
}

export function DraftMovieSearchList({
  theme,
  option,
  categories,
  specCategories,
  searchQuery,
  onSearchChange,
  movies,
  loading,
  selectedMovie,
  onMovieSelect,
  activeCategory,
  onConfirm,
  confirming = false,
  compact = false,
}: DraftMovieSearchListProps) {
  const [houseOverrideEnabled, setHouseOverrideEnabled] = useState(false);
  const filteredMovies = filterMoviesForSearch(movies, searchQuery, theme);
  const shouldShowResults = shouldShowMovieSearchResults(theme, searchQuery);
  const resultsMaxHeight = compact ? '180px' : '240px';

  useEffect(() => {
    setHouseOverrideEnabled(false);
  }, [activeCategory, selectedMovie?.id]);

  const renderSelectedRow = (movie: Movie) => {
    const isCategoryEligible = isMovieEligibleForCategory(
      movie,
      activeCategory!,
      categories,
      theme,
      option,
      specCategories
    );
    const yearMismatch = hasYearMismatch(movie, theme, option);
    const canConfirm = isCategoryEligible && !yearMismatch;
    const showMismatch = !canConfirm && !houseOverrideEnabled;
    const showConfirm = canConfirm || houseOverrideEnabled;

    const titleClass = compact
      ? 'text-left text-sm font-brockmann font-semibold leading-5 tracking-[0.28px] text-greyscale-blue-100'
      : 'text-left text-base font-brockmann font-semibold leading-6 tracking-[0.32px] text-greyscale-blue-100';
    const genreClass = compact
      ? 'text-left text-[10px] leading-[14px] tracking-[0.30px] sm:text-[12px] sm:leading-[16px] sm:tracking-[0.36px] font-brockmann text-greyscale-blue-100 opacity-75'
      : 'text-left text-[12px] font-brockmann leading-[16px] tracking-[0.36px] text-greyscale-blue-100 opacity-75';

    return (
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-3 rounded bg-brand-primary px-3 py-2 sm:min-h-[70px] sm:flex-row sm:flex-wrap sm:content-center sm:items-center sm:justify-between sm:px-4 sm:py-3"
          onClick={() => onMovieSelect(movie)}
        >
          <div className="inline-flex min-w-0 flex-1 flex-col items-start gap-1 pb-0.5">
            <div className={titleClass}>{movie.title}</div>
            <div className={genreClass}>{getGenreText(movie)}</div>
          </div>
          {(showMismatch || showConfirm) && (
            <div className="flex w-full min-w-0 items-stretch sm:w-auto sm:shrink-0 sm:justify-end">
              {showMismatch ? (
                <CategoryMismatchBadge />
              ) : (
                <ConfirmPickButton
                  activeCategory={activeCategory!}
                  confirming={confirming}
                  houseOverride={houseOverrideEnabled}
                  onConfirm={onConfirm}
                />
              )}
            </div>
          )}
        </div>
        {!canConfirm && (
          <HouseOverrideToggle
            enabled={houseOverrideEnabled}
            onChange={setHouseOverrideEnabled}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className="flex h-full w-full min-w-0 max-w-full flex-col items-start justify-start gap-3 p-3"
    >
      <div className="flex w-full min-w-0 flex-col items-start gap-3 self-stretch sm:gap-[18px]">
        <div className="inline-flex w-full items-center gap-3 self-stretch overflow-hidden rounded-[2px] bg-greyscale-purp-850 px-4 py-3 outline outline-1 outline-offset-[-1px] outline-greyscale-blue-100">
          <div className="inline-flex w-6 shrink-0 flex-col items-center justify-center px-0.5 py-1">
            <SearchIcon className="h-4 w-4 text-greyscale-blue-300" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start overflow-hidden">
            <input
              placeholder={getMovieSearchPlaceholder(theme, option)}
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH) {
                  onSearchChange(value);
                }
              }}
              maxLength={INPUT_LIMITS.MAX_SEARCH_QUERY_LENGTH}
              className="w-full border-none bg-transparent text-sm font-brockmann font-medium leading-5 text-greyscale-blue-100 placeholder:text-greyscale-blue-300 placeholder:opacity-100 outline-none"
              autoFocus
            />
          </div>
        </div>

        {shouldShowResults && (
          <div
            className="flex w-full flex-col items-stretch gap-2 self-stretch overflow-x-hidden overflow-y-auto"
            style={{ maxHeight: resultsMaxHeight }}
          >
            {loading ? (
              <div className="text-sm font-brockmann leading-5 text-greyscale-blue-100">
                Loading movies...
              </div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-sm font-brockmann leading-5 text-greyscale-blue-100">
                {getEmptyResultsMessage(theme, option, searchQuery)}
              </div>
            ) : (
              filteredMovies.slice(0, 50).map((movie) => {
                const isSelected = selectedMovie?.id === movie.id;

                if (isSelected && activeCategory) {
                  return (
                    <div key={movie.id} className="w-full min-w-0 self-stretch">
                      {renderSelectedRow(movie)}
                    </div>
                  );
                }

                const titleClass = compact
                  ? 'text-left text-sm font-brockmann font-semibold leading-5 tracking-[0.28px] text-greyscale-blue-100'
                  : 'text-left text-base font-brockmann font-semibold leading-6 tracking-[0.32px] text-greyscale-blue-100';
                const genreClass = compact
                  ? 'text-left text-[10px] leading-[14px] tracking-[0.30px] sm:text-[12px] sm:leading-[16px] sm:tracking-[0.36px] font-brockmann text-greyscale-blue-100 opacity-75'
                  : 'text-left text-[12px] font-brockmann leading-[16px] tracking-[0.36px] text-greyscale-blue-100 opacity-75';

                return (
                  <div
                    key={movie.id}
                    onClick={() => onMovieSelect(movie)}
                    className="inline-flex w-full min-w-0 cursor-pointer flex-wrap content-center items-center justify-between gap-3 self-stretch rounded bg-greyscale-purp-850 px-3 py-2 outline outline-1 outline-offset-[-1px] outline-greyscale-purp-600 sm:px-4 sm:py-3"
                  >
                    <div className="inline-flex min-w-0 flex-col items-start gap-1 pb-0.5">
                      <div className={titleClass}>{movie.title}</div>
                      <div className={genreClass}>{getGenreText(movie)}</div>
                    </div>
                  </div>
                );
              })
            )}
            {filteredMovies.length > 50 && (
              <div className="w-full py-2 text-center text-sm font-brockmann leading-5 text-greyscale-blue-100">
                Showing first 50 results of {filteredMovies.length} movies. Use search to narrow down.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
