import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Check, Film, Mail, Trophy, User, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { useLeague, useLeagueMembers } from "../../hooks/useLeagues";
import {
  SETUP_YEARS,
  analyzeCategories,
  cachedCounts,
  createMultiplayerDraft,
  estimateCount,
  fetchCategoryOptions,
  fetchSpecDrafts,
  searchPeople,
  type CategoryOption,
  type PersonResult,
  type SetupTheme,
  type SpecDraftOption,
} from "../../lib/draftSetup";
import { categoryLabel } from "../../lib/draftBoard";
import { colors } from "../../lib/theme";
import { CheckboxIcon, MultiPersonIcon, PersonIcon, TrashIcon } from "../../components/icons";
import { ActorPortrait } from "../../components/ActorPortrait";
import { AppHeader, Button, Field, GlowCard, SectionHeader, Text } from "../../components/ui";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "launcher" | "setup";

// Category display order from the website: custom/actor categories, genres, decades, others, then Oscar/Blockbuster/Sequel/Wild Card.
const GENRES = ["Action/Adventure", "Animated", "Comedy", "Drama/Romance", "Sci-Fi/Fantasy", "Horror/Thriller", "Documentary"];
const END = ["Academy Award Nominee or Winner", "Blockbuster (minimum of $50 Mil)", "Sequel", "Wild Card"];
const isDecade = (n: string) => /^\d{2}'s$|^\d{4}'s$/.test(n);
function categoryRank(name: string, custom: Set<string>): number {
  if (custom.has(name)) return 0;
  if (GENRES.includes(name)) return 1 + GENRES.indexOf(name) / 100;
  if (isDecade(name)) return 2;
  const e = END.indexOf(name);
  if (e >= 0) return 4 + e / 100;
  return 3;
}

