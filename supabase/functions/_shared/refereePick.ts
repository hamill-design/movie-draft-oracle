// Server-side movie picking for the referee (auto-picks and bot picks).
//
// This is a port of the bot logic in src/utils/aiPickLogic.ts and the category
// rules in src/utils/movieCategoryUtils.ts, so that an auto-pick made by the
// server is the SAME quality of pick a bot makes in the browser today
// (decision: "auto-pick strength = same as the bots").
//
// KEEP IN SYNC: if you change how bots choose movies or which categories a movie
// qualifies for in the browser code, change it here too. (A past bug came from
// exactly this kind of drift: docs/ memory "AI pick year bug".)
//
// This file has NO Deno- or network-specific code, so it can be unit tested in
// Node (supabase/tests/refereePick.test.mjs). The database/network access lives
// behind the PoolSource interface and is implemented in referee-tick/index.ts.

import { isGlobalStandardCategory } from './globalStandardCategories.ts';

export interface PoolMovie {
  id: number;
  title: string;
  year?: number;
  genre?: string;
  voteAverage?: number;
  vote_count?: number;
  hasOscar?: boolean;
  oscar_status?: string;
  isBlockbuster?: boolean;
  isSequel?: boolean;
  budget?: number;
  revenue?: number;
  tmdbId?: number;
  posterPath?: string | null;
  poster_path?: string | null;
}

export interface SpecDraftMovieRow {
  id: string;
  movie_tmdb_id: number;
  movie_title: string;
  movie_year: number | null;
  movie_poster_path: string | null;
  movie_genres: number[] | null;
  is_sequel: boolean | null;
}

/** Everything the picker needs from the outside world. */
export interface PoolSource {
  specDraftMovies(specDraftId: string): Promise<SpecDraftMovieRow[]>;
  /** ids (spec_draft_movies.id) tagged with this category name */
  specDraftMovieIdsForCategory(categoryName: string): Promise<string[]>;
  /** each movie of the spec draft with its admin-tagged custom categories */
  specDraftMoviesWithCategories(specDraftId: string): Promise<{ movie_tmdb_id: number; categories: string[] }[]>;
  actorSpecCategories(actorName: string): Promise<{ category_name: string; movie_tmdb_ids: number[] | null }[]>;
  /** the existing `fetch-movies` function */
  fetchMovies(body: Record<string, unknown>): Promise<{ results?: PoolMovie[]; movies?: PoolMovie[] } | null>;
}

export type Rng = () => number;

// ── Category rules (port of getEligibleCategories) ──────────────────────

const ALWAYS_AVAILABLE_CATEGORIES = new Set<string>(['Wild Card']);
const GENRE_CATEGORIES = ['Action/Adventure', 'Animated', 'Comedy', 'Drama/Romance', 'Sci-Fi/Fantasy', 'Horror/Thriller'];

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller',
  10752: 'War', 37: 'Western',
};

export function getGenreName(genreId: number): string {
  return TMDB_GENRE_MAP[genreId] || 'Unknown';
}

export function getCleanActorName(option: string): string {
  return option.includes('|') ? option.split('|')[0] : option;
}

export function getEligibleCategories(
  movie: PoolMovie,
  allCategories: string[],
  theme?: string,
  option?: string,
  specCategoriesMap?: Map<string, number[]>,
): string[] {
  if (!movie) return [];
  const eligible: string[] = [];

  if ((theme === 'people' || theme === 'spec-draft') && option && specCategoriesMap && specCategoriesMap.size > 0) {
    const movieId = movie.tmdbId || movie.id;
    specCategoriesMap.forEach((movieIds, categoryName) => {
      if (isGlobalStandardCategory(categoryName)) return;
      if (allCategories.includes(categoryName) && movieId && movieIds.includes(movieId)) {
        eligible.push(categoryName);
      }
    });
  }

  const year = movie.year ?? 0;
  const decades: [number, string][] = [
    [1930, "30's"], [1940, "40's"], [1950, "50's"], [1960, "60's"], [1970, "70's"],
    [1980, "80's"], [1990, "90's"], [2000, "2000's"], [2010, "2010's"], [2020, "2020's"],
  ];
  for (const [start, name] of decades) {
    if (year >= start && year <= start + 9) eligible.push(name);
  }

  // Whole-word genre matching so "animation" never matches "action" etc.
  const genreWords = (movie.genre?.toLowerCase().trim() || '').split(/\s+/).filter(Boolean);
  const hasGenre = (keyword: string) => genreWords.some((w) => w === keyword);

  if (hasGenre('action') || hasGenre('adventure')) eligible.push('Action/Adventure');
  if (hasGenre('animation') || hasGenre('animated')) eligible.push('Animated');
  if (hasGenre('comedy')) eligible.push('Comedy');
  if (hasGenre('drama') || hasGenre('romance')) eligible.push('Drama/Romance');
  if (hasGenre('sci-fi') || hasGenre('fantasy')) eligible.push('Sci-Fi/Fantasy');
  if (hasGenre('horror') || hasGenre('thriller')) eligible.push('Horror/Thriller');
  if (hasGenre('documentary')) eligible.push('Documentary');

  if (allCategories.includes('Academy Award Nominee or Winner')) {
    if (movie.hasOscar === true || movie.oscar_status === 'winner' || movie.oscar_status === 'nominee') {
      eligible.push('Academy Award Nominee or Winner');
    }
  }
  if (movie.isBlockbuster && allCategories.includes('Blockbuster (minimum of $50 Mil)')) {
    eligible.push('Blockbuster (minimum of $50 Mil)');
  }
  if (movie.isSequel === true && allCategories.includes('Sequel')) {
    eligible.push('Sequel');
  }

  allCategories.forEach((category) => {
    if (ALWAYS_AVAILABLE_CATEGORIES.has(category)) eligible.push(category);
  });

  return eligible.filter((category) => allCategories.includes(category));
}

