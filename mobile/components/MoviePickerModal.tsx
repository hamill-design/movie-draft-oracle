import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Switch, TextInput, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getEligibleCategories, mergeOscarStatusFromSources } from "../lib/movieCategoryUtils";
import { categoryLabel } from "../lib/draftBoard";
import { colors } from "../lib/theme";
import { useMovieSearch, type PickerMovie } from "../hooks/useMovieSearch";
import { SearchIcon } from "./icons";
import { Text } from "./ui";

const MAX_RESULTS = 50;
const cleanActor = (s: string) => (s.includes("|") ? s.split("|")[0] : s);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[‘’']/g, "'")
    .replace(/[–—]/g, "-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const movieYear = (m: PickerMovie) => (m.releaseDate ? new Date(m.releaseDate).getFullYear() : m.year || new Date().getFullYear());

function placeholder(theme: string, option: string) {
  if (theme === "spec-draft") return "Search movies...";
  if (theme === "year") return `Search within ${option} movies...`;
  if (theme === "people") return `Search within ${cleanActor(option)} movies...`;
  return "Search for movies...";
}

function emptyMessage(theme: string, option: string, q: string) {
  const suffix = theme === "year" ? ` from ${option}` : theme === "people" ? ` featuring ${cleanActor(option)}` : "";
  return `No movies found matching "${q}"${suffix}`;
}

// Movie search + confirm, styled like the website's inline picker (text rows, brand selected row,
// gold "Confirm in {Category}", purple "Category Mismatch" with House Override).
export function MoviePickerModal({
  visible,
  category,
  theme,
  option,
  categories,
  specCategories,
  takenMovieIds,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  category: string | null;
  theme: string;
  option: string;
  categories: string[];
  specCategories: Map<string, number[]>;
  takenMovieIds: Set<number>;
  onClose: () => void;
  /** Returns an error message, or null when the pick went through. */
  onConfirm: (movie: PickerMovie, category: string) => Promise<string | null>;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickerMovie | null>(null);
  const [checkingOscar, setCheckingOscar] = useState(false);
  const [houseOverride, setHouseOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelected(null);
      setHouseOverride(false);
      setError(null);
    }
  }, [visible, category]);

  const { movies, loading } = useMovieSearch(theme, option, query, visible);

  const q = query.trim();
  const showResults = theme === "year" || theme === "people" ? q.length >= 2 : q.length > 0;
  const filtered = useMemo(() => {
    if (!showResults) return [];
    return theme === "year" ? movies : movies.filter((m) => normalize(m.title).includes(normalize(q)));
  }, [movies, showResults, theme, q]);
  const results = filtered.slice(0, MAX_RESULTS);

  const select = async (movie: PickerMovie) => {
    setSelected(movie);
    setHouseOverride(false);
    setError(null);
    // The Academy Award category needs fresh Oscar data for the chosen movie.
    if (category?.startsWith("Academy Award") && movie.id) {
      setCheckingOscar(true);
      try {
        const { data: cached } = await supabase.from("oscar_cache").select("oscar_status").eq("tmdb_id", movie.id).maybeSingle();
        let status: string | undefined = cached?.oscar_status;
        if (!cached) {
          const { data } = await supabase.functions.invoke("enrich-movie-data", {
            body: { movieId: movie.id, movieTitle: movie.title, movieYear: movie.year },
          });
          status = data?.enrichmentData?.oscarStatus ?? data?.enrichmentData?.oscar_status;
        }
        const merged = mergeOscarStatusFromSources(movie.oscar_status, status);
        setSelected((cur) => (cur && cur.id === movie.id ? { ...cur, oscar_status: merged.oscar_status, hasOscar: merged.hasOscar } : cur));
      } catch {
        /* keep what we have */
      } finally {
        setCheckingOscar(false);
      }
    }
  };

  const eligible = (m: PickerMovie) => {
    if (!category) return false;
    const inCategory = getEligibleCategories({ ...m, year: movieYear(m) }, categories, theme, option, specCategories).includes(category);
    if (!inCategory) return false;
    if (theme === "year" && option) {
      const expected = parseInt(option, 10);
      if (!Number.isNaN(expected) && movieYear(m) !== expected) return false;
    }
    return true;
  };

  const confirm = async () => {
    if (!selected || !category || submitting) return;
    setSubmitting(true);
    setError(null);
    const err = await onConfirm(selected, category);
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0E0E0F", paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-5 pb-3 pt-3">
          <Pressable onPress={onClose} hitSlop={12} className="w-16 active:opacity-70">
            <Text className="text-base text-greyscale-blue-300">Cancel</Text>
          </Pressable>
          <Text className="font-brockmann-semibold text-base">Pick for {category ? categoryLabel(category) : ""}</Text>
          <View className="w-16" />
        </View>

        {/* Search */}
        <View className="px-4 pb-3">
          <View
            className="flex-row items-center gap-2"
            style={{ backgroundColor: colors.uiPrimary, borderWidth: 1, borderColor: colors.textPrimary, borderRadius: 2, paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <SearchIcon size={16} color={colors.textGrey} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              placeholder={placeholder(theme, option)}
              placeholderTextColor={colors.textGrey}
              style={{ flex: 1, fontFamily: "Brockmann-Medium", fontSize: 14, lineHeight: 20, color: colors.textPrimary, padding: 0 }}
            />
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(m) => String(m.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
          ListEmptyComponent={
            loading ? (
              <View className="items-center gap-2 py-8">
                <ActivityIndicator color={colors.brand} />
                <Text className="text-sm text-greyscale-blue-300">Loading movies...</Text>
              </View>
            ) : showResults ? (
              <Text className="py-8 text-center text-sm text-greyscale-blue-300">{emptyMessage(theme, option, q)}</Text>
            ) : null
          }
          ListFooterComponent={
            filtered.length > MAX_RESULTS ? (
              <Text className="pt-2 text-center text-xs text-greyscale-blue-400">
                Showing first {MAX_RESULTS} results of {filtered.length} movies. Use search to narrow down.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const isSel = selected?.id === item.id;
            const isTaken = takenMovieIds.has(item.id);
            const matches = isSel ? eligible(item) : false;
            return (
              <View>
                <Pressable
                  onPress={() => !isTaken && select(item)}
                  style={{
                    backgroundColor: isSel ? colors.brand : colors.uiPrimary,
                    borderRadius: 4,
                    borderWidth: isSel ? 0 : 1,
                    borderColor: colors.buttonStroke,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    minHeight: 56,
                    opacity: isTaken ? 0.4 : 1,
                    justifyContent: "center",
                  }}
                >
                  <Text className="font-brockmann-semibold text-sm leading-5" style={{ letterSpacing: 0.28 }}>
                    {item.title}
                  </Text>
                  <Text className="text-xs leading-[14px]" style={{ opacity: 0.75 }}>
                    {movieYear(item)}
                    {item.genre ? ` • ${item.genre}` : ""}
                    {isTaken ? " • Already drafted" : ""}
                  </Text>
                </Pressable>

                {isSel && category && (
                  <View className="gap-3 pt-3">
                    {error && <Text className="text-sm text-[#FF6C6C]">{error}</Text>}
                    {checkingOscar ? (
                      <View className="flex-row items-center justify-center gap-2 py-2">
                        <ActivityIndicator color={colors.brand} />
                        <Text className="text-sm text-greyscale-blue-300">Checking Oscar status…</Text>
                      </View>
                    ) : matches || houseOverride ? (
                      <Pressable
                        onPress={confirm}
                        disabled={submitting}
                        className="flex-row items-center justify-center gap-2 rounded-control bg-gold px-3 py-3"
                        style={{ opacity: submitting ? 0.6 : 1 }}
                      >
                        {submitting ? (
                          <ActivityIndicator color="#2B2D2D" />
                        ) : (
                          <>
                            <Text className="font-brockmann-medium text-sm text-greyscale-blue-800">
                              Confirm in <Text className="font-brockmann-bold text-sm text-greyscale-blue-800">{categoryLabel(category)}</Text>
                            </Text>
                            <Check size={12} color="#2B2D2D" strokeWidth={2.5} />
                          </>
                        )}
                      </Pressable>
                    ) : (
                      <>
                        <View className="flex-row items-center justify-center gap-2 rounded-control bg-purple-800 px-3 py-3" style={{ opacity: 0.8 }}>
                          <Text className="font-brockmann-medium text-sm">Category Mismatch</Text>
                          <X size={12} color={colors.textPrimary} strokeWidth={2.5} />
                        </View>
                        <View className="flex-row items-center justify-end gap-3 px-3">
                          <Text className="font-brockmann-medium text-sm text-greyscale-blue-300">House Override</Text>
                          <Switch value={houseOverride} onValueChange={setHouseOverride} trackColor={{ true: colors.brand, false: "#49474B" }} />
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}
