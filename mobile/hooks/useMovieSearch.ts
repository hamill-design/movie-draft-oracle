import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getGenreName } from "../lib/specDraftGenreMapper";
import { mergeOscarStatusFromSources } from "../lib/movieCategoryUtils";

// Shape returned by the fetch-movies edge function (and built for special drafts).
export interface PickerMovie {
  id: number;
  tmdbId?: number;
  title: string;
  year: number;
  genre: string;
  genre_names?: string[];
  poster_path?: string | null;
  posterPath?: string | null;
  releaseDate?: string;
  hasOscar?: boolean;
  oscar_status?: string;
  isBlockbuster?: boolean;
  isSequel?: boolean;
  overview?: string;
}

const cleanActorName = (option: string) => (option.includes("|") ? option.split("|")[0] : option);

// Mobile version of the web useMovies hook. `theme` is the draft's theme
// ('year' | 'people' | 'spec-draft' | anything else = popular movies), `option`
// is the year / actor / special-draft id, `query` is what the player typed.
export function useMovieSearch(
  theme: string | undefined,
  option: string | undefined,
  query: string,
  enabled: boolean,
) {
  const [movies, setMovies] = useState<PickerMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const category =
    theme === "spec-draft" ? "spec-draft" : theme === "people" ? "person" : theme === "year" ? "year" : "popular";

  // Only year / actor drafts search on the server as you type; the rest load once
  // and are filtered on the phone.
  const serverQuery = category === "year" || category === "person" ? query.trim() : "";

  useEffect(() => {
    if (!enabled || !theme) {
      setMovies([]);
      return;
    }
    const q = serverQuery;

    // Year drafts only search once you've typed something; actor drafts show a first page.
    if (category === "year" && q.length < 2) {
      setMovies([]);
      setLoading(false);
      return;
    }
    if (category === "person" && !option) return;

    const id = ++requestId.current;
    const stale = () => id !== requestId.current;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        let results: PickerMovie[] = [];

        if (category === "spec-draft" && option) {
          const { data, error: e } = await supabase
            .from("spec_draft_movies")
            .select("movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres, is_sequel")
            .eq("spec_draft_id", option)
            .order("movie_title", { ascending: true });
          if (e) throw e;
          results = (data ?? []).map((m: any) => ({
            id: m.movie_tmdb_id,
            tmdbId: m.movie_tmdb_id,
            title: m.movie_title,
            year: m.movie_year,
            poster_path: m.movie_poster_path,
            genre: Array.isArray(m.movie_genres)
              ? m.movie_genres.map((g: number) => getGenreName(g)).filter(Boolean).join(" ")
              : "",
            isSequel: m.is_sequel === true,
          }));
        } else {
          const body =
            category === "year"
              ? { category, searchQuery: option ?? "", movieSearchQuery: q, fetchAll: false, page: 1, pageLimit: 20 }
              : category === "person"
                ? {
                    category,
                    searchQuery: cleanActorName(option ?? ""),
                    movieSearchQuery: q,
                    fetchAll: false,
                    page: 1,
                    pageLimit: 20,
                  }
                : { category, searchQuery: "", fetchAll: true };
          const { data, error: e } = await supabase.functions.invoke("fetch-movies", { body });
          if (e) throw e;
          results = data?.results ?? [];
        }
        if (stale()) return;

        // Fold in cached Oscar status so the Academy Award category works.
        const ids = results.filter((m) => m.id && m.oscar_status == null).map((m) => m.id);
        if (ids.length > 0) {
          const cache = new Map<number, string>();
          for (let i = 0; i < ids.length; i += 200) {
            const { data } = await supabase
              .from("oscar_cache")
              .select("tmdb_id, oscar_status")
              .in("tmdb_id", ids.slice(i, i + 200));
            (data ?? []).forEach((r: any) => cache.set(r.tmdb_id, r.oscar_status));
          }
          results = results.map((m) => {
            const cached = cache.get(m.id);
            if (cached === undefined && m.oscar_status === undefined) return m;
            const merged = mergeOscarStatusFromSources(m.oscar_status, cached);
            return { ...m, oscar_status: merged.oscar_status, hasOscar: merged.hasOscar };
          });
        }
        if (stale()) return;
        setMovies(results);
      } catch (e) {
        if (stale()) return;
        setError(e instanceof Error ? e.message : "Could not load movies.");
        setMovies([]);
      } finally {
        if (!stale()) setLoading(false);
      }
    };

    // Debounce typing for the server-side searches; load the rest right away.
    const delay = category === "year" || (category === "person" && q.length >= 2) ? 500 : 0;
    const timer = setTimeout(run, delay);
    return () => clearTimeout(timer);
  }, [enabled, theme, option, category, serverQuery]);

  return { movies, loading, error };
}