// ── Quality scoring (port of calculateQualityScore) ─────────────────────

export function qualityScore(movie: PoolMovie): number {
  let score = 0;

  const voteAverage = movie.voteAverage || 0;
  const voteCount = movie.vote_count || 0;
  if (voteAverage > 0 && voteCount >= 100) {
    score += voteAverage * 10;
    if (voteCount >= 1000) score += 5;
    if (voteCount >= 5000) score += 5;
  } else if (voteAverage > 0) {
    score += voteAverage * 5;
  }

  const oscarStatus = movie.oscar_status || (movie.hasOscar ? 'nominee' : null);
  if (oscarStatus === 'winner') score += 20;
  else if (oscarStatus === 'nominee') score += 10;

  if (movie.isBlockbuster) score += 5;

  const budget = movie.budget || 0;
  const revenue = movie.revenue || 0;
  if (budget >= 50_000_000) score += 3;
  if (revenue >= 100_000_000) score += 2;

  const year = movie.year || 0;
  if (year >= 1990 && year <= 2010) score += 2;

  return score;
}

// ── Choosing a movie from a pool (port of the end of makeAIPick) ────────

export interface ChooseInput {
  movies: PoolMovie[];
  alreadyPickedMovieIds: number[];
  theme: string;
  option: string;
  currentCategory: string;
  allCategories: string[];
  specCategoriesMap?: Map<string, number[]>;
}

export function chooseMovie(input: ChooseInput, rng: Rng = Math.random): PoolMovie | null {
  const { movies, alreadyPickedMovieIds, theme, option, currentCategory, allCategories, specCategoriesMap } = input;

  const picked = new Set(alreadyPickedMovieIds);
  const notYetPicked = movies.filter((m) => !picked.has(m.id));

  // Year drafts: enforce the exact year ourselves (re-release metadata can leak other years in).
  const unpicked = theme === 'year' && option
    ? notYetPicked.filter((m) => m.year === parseInt(option, 10))
    : notYetPicked;

  let available = unpicked;

  if (currentCategory) {
    const effectiveAll = allCategories && allCategories.length > 0 ? allCategories : [currentCategory];
    available = available.filter((movie) => {
      if (!movie || !movie.title) return false;
      if (!movie.genre || movie.genre === 'Unknown' || movie.genre.trim() === '') {
        if (GENRE_CATEGORIES.includes(currentCategory)) return false;
      }
      return getEligibleCategories(movie, effectiveAll, theme, option, specCategoriesMap).includes(currentCategory);
    });
  }

  // Nothing fits the category (e.g. Blockbuster with only small films left): best of what remains,
  // so the draft can still finish.
  if (available.length === 0 && unpicked.length > 0) available = unpicked;
  if (available.length === 0) return null;

  const sorted = [...available].sort((a, b) => {
    const qa = qualityScore(a);
    const qb = qualityScore(b);
    if (qb !== qa) return qb - qa;

    const va = a.voteAverage || 0;
    const vb = b.voteAverage || 0;
    if (vb !== va) return vb - va;

    if (a.year && b.year) {
      const inA = a.year >= 1990 && a.year <= 2020;
      const inB = b.year >= 1990 && b.year <= 2020;
      if (inA && !inB) return -1;
      if (!inA && inB) return 1;
      return a.year - b.year;
    }
    return 0;
  });

  // Top 3, and if they are within 5 points of the best, pick one of them at random for variety.
  const top = sorted.slice(0, Math.min(3, sorted.length));
  const topScore = qualityScore(top[0]);
  const close = top.filter((m) => Math.abs(qualityScore(m) - topScore) <= 5);
  const index = close.length > 1 ? Math.floor(rng() * close.length) : 0;
  return close[index] || sorted[0] || null;
}

// ── Loading the pool (port of the first half of makeAIPick) ─────────────

export interface Pool {
  movies: PoolMovie[];
  specCategoriesMap?: Map<string, number[]>;
  /** spec drafts only: the raw rows, so per-category narrowing needs no extra query */
  specRows?: SpecDraftMovieRow[];
}

