import { supabase } from '@/integrations/supabase/client';
import { getGenreName } from '@/utils/specDraftGenreMapper';

/** Max length when showing stored movie_overview on theme pages */
const THEME_OVERVIEW_MAX = 360;

export type PublicSpecDraftSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  photo_url: string | null;
  display_order: number | null;
};

export type PublicSpecDraftMovie = {
  id: string;
  movie_tmdb_id: number;
  movie_title: string;
  movie_year: number | null;
  movie_poster_path: string | null;
  movie_genres: number[] | null;
  movie_overview: string | null;
  seo_blurb: string | null;
  created_at: string;
};

export function truncateForThemePage(text: string, max = THEME_OVERVIEW_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const safe = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trim()}…`;
}

/** Line used when no overview or seo blurb is stored. */
export function themeMovieSeoLine(movie: PublicSpecDraftMovie, themeName: string): string {
  const ids = movie.movie_genres || [];
  const labels = ids
    .slice(0, 4)
    .map((id) => getGenreName(id))
    .filter((g) => g !== 'Unknown');
  const genrePart = labels.length ? labels.join(', ') : 'Feature';
  const yearPart = movie.movie_year != null ? ` (${movie.movie_year})` : '';
  return `${genrePart}${yearPart}. A curated pick in Movie Drafter’s “${themeName}” movie drafting game pool.`;
}

/** Public theme page body copy: curated blurb wins, then TMDB-style overview, then generated line. */
export function themeMovieDisplayText(movie: PublicSpecDraftMovie, themeName: string): string {
  const blurb = movie.seo_blurb?.trim();
  if (blurb) return blurb;
  const overview = movie.movie_overview?.trim();
  if (overview) return truncateForThemePage(overview);
  return themeMovieSeoLine(movie, themeName);
}

export async function fetchPublicSpecDraftSummaries(): Promise<PublicSpecDraftSummary[]> {
  const queryResult = await supabase
    .from('spec_drafts' as never)
    .select('id, name, slug, description, photo_url, display_order')
    .eq('is_hidden', false)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = queryResult as {
    data: PublicSpecDraftSummary[] | null;
    error: { message?: string } | null;
  };

  if (error) {
    console.error('fetchPublicSpecDraftSummaries:', error);
    return [];
  }

  return (data || []).filter((row) => Boolean(row.slug && String(row.slug).trim()));
}

export async function fetchPublicSpecDraftBySlug(
  slug: string
): Promise<{ draft: PublicSpecDraftSummary; movies: PublicSpecDraftMovie[] } | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const queryResult = await supabase
    .from('spec_drafts' as never)
    .select('id, name, slug, description, photo_url, display_order')
    .eq('slug', trimmed)
    .eq('is_hidden', false)
    .maybeSingle();

  const { data: draft, error: draftErr } = queryResult as {
    data: PublicSpecDraftSummary | null;
    error: { message?: string } | null;
  };

  if (draftErr || !draft) {
    return null;
  }

  const moviesResult = await supabase
    .from('spec_draft_movies' as never)
    .select(
      'id, movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres, movie_overview, seo_blurb, created_at'
    )
    .eq('spec_draft_id', draft.id)
    .order('created_at', { ascending: true });

  const { data: movieRows, error: movieErr } = moviesResult as {
    data: PublicSpecDraftMovie[] | null;
    error: { message?: string } | null;
  };

  if (movieErr) {
    console.error('fetchPublicSpecDraftBySlug movies:', movieErr);
    return { draft, movies: [] };
  }

  return { draft, movies: movieRows || [] };
}

export function posterUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
}
