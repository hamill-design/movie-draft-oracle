import { supabase } from "./supabase";
import { getCategoriesForTheme, getCategoryConfig } from "./categoryConfigs";

// Data layer for starting a multiplayer draft from the app. Mirrors what the
// web's ThemeDraftSetup / SpecDraftSetup / useMultiplayerDraft do.

export type SetupTheme = "people" | "year" | "spec-draft";

export interface PersonResult {
  id: number;
  name: string;
  known_for_department?: string;
  profile_path: string | null;
}

export interface SpecDraftOption {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
}

export interface CategoryOption {
  name: string;
  /** Movies available for this category, when we know (spec lists / analysis). */
  count: number | null;
  /** Standard slots that never need validation (Wild Card, Oscar, Blockbuster…). */
  alwaysOk: boolean;
}

// Same range as the web's year picker.
export const SETUP_YEARS = Array.from({ length: 2025 - 1939 + 1 }, (_, i) => String(2025 - i));

const STANDARD_SPEC_CATEGORIES = [
  "Action/Adventure",
  "Animated",
  "Comedy",
  "Drama/Romance",
  "Sci-Fi/Fantasy",
  "Horror/Thriller",
  "30's",
  "40's",
  "50's",
  "60's",
  "70's",
  "80's",
  "90's",
  "2000's",
  "2010's",
  "2020's",
  "Academy Award Nominee or Winner",
  "Blockbuster (minimum of $50 Mil)",
  "Sequel",
  "Wild Card",
];

const ALWAYS_OK = new Set([
  "Wild Card",
  "Academy Award Nominee or Winner",
  "Blockbuster (minimum of $50 Mil)",
]);

export async function searchPeople(query: string): Promise<PersonResult[]> {
  const { data, error } = await supabase.functions.invoke("search-people", {
    body: { searchQuery: query.trim(), searchType: "person" },
  });
  if (error) throw error;
  return data?.results ?? [];
}

export async function fetchSpecDrafts(): Promise<SpecDraftOption[]> {
  const { data, error } = await supabase
    .from("spec_drafts")
    .select("id, name, description, photo_url, display_order, created_at")
    .eq("is_hidden", false)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SpecDraftOption[];
}

/** Category choices for the picked theme/option, with movie counts where the app can know them. */
export async function fetchCategoryOptions(theme: SetupTheme, option: string): Promise<CategoryOption[]> {
  const mk = (name: string, count: number | null): CategoryOption => ({
    name,
    count,
    alwaysOk: ALWAYS_OK.has(name) || getCategoryConfig(name)?.alwaysAvailable === true,
  });

  if (theme === "spec-draft") {
    const [custom, movies] = await Promise.all([
      supabase.from("spec_draft_categories").select("category_name").eq("spec_draft_id", option),
      supabase.from("spec_draft_movies").select("id, is_sequel").eq("spec_draft_id", option),
    ]);
    const movieRows = (movies.data ?? []) as { id: string; is_sequel: boolean | null }[];
    const counts = new Map<string, number>();
    if (movieRows.length > 0) {
      const { data: tags } = await supabase
        .from("spec_draft_movie_categories")
        .select("category_name")
        .in("spec_draft_movie_id", movieRows.map((m) => m.id));
      (tags ?? []).forEach((t: any) => counts.set(t.category_name, (counts.get(t.category_name) ?? 0) + 1));
    }
    counts.set("Sequel", movieRows.filter((m) => m.is_sequel === true).length);
    const names = [
      ...new Set([
        ...STANDARD_SPEC_CATEGORIES,
        ...((custom.data ?? []) as any[]).map((c) => c.category_name),
        ...counts.keys(),
      ]),
    ];
    return names.map((n) => mk(n, counts.get(n) ?? 0));
  }

  const base = getCategoriesForTheme(theme).map((c) => c.name);

  if (theme === "people") {
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
    const spec = (data ?? []) as { category_name: string; movie_tmdb_ids: number[] | null }[];
    const specNames = new Set(spec.map((s) => s.category_name));
    // Custom actor categories first, then the standard ones.
    return [
      ...spec.map((s) => mk(s.category_name, s.movie_tmdb_ids?.length ?? 0)),
      ...base.filter((n) => !specNames.has(n)).map((n) => mk(n, null)),
    ];
  }

  return base.map((n) => mk(n, null));
}