function specMovieToPoolMovie(row: SpecDraftMovieRow): PoolMovie {
  const genre = Array.isArray(row.movie_genres)
    ? row.movie_genres.map(getGenreName).filter(Boolean).join(' ')
    : '';
  return {
    id: row.movie_tmdb_id,
    tmdbId: row.movie_tmdb_id,
    title: row.movie_title,
    year: row.movie_year ?? undefined,
    posterPath: row.movie_poster_path,
    genre,
    voteAverage: 0,
    vote_count: 0,
    isSequel: row.is_sequel === true,
  };
}

/** The pool that doesn't depend on which category is being filled. */
export async function loadBasePool(source: PoolSource, theme: string, option: string): Promise<Pool> {
  if (theme === 'spec-draft' && option) {
    const rows = await source.specDraftMovies(option);
    const withCats = await source.specDraftMoviesWithCategories(option);
    const specCategoriesMap = new Map<string, number[]>();
    for (const row of withCats) {
      for (const category of row.categories) {
        const ids = specCategoriesMap.get(category);
        if (ids) ids.push(row.movie_tmdb_id);
        else specCategoriesMap.set(category, [row.movie_tmdb_id]);
      }
    }
    return { movies: rows.map(specMovieToPoolMovie), specCategoriesMap, specRows: rows };
  }

  const isPeople = theme === 'people' || theme === 'person';
  // Same as the browser: only the legacy 'person' theme strips a corrupted "Name|id" option.
  const cleanedOption = theme === 'person' ? getCleanActorName(option || '') : option || '';

  const body = theme === 'year'
    ? { category: 'year', searchQuery: cleanedOption, movieSearchQuery: '', fetchAll: false, page: 1, pageLimit: 50 }
    : isPeople
    ? { category: 'person', searchQuery: cleanedOption, movieSearchQuery: '', fetchAll: false, page: 1, pageLimit: 50 }
    : { category: 'all', searchQuery: cleanedOption, fetchAll: true };

  const data = await source.fetchMovies(body);
  const movies = (data?.results && Array.isArray(data.results))
    ? data.results
    : (data?.movies && Array.isArray(data.movies))
    ? data.movies
    : [];

  let specCategoriesMap: Map<string, number[]> | undefined;
  if (isPeople && option) {
    specCategoriesMap = new Map();
    const rows = await source.actorSpecCategories(cleanedOption);
    for (const row of rows) specCategoriesMap.set(row.category_name, row.movie_tmdb_ids || []);
  }
  return { movies, specCategoriesMap };
}

/** Spec drafts only offer movies tagged for the category being filled (when tags exist). */
async function narrowForCategory(source: PoolSource, pool: Pool, theme: string, option: string, category: string): Promise<PoolMovie[]> {
  if (theme !== 'spec-draft' || !option || !category.trim()) return pool.movies;
  // Same behaviour as the browser: tagged ids intersect this draft's movies; if nothing is tagged, no narrowing.
  const taggedIds = await source.specDraftMovieIdsForCategory(category.trim());
  if (taggedIds.length === 0) return pool.movies;
  const tagged = new Set(taggedIds);
  const allowedTmdb = new Set((pool.specRows ?? []).filter((r) => tagged.has(r.id)).map((r) => r.movie_tmdb_id));
  return pool.movies.filter((m) => allowedTmdb.has(m.id));
}

// ── The whole decision ──────────────────────────────────────────────────

export interface AutoPickInput {
  theme: string;
  option: string;
  categories: string[];
  openCategories: string[];
  pickedMovieIds: number[];
}

/** What the database function referee_apply_pick() stores. */
export interface PickRecord {
  id: number;
  title: string;
  year: number;
  genre: string;
  posterPath: string | null;
}

export interface AutoPickResult {
  category: string;
  movie: PickRecord;
}

export function toPickRecord(movie: PoolMovie, now: Date = new Date()): PickRecord {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || now.getFullYear(),
    genre: movie.genre || 'Unknown',
    posterPath: movie.posterPath ?? movie.poster_path ?? null,
  };
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick a category (random one the player hasn't filled) and a movie for it.
 * If no movie works for that category, try the next category rather than give up.
 */
export async function selectAutoPick(
  source: PoolSource,
  input: AutoPickInput,
  rng: Rng = Math.random,
): Promise<AutoPickResult | null> {
  const candidates = input.openCategories.length > 0 ? input.openCategories : input.categories;
  if (candidates.length === 0) return null;

  const pool = await loadBasePool(source, input.theme, input.option);

  for (const category of shuffled(candidates, rng)) {
    const movies = await narrowForCategory(source, pool, input.theme, input.option, category);
    const movie = chooseMovie(
      {
        movies,
        alreadyPickedMovieIds: input.pickedMovieIds,
        theme: input.theme,
        option: input.option,
        currentCategory: category,
        allCategories: input.categories,
        specCategoriesMap: pool.specCategoriesMap,
      },
      rng,
    );
    if (movie) return { category, movie: toPickRecord(movie) };
  }
  return null;
}
