import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Custom categories for person drafts (actor_spec_categories) and special drafts
// (spec_draft_movie_categories): category name -> TMDB movie ids that qualify.
// Same output shape the web hooks useActorSpecCategories / useSpecDraftCategories produce.
export function useSpecCategories(theme: string | undefined, option: string | undefined) {
  const [map, setMap] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (theme === "spec-draft" && option) {
        const { data } = await supabase
          .from("spec_draft_movies")
          .select("movie_tmdb_id, spec_draft_movie_categories(category_name)")
          .eq("spec_draft_id", option);
        const next = new Map<string, number[]>();
        (data ?? []).forEach((row: any) => {
          (row.spec_draft_movie_categories ?? []).forEach(({ category_name }: any) => {
            next.set(category_name, [...(next.get(category_name) ?? []), row.movie_tmdb_id]);
          });
        });
        if (!cancelled) setMap(next);
      } else if (theme === "people" && option) {
        const actor = option.includes("|") ? option.split("|")[0] : option;
        let { data } = await supabase
          .from("actor_spec_categories")
          .select("category_name, movie_tmdb_ids")
          .eq("actor_name", actor);
        if (!data || data.length === 0) {
          ({ data } = await supabase
            .from("actor_spec_categories")
            .select("category_name, movie_tmdb_ids")
            .ilike("actor_name", actor));
        }
        const next = new Map<string, number[]>();
        (data ?? []).forEach((r: any) => next.set(r.category_name, r.movie_tmdb_ids ?? []));
        if (!cancelled) setMap(next);
      } else if (!cancelled) {
        setMap(new Map());
      }
    };
    run().catch(() => !cancelled && setMap(new Map()));
    return () => {
      cancelled = true;
    };
  }, [theme, option]);

  return map;
}