// Rough counts shown instantly (marked "~N") until the real numbers arrive — same table the website uses.
const ESTIMATES: Record<string, number> = {
  "Action/Adventure": 150,
  Comedy: 120,
  "Drama/Romance": 200,
  "Sci-Fi/Fantasy": 80,
  Animated: 60,
  "Horror/Thriller": 70,
  "30's": 15,
  "40's": 25,
  "50's": 35,
  "60's": 45,
  "70's": 40,
  "80's": 60,
  "90's": 100,
  "2000's": 120,
  "2010's": 150,
  "2020's": 50,
  "Academy Award Nominee or Winner": 80,
  "Blockbuster (minimum of $50 Mil)": 90,
  Sequel: 70,
};
export const estimateCount = (category: string): number => ESTIMATES[category] ?? 50;

// Real counts are cached for 10 minutes per theme+option+category, so changing the player count
// (which only changes the colours) never needs another network call.
const CACHE_MS = 10 * 60 * 1000;
const countCache = new Map<string, { count: number; at: number }>();
const cacheKey = (theme: string, option: string, category: string) => `${theme}|${option}|${category}`;

export function cachedCounts(theme: SetupTheme, option: string, categories: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of categories) {
    const hit = countCache.get(cacheKey(theme, option, c));
    if (hit && Date.now() - hit.at < CACHE_MS) out.set(c, hit.count);
  }
  return out;
}

/** Movie counts per category from the same edge function the website uses (one batched call). */
export async function analyzeCategories(
  theme: SetupTheme,
  option: string,
  categories: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const cached = cachedCounts(theme, option, categories);
  cached.forEach((v, k) => out.set(k, v));
  const todo = categories.filter((c) => !cached.has(c));
  if (todo.length === 0) return out;
  try {
    const { data, error } = await supabase.functions.invoke("analyze-category-availability", {
      body: { theme, option, categories: todo, playerCount: 2, draftMode: "multiplayer" },
    });
    if (error) throw error;
    (data?.results ?? []).forEach((r: any) => {
      const count = r.movieCount ?? 0;
      countCache.set(cacheKey(theme, option, r.categoryId), { count, at: Date.now() });
      out.set(r.categoryId, count);
    });
  } catch {
    /* keep the estimates */
  }
  return out;
}

export async function createMultiplayerDraft(args: {
  userId: string;
  hostName: string;
  theme: SetupTheme;
  option: string;
  optionLabel: string;
  categories: string[];
  emails: string[];
  leagueId?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_multiplayer_draft_unified", {
    p_participant_id: args.userId,
    p_title: args.optionLabel,
    p_theme: args.theme,
    p_option: args.option,
    p_categories: args.categories,
    p_participants: args.emails,
    p_participant_name: "Host",
    p_ai_participant_names: [],
  });
  if (error) throw error;
  const draftId: string | undefined = data?.[0]?.draft_id;
  if (!draftId) throw new Error("No draft returned from the server.");

  if (args.emails.length > 0) {
    // Email invitations + in-app notifications for invitees who already have accounts (best effort).
    try {
      await supabase.functions.invoke("send-draft-invitations", {
        body: {
          draftId,
          draftTitle: args.optionLabel,
          hostName: args.hostName,
          participantEmails: args.emails,
          theme: args.theme,
          option: args.option,
          optionLabel: args.optionLabel,
        },
      });
    } catch (e) {
      console.warn("send-draft-invitations failed:", e);
    }
    try {
      await supabase.rpc("invite_users_to_draft_by_email", { p_draft_id: draftId, p_emails: args.emails });
    } catch (e) {
      console.warn("invite_users_to_draft_by_email failed:", e);
    }
  }

  if (args.leagueId) {
    await supabase.from("league_drafts").insert({ league_id: args.leagueId, draft_id: draftId });
  }
  return draftId;
}