function CountBadge({ count, players, estimate }: { count: number; players: number; estimate?: boolean }) {
  const tone =
    count >= players * 2
      ? { bg: "#41DA86", fg: "#002912", border: "#ADF2CC" }
      : count >= players
        ? { bg: "#FFDF42", fg: "#292200", border: "#FFF2B2" }
        : { bg: "#FF6C6C", fg: "#1D1D1F", border: "#FFC0C0" };
  return (
    <View style={{ backgroundColor: tone.bg, borderColor: tone.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
      <Text className="text-xs leading-4" style={{ color: tone.fg }}>
        {estimate ? `~${count}` : count}
      </Text>
    </View>
  );
}

function ModeTile({
  active,
  disabled,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-center rounded-tile ${active ? "bg-brand" : "bg-greyscale-purp-850 active:bg-purple-800"}`}
      style={{
        height: 80,
        gap: 16,
        paddingHorizontal: 16,
        opacity: disabled ? 0.45 : 1,
        borderWidth: active ? 0 : 1,
        borderColor: colors.itemStroke,
      }}
    >
      {icon}
      <Text className="font-brockmann-medium text-lg">{label}</Text>
    </Pressable>
  );
}

export default function NewDraft() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { league: leagueParam } = useLocalSearchParams<{ league?: string }>();
  const leagueId = leagueParam || undefined;
  const { league } = useLeague(leagueId);
  const { members } = useLeagueMembers(leagueId);

  const [step, setStep] = useState<Step>("launcher");
  const [theme, setTheme] = useState<SetupTheme | null>(null);
  const [option, setOption] = useState("");
  const [optionLabel, setOptionLabel] = useState("");

  // launcher
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [specDrafts, setSpecDrafts] = useState<SpecDraftOption[]>([]);
  const [specLoading, setSpecLoading] = useState(true);
  const [specIndex, setSpecIndex] = useState(0);

  // setup
  const [hostName, setHostName] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  // real counts per category (from the server / cache); anything missing falls back to an estimate
  const [analysis, setAnalysis] = useState<Map<string, number>>(new Map());
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const playerCount = Math.max(emails.length + 1, 2);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setHostName(data?.name || user.email || "Host"));
  }, [user]);

  // Special drafts (top five, as on the website's home page).
  useEffect(() => {
    fetchSpecDrafts()
      .then((d) => setSpecDrafts(d.slice(0, 5)))
      .catch(() => setSpecDrafts([]))
      .finally(() => setSpecLoading(false));
  }, []);

  // Person search (debounced), shows after any text like the website.
  useEffect(() => {
    if (theme !== "people" || query.trim().length < 1) {
      setPeople([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchPeople(query)
        .then((r) => setPeople(r.slice(0, 10)))
        .catch(() => setPeople([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [theme, query]);

  // Category list once we reach the setup step.
  useEffect(() => {
    if (step !== "setup" || !theme || !option) return;
    setLoadingCategories(true);
    setSelected(new Set());
    setAnalysis(new Map());
    fetchCategoryOptions(theme, option)
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]))
      .finally(() => setLoadingCategories(false));
  }, [step, theme, option]);

  // Real movie counts per category (year / filmography drafts): estimates show instantly, one batched call fills in the real numbers.
  useEffect(() => {
    if (step !== "setup" || !theme || theme === "spec-draft" || categoryOptions.length === 0) return;
    const names = categoryOptions.map((c) => c.name);
    setAnalysis(cachedCounts(theme, option, names));
    let cancelled = false;
    setAnalyzing(true);
    analyzeCategories(theme, option, names)
      .then((m) => !cancelled && setAnalysis(m))
      .finally(() => !cancelled && setAnalyzing(false));
    return () => {
      cancelled = true;
    };
  }, [step, theme, option, categoryOptions]);

  // Real count if we have it; otherwise a known list size (actor/special lists) or the website's rough estimate.
  const isEstimate = (c: CategoryOption) => theme !== "spec-draft" && !analysis.has(c.name) && c.count == null;
  const countFor = (c: CategoryOption): number | null =>
    analysis.get(c.name) ?? c.count ?? (theme !== "spec-draft" ? estimateCount(c.name) : null);

  const disabledReason = (c: CategoryOption): string | null => {
    if (c.alwaysOk) return null;
    const count = countFor(c);
    if (count != null && count < playerCount) return "low";
    return null;
  };

  // Drop selections that became unavailable (e.g. more players were added).
  useEffect(() => {
    setSelected((cur) => {
      const next = new Set([...cur].filter((n) => {
        const c = categoryOptions.find((x) => x.name === n);
        return c ? !disabledReason(c) : false;
      }));
      return next.size === cur.size ? cur : next;
    });
  }, [analysis, playerCount, categoryOptions]);

  const sortedCategories = useMemo(() => {
    const custom = new Set(categoryOptions.filter((c) => c.count != null && !GENRES.includes(c.name) && !END.includes(c.name) && !isDecade(c.name) && theme === "people").map((c) => c.name));
    return [...categoryOptions].sort((a, b) => categoryRank(a.name, custom) - categoryRank(b.name, custom));
  }, [categoryOptions, theme]);

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email) || emails.includes(email) || email === user?.email?.toLowerCase()) return false;
    setEmails((prev) => [...prev, email]);
    return true;
  };

  const leagueSuggestions = useMemo(
    () =>
      members
        .filter((m) => m.user_id !== user?.id && m.profile?.email && !emails.includes(m.profile.email.toLowerCase()))
        .map((m) => ({ email: m.profile!.email!, label: m.profile?.name ?? m.profile!.email! })),
    [members, emails, user?.id],
  );

  const toggleCategory = (c: CategoryOption) => {
    if (disabledReason(c)) return;
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(c.name)) next.delete(c.name);
      else next.add(c.name);
      return next;
    });
  };

  const create = async () => {
    if (!user || !theme || creating) return;
    if (selected.size === 0) {
      Alert.alert("Error", "Please select at least one category");
      return;
    }
    if (emails.length === 0) {
      Alert.alert("Add players", "Invite at least one other player to start an online draft.");
      return;
    }
    setCreating(true);
    try {
      const cats = sortedCategories.map((c) => c.name).filter((n) => selected.has(n));
      const draftId = await createMultiplayerDraft({
        userId: user.id,
        hostName,
        theme,
        option,
        optionLabel,
        categories: cats,
        emails,
        leagueId,
      });
      router.replace(`/draft/${draftId}`);
    } catch (e) {
      setCreating(false);
      Alert.alert("Could not create the draft", e instanceof Error ? e.message : "Please try again.");
    }
  };

  const beginSetup = (t: SetupTheme, opt: string, label: string) => {
    setTheme(t);
    setOption(opt);
    setOptionLabel(label);
    setStep("setup");
  };

  const pickTheme = (t: "people" | "year") => {
    setTheme(t);
    setOption("");
    setOptionLabel("");
    setQuery("");
  };

  const leagueBanner = league && (
    <View
      className="flex-row items-start gap-3 rounded-card bg-greyscale-purp-900 px-4 py-3"
      style={{ borderWidth: 1, borderColor: "rgba(104,10,255,0.35)", boxShadow: "0px 0px 6px #3B0394" }}
    >
      <Trophy size={20} color={colors.brand} />
      <Text className="flex-1 text-sm leading-[18px]">
        This draft will be added to <Text className="font-brockmann-semibold">{league.name}</Text>.
      </Text>
    </View>
  );

  const spec = specDrafts[specIndex];

  return (
    <View className="flex-1">
      <AppHeader backHref={leagueId ? `/league/${leagueId}` : "/leagues"} onBack={step === "setup" ? () => setStep("launcher") : undefined} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 24 }}>
          {leagueBanner}

          {step === "launcher" && (
            <>
              <View className="items-center gap-4 py-4">
                <Text className="text-center font-chaney" style={{ fontSize: 32, lineHeight: 36 }}>
                  Set up your draft
                </Text>
                <Text className="text-center font-brockmann-medium text-sm leading-5">
                  Pick a filmography or a year, add your friends, choose your categories, and start drafting. It only takes a minute.
                </Text>
              </View>

              {/* Special drafts */}
              <GlowCard gap={16}>
                <Text className="text-center font-brockmann-medium text-xl leading-7">Start a Special Draft!</Text>
                {specLoading ? (
                  <Text className="text-center text-sm">Loading special drafts...</Text>
                ) : spec ? (
                  <>
                    <View className="gap-4 rounded-tile bg-card p-4" style={{ borderWidth: 1, borderColor: colors.itemStroke }}>
                      {spec.photo_url ? (
                        <Image source={{ uri: spec.photo_url }} style={{ width: "100%", height: 160, borderRadius: 3 }} contentFit="cover" />
                      ) : (
                        <View style={{ height: 160, borderRadius: 3, backgroundColor: "#2C2B2D", alignItems: "center", justifyContent: "center" }}>
                          <Film size={32} color={colors.textGrey} />
                        </View>
                      )}
                      <View className="gap-2">
                        <Text className="font-brockmann-semibold text-2xl leading-[30px]" style={{ letterSpacing: 0.5 }}>
                          {spec.name}
                        </Text>
                        {!!spec.description && <Text className="text-sm leading-5">{spec.description}</Text>}
                      </View>
                      <Button label="Begin Setup" variant="brand" small onPress={() => beginSetup("spec-draft", spec.id, spec.name)} />
                    </View>
                    {specDrafts.length > 1 && (
                      <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
                        {specDrafts.map((s, i) => (
                          <Pressable
                            key={s.id}
                            onPress={() => setSpecIndex(i)}
                            hitSlop={6}
                            style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "#BCB2FF", backgroundColor: i === specIndex ? "#5106C9" : "transparent" }}
                          />
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <Text className="text-center text-sm text-greyscale-blue-300">No special drafts available.</Text>
                )}
              </GlowCard>

              {/* Your own draft */}
              <GlowCard>
                <Text className="text-center font-brockmann-medium text-xl leading-7">Setup Your Own Draft Now</Text>
                <View style={{ gap: 16 }}>
                  <ModeTile active={theme === "people"} icon={<PersonIcon size={24} color={colors.textPrimary} />} label="Draft by Filmography" onPress={() => pickTheme("people")} />
                  <ModeTile active={theme === "year"} icon={<Calendar size={24} color={colors.textPrimary} />} label="Draft by Year" onPress={() => pickTheme("year")} />
                </View>
              </GlowCard>

              {theme === "people" && (
                <GlowCard gap={16}>
                  <SectionHeader icon={<PersonIcon size={24} color={colors.accent} />} title="Search Actors, Directors, Writers..." />
                  <Field value={query} onChangeText={setQuery} autoCorrect={false} placeholder="Search actors, directors, writers..." />
                  {searching && <Text className="text-sm text-greyscale-blue-500">Searching...</Text>}
                  <View style={{ gap: 8 }}>
                    {people.map((p) => {
                      const on = option === p.name;
                      const known = (p as any).known_for as { title?: string; name?: string }[] | undefined;
                      const knownFor = known?.slice(0, 3).map((k) => k.title ?? k.name).filter(Boolean).join(", ");
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => {
                            setOption(p.name);
                            setOptionLabel(p.name);
                          }}
                          className="flex-row items-center gap-3 rounded bg-card"
                          style={{ paddingVertical: 16, paddingLeft: 16, paddingRight: 24, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.itemStroke }}
                        >
                          <ActorPortrait profilePath={p.profile_path} name={p.name} size="md" />
                          <View className="flex-1">
                            <Text className="font-brockmann-bold text-lg leading-[26px]">{p.name}</Text>
                            <Text className="text-sm leading-5 text-greyscale-blue-500">
                              {p.known_for_department ?? ""}
                              {knownFor ? ` • Known for: ${knownFor}` : ""}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    {!searching && query.trim().length >= 2 && people.length === 0 && (
                      <Text className="text-sm text-greyscale-blue-500">No people found</Text>
                    )}
                  </View>
                </GlowCard>
              )}

              {theme === "year" && (
                <GlowCard gap={16}>
                  <SectionHeader icon={<Calendar size={24} color={colors.accent} />} title="Select the year of films you'll draft" />
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {SETUP_YEARS.map((y) => {
                      const on = option === y;
                      return (
                        <Pressable
                          key={y}
                          onPress={() => {
                            setOption(y);
                            setOptionLabel(y);
                          }}
                          className="items-center justify-center rounded-tile"
                          style={{
                            width: "23%",
                            height: 48,
                            backgroundColor: on ? colors.brand : colors.uiPrimary,
                            borderWidth: 0.5,
                            borderColor: on ? colors.brand : colors.buttonStroke,
                          }}
                        >
                          <Text className="font-brockmann-medium text-sm">{y}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </GlowCard>
              )}

              {(theme === "people" || theme === "year") && !!option && (
                <View className="items-center gap-4">
                  <View className="items-center">
                    <Text className="font-brockmann-medium text-sm leading-5 text-greyscale-blue-300">You've Selected</Text>
                    <Text className="font-brockmann-bold text-2xl leading-8 text-purple-300" style={{ letterSpacing: theme === "year" ? 0.96 : 0 }}>
                      {optionLabel}
                    </Text>
                  </View>
                  <Button label="Begin Setup" inline onPress={() => beginSetup(theme, option, optionLabel)} />
                </View>
              )}
            </>
          )}

          {step === "setup" && (
            <>
              <Pressable onPress={() => setStep("launcher")} hitSlop={8} className="self-start">
                <Text className="text-sm text-greyscale-blue-300">
                  ← Change {theme === "people" ? "person" : theme === "year" ? "year" : "draft"}
                </Text>
              </Pressable>

              <View className="items-center gap-4 py-4">
                <Text className="font-brockmann-medium uppercase" style={{ fontSize: 28, lineHeight: 32, letterSpacing: 1.28 }}>
                  SETTING UP
                </Text>
                <Text className="text-center font-chaney uppercase text-brand" style={{ fontSize: 48, lineHeight: 52 }}>
                  {optionLabel}
                </Text>
              </View>

              {/* Mode */}
              <GlowCard>
                <Text className="text-center font-brockmann-bold text-2xl leading-8" style={{ letterSpacing: 0.96 }}>
                  Select A Mode
                </Text>
                <View style={{ gap: 16 }}>
                  <ModeTile
                    active={false}
                    disabled
                    icon={<User size={24} color={colors.textPrimary} />}
                    label="Local Draft"
                    onPress={() => Alert.alert("Local drafts", "Local, pass-the-phone drafts are on moviedrafter.com. The app creates online multiplayer drafts.")}
                  />
                  <ModeTile active icon={<Users size={24} color={colors.textPrimary} />} label="Online Multiplayer" onPress={() => {}} />
                </View>
                <View className="rounded bg-teal-900 p-4" style={{ borderWidth: 1, borderColor: "#B2FFEA" }}>
                  <Text className="font-brockmann-medium text-sm leading-5 text-teal-200">
                    <Text className="font-brockmann-bold text-sm text-teal-200">Multiplayer Mode:</Text> Enter email addresses of friends you want
                    to invite. They'll receive an email invitation to join your draft.
                  </Text>
                </View>
              </GlowCard>

              {/* Participants */}
              <GlowCard>
                <SectionHeader icon={<MultiPersonIcon size={24} color="#BCB2FF" />} title="Add Participants" />
                <View className="flex-row items-stretch" style={{ gap: 8 }}>
                  <View className="flex-1">
                    <Field
                      value={emailInput}
                      onChangeText={setEmailInput}
                      onSubmitEditing={() => addEmail(emailInput) && setEmailInput("")}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Enter participant email..."
                    />
                  </View>
                  <Pressable onPress={() => addEmail(emailInput) && setEmailInput("")} className="justify-center rounded-control bg-brand px-4 active:opacity-80">
                    <Text className="font-brockmann-medium text-sm">Add</Text>
                  </Pressable>
                </View>

                {leagueSuggestions.length > 0 && (
                  <View className="gap-2">
                    <Text className="font-brockmann-medium text-xs uppercase text-greyscale-blue-400" style={{ letterSpacing: 1.8 }}>
                      League members
                    </Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      {leagueSuggestions.map((m) => (
                        <Pressable
                          key={m.email}
                          onPress={() => addEmail(m.email)}
                          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{ backgroundColor: "#2C2B2D", borderWidth: 1, borderColor: "rgba(104,10,255,0.4)" }}
                        >
                          <Users size={13} color="#A78BFA" />
                          <Text className="text-sm text-greyscale-blue-200">{m.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                <View className="flex-row items-center gap-2 rounded bg-teal-900 p-4" style={{ borderWidth: 1, borderColor: "#B2FFEA" }}>
                  <Mail size={24} color="#B2FFEA" />
                  <Text className="flex-1 font-brockmann-medium text-sm leading-5 text-teal-200">
                    <Text className="font-brockmann-bold text-sm text-teal-200">Multiplayer Mode:</Text> Enter email addresses of friends you want
                    to invite. They'll receive an email invitation to join.
                  </Text>
                </View>

                <View className="gap-3">
                  <Text className="text-base leading-6 text-greyscale-blue-300">Participants ({emails.length + 1}):</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    <View className="flex-row items-center gap-2 rounded bg-brand px-4 py-2">
                      <Mail size={16} color={colors.textPrimary} />
                      <Text className="font-brockmann-medium text-sm leading-5">{hostName || "You"} (Host)</Text>
                    </View>
                    {emails.map((email) => (
                      <View key={email} className="flex-row items-center gap-2 rounded bg-brand" style={{ paddingVertical: 8, paddingLeft: 16, paddingRight: 10 }}>
                        <Mail size={16} color={colors.textPrimary} />
                        <Text className="shrink font-brockmann-medium text-sm leading-5">{email}</Text>
                        <Pressable onPress={() => setEmails((prev) => prev.filter((x) => x !== email))} hitSlop={8} accessibilityLabel={`Remove ${email}`}>
                          <TrashIcon size={16} color={colors.textPrimary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              </GlowCard>

              {/* Categories */}
              <GlowCard>
                <SectionHeader icon={<CheckboxIcon size={24} color="#BCB2FF" />} title="Choose Categories" />
                {(loadingCategories || (analyzing && analysis.size === 0)) && (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color={colors.brand} size="small" />
                    <Text className="text-xs text-greyscale-blue-300">{loadingCategories ? "Loading categories…" : "Counting movies…"}</Text>
                  </View>
                )}
                <View style={{ gap: 20 }}>
                  {sortedCategories.map((c) => {
                    const reason = disabledReason(c);
                    const on = selected.has(c.name);
                    const count = countFor(c);
                    const showBadge = theme !== "year" && c.name !== "Wild Card" && count != null;
                    return (
                      <Pressable key={c.name} onPress={() => toggleCategory(c)} disabled={!!reason} className="flex-row items-center" style={{ gap: 8, opacity: reason ? 0.6 : 1 }}>
                        <View
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: reason ? "#CCCCCC" : colors.accent,
                            backgroundColor: reason ? "#F5F5F5" : on ? colors.brand : "transparent",
                          }}
                        >
                          {on && <Check size={11} color="#FFFFFF" />}
                        </View>
                        <Text className="flex-1 font-brockmann-medium text-sm leading-5">{categoryLabel(c.name)}</Text>
                        {showBadge && <CountBadge count={count!} players={playerCount} estimate={isEstimate(c)} />}
                      </Pressable>
                    );
                  })}
                </View>
              </GlowCard>

              <Button label={creating ? "Creating..." : "Create Multiplayer Draft"} inline loading={creating} disabled={selected.size === 0 || emails.length === 0} onPress={create} />
              {emails.length === 0 && <Text className="-mt-3 text-center text-xs text-greyscale-blue-400">Add at least one friend to create the draft.</Text>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
