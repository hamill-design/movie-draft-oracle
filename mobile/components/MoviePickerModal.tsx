import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getEligibleCategories, mergeOscarStatusFromSources } from "../lib/movieCategoryUtils";
import { categoryLabel, posterUrl } from "../lib/draftBoard";
import { useMovieSearch, type PickerMovie } from "../hooks/useMovieSearch";
import { Button } from "./ui";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[‘’']/g, "'")
    .replace(/[–—]/g, "-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const movieYear = (m: PickerMovie) =>
  m.releaseDate ? new Date(m.releaseDate).getFullYear() : m.year || new Date().getFullYear();

function placeholder(theme: string, option: string) {
  if (theme === "spec-draft") return "Search movies…";
  if (theme === "year") return `Search within ${option} movies…`;
  if (theme === "people") return `Search within ${option.split("|")[0]} movies…`;
  return "Search for movies…";
}

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

  // Start fresh each time the picker opens.
  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelected(null);
      setHouseOverride(false);
      setError(null);
    }
  }, [visible, category]);

  const { movies, loading, error: loadError } = useMovieSearch(theme, option, query, visible);

  const q = query.trim();
  const showResults = theme === "year" || theme === "people" ? q.length >= 2 : q.length > 0;
  const results = useMemo(() => {
    if (!showResults) return [];
    const list =
      theme === "year"
        ? movies
        : movies.filter((m) => normalize(m.title).includes(normalize(q)));
    return list.slice(0, 60);
  }, [movies, showResults, theme, q]);

  const select = async (movie: PickerMovie) => {
    setSelected(movie);
    setError(null);
    // The Academy Award category needs fresh Oscar data for the chosen movie.
    if (category?.startsWith("Academy Award") && movie.id) {
      setCheckingOscar(true);
      try {
        const { data: cached } = await supabase
          .from("oscar_cache")
          .select("oscar_status")
          .eq("tmdb_id", movie.id)
          .maybeSingle();
        let status: string | undefined = cached?.oscar_status;
        if (!cached) {
          const { data } = await supabase.functions.invoke("enrich-movie-data", {
            body: { movieId: movie.id, movieTitle: movie.title, movieYear: movie.year },
          });
          status = data?.enrichmentData?.oscarStatus ?? data?.enrichmentData?.oscar_status;
        }
        const merged = mergeOscarStatusFromSources(movie.oscar_status, status);
        setSelected((cur) =>
          cur && cur.id === movie.id
            ? { ...cur, oscar_status: merged.oscar_status, hasOscar: merged.hasOscar }
            : cur,
        );
      } catch {
        /* keep what we have */
      } finally {
        setCheckingOscar(false);
      }
    }
  };

  const eligible = (m: PickerMovie) => {
    if (!category) return false;
    const inCategory = getEligibleCategories(
      { ...m, year: movieYear(m) },
      categories,
      theme,
      option,
      specCategories,
    ).includes(category);
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

  const taken = selected ? takenMovieIds.has(selected.id) : false;
  const matches = selected ? eligible(selected) : false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-ink" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-5 pb-3 pt-3">
          <Pressable onPress={onClose} hitSlop={12} className="w-16 active:opacity-70">
            <Text className="text-base text-white/70">Cancel</Text>
          </Pressable>
          <Text className="text-base font-semibold text-white">
            Pick for {category ? categoryLabel(category) : ""}
          </Text>
          <View className="w-16" />
        </View>

        <View className="px-5 pb-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            placeholder={placeholder(theme, option)}
            placeholderTextColor="#BDC3C2"
            className="rounded-sm border border-white/30 bg-card px-4 py-3 text-base text-white"
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={(m) => String(m.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color="#7142FF" style={{ marginTop: 32 }} />
            ) : (
              <Text className="mt-10 text-center text-sm text-white/50">
                {loadError
                  ? loadError
                  : showResults
                    ? `No movies found matching "${q}"`
                    : theme === "year" || theme === "people"
                      ? "Type at least 2 letters to search."
                      : "Start typing a movie title."}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const isSel = selected?.id === item.id;
            const isTaken = takenMovieIds.has(item.id);
            const uri = posterUrl(item.poster_path ?? item.posterPath, "w92");
            return (
              <Pressable
                onPress={() => !isTaken && select(item)}
                className={`flex-row items-center gap-3 rounded-lg p-2 ${
                  isSel ? "border-2 border-accent bg-[#160038]" : "border border-white/10 bg-card"
                } ${isTaken ? "opacity-40" : "active:opacity-80"}`}
              >
                {uri ? (
                  <Image source={{ uri }} style={{ width: 44, height: 66, borderRadius: 3 }} />
                ) : (
                  <View style={{ width: 44, height: 66 }} className="rounded-sm bg-white/10" />
                )}
                <View className="flex-1">
                  <Text numberOfLines={2} className="text-base font-semibold text-white">
                    {item.title}
                  </Text>
                  <Text className="text-sm text-white/50">
                    {movieYear(item)}
                    {item.genre ? ` • ${item.genre}` : ""}
                  </Text>
                  {isTaken && <Text className="mt-0.5 text-xs text-accent">Already drafted</Text>}
                </View>
              </Pressable>
            );
          }}
        />

        {/* Confirm bar */}
        {selected && category && (
          <View
            className="gap-3 border-t border-white/10 bg-surface px-5 pt-4"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <Text numberOfLines={1} className="text-sm text-white/60">
              {selected.title} ({movieYear(selected)})
            </Text>
            {error && <Text className="text-sm text-red-400">{error}</Text>}
            {taken ? (
              <Text className="text-center text-sm text-white/60">This movie was already drafted.</Text>
            ) : checkingOscar ? (
              <View className="flex-row items-center justify-center gap-2 py-3">
                <ActivityIndicator color="#7142FF" />
                <Text className="text-sm text-white/60">Checking Oscar status…</Text>
              </View>
            ) : matches || houseOverride ? (
              <Button
                label={`Confirm in ${categoryLabel(category)}`}
                onPress={confirm}
                loading={submitting}
              />
            ) : (
              <View className="gap-3">
                <View className="items-center rounded-sm bg-purple-900/60 px-3 py-3">
                  <Text className="text-sm font-medium text-white">Category mismatch</Text>
                  <Text className="mt-0.5 text-center text-xs text-white/60">
                    {selected.title} doesn't qualify for {categoryLabel(category)}.
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 pr-3 text-sm text-white/70">
                    House rule: allow it anyway
                  </Text>
                  <Switch
                    value={houseOverride}
                    onValueChange={setHouseOverride}
                    trackColor={{ true: "#7142FF", false: "#49474B" }}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
