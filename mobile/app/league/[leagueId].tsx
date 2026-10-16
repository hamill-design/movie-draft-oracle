import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarClock, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  useLeague,
  useLeagueActions,
  useLeagueDrafts,
  useLeagueMembers,
  useLeagueQuarters,
  useLeagueSeasonStandings,
  useLeagueStandings,
  usePendingLeagueInvites,
  type LeagueDraftEntry,
  type LeagueStanding,
} from "../../hooks/useLeagues";
import {
  currentQuarter,
  getQuarter,
  parseQuarterId,
  quarterId,
  quarterLabel,
  quartersEqual,
} from "../../lib/seasons";
import {
  buildLeagueDraftMetrics,
  draftLeaguePointsByUserId,
  draftPlacementRank,
  tieRanksForStandings,
  type DraftParticipantRow,
  type LeagueDraftMetricPack,
} from "../../lib/leagueDraftMetrics";
import { colors } from "../../lib/theme";
import { LeagueTrophy } from "../../components/brand";
import { SelectSheet } from "../../components/SelectSheet";
import { LeagueDraftCard } from "../../components/league/LeagueDraftCard";
import { LeagueMessageBoard } from "../../components/league/LeagueMessageBoard";
import { LeagueStandingsChart } from "../../components/league/LeagueStandingsChart";
import { ScheduledDraftDetailModal } from "../../components/league/ScheduledDraftDetailModal";
import { AppHeader, Button, GlowCard, PillTabs, RankBadge, SectionTitle, Text } from "../../components/ui";

const SITE = "https://moviedrafter.com";
const ONE_HOUR_MS = 60 * 60 * 1000;
const DRAFT_TYPE_LABELS: Record<string, string> = {
  classic: "Classic",
  year: "By Year",
  people: "By Filmmaker",
  "spec-draft": "Special Draft",
  filmography: "By Filmography",
};
const cleanActor = (s: string) => (s.includes("|") ? s.split("|")[0] : s);

type MainTab = "standings" | "drafts" | "messages";
const TABS = [
  { key: "standings", label: "Standings" },
  { key: "drafts", label: "Drafts" },
  { key: "messages", label: "Messages" },
] as const;

/** Schedule tab card title — name/theme only, no "By Filmography ·" prefix. */
function upcomingHeadline(entry: LeagueDraftEntry, specMeta: { name: string } | undefined): string {
  const t = entry.draft_type;
  if (t === "spec-draft") return specMeta?.name ?? "Special draft";
  if (t === "filmography" || t === "people") {
    const name = cleanActor(entry.theme ?? "");
    return name || entry.theme?.trim() || "Draft";
  }
  if (t === "year") return entry.theme?.trim() || "Draft";
  if (entry.theme?.trim()) return entry.theme.trim();
  return DRAFT_TYPE_LABELS[t ?? ""] ?? "Draft";
}

function StandingRow({ s, rank, isYou }: { s: LeagueStanding; rank: number; isYou: boolean }) {
  return (
    <View
      className="flex-row items-center gap-4 rounded-card"
      style={{
        paddingVertical: 16,
        paddingLeft: 16,
        paddingRight: 24,
        backgroundColor: isYou ? "#160038" : colors.uiPrimary,
        borderWidth: isYou ? 2 : 1,
        borderColor: isYou ? colors.accent : colors.itemStroke,
      }}
    >
      <RankBadge rank={rank} />
      <View className="flex-1 pb-0.5">
        <Text numberOfLines={1} className="font-brockmann-semibold text-base leading-6" style={{ letterSpacing: 0.32 }}>
          {s.display_name ?? "Unknown"}
        </Text>
        <Text className="text-sm leading-5 text-greyscale-blue-300">
          {s.draft_count} {s.draft_count === 1 ? "draft" : "drafts"} · {s.raw_score.toFixed(1)} movie score
        </Text>
      </View>
      <View className="items-end">
        <Text className="font-brockmann-bold text-accent" style={{ fontSize: 32, lineHeight: 36 }}>
          {String(s.total_score)}
        </Text>
        <Text className="text-xs text-greyscale-blue-400">pts</Text>
      </View>
    </View>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <Text className="font-brockmann-semibold text-xs uppercase text-greyscale-blue-400" style={{ letterSpacing: 1.8 }}>
      {children}
    </Text>
  );
}

export default function LeagueDetail() {
  const { leagueId, tab: tabParam } = useLocalSearchParams<{ leagueId: string; tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { league, loading: leagueLoading, refetch: refetchLeague } = useLeague(leagueId);
  const { members, refetch: refetchMembers } = useLeagueMembers(leagueId);
  const { drafts, loading: draftsLoading } = useLeagueDrafts(leagueId);
  const { quarters, activeQuarter } = useLeagueQuarters(drafts);
  const { invites, loading: invitesLoading, refetch: refetchInvites } = usePendingLeagueInvites();
  const { acceptInvite, declineInvite, removeScheduledDraft } = useLeagueActions();

  const [tab, setTab] = useState<MainTab>(tabParam === "drafts" || tabParam === "messages" ? tabParam : "standings");
  const [selectedQuarterId, setSelectedQuarterId] = useState(() => quarterId(currentQuarter()));
  const [inviteBusy, setInviteBusy] = useState<"accept" | "decline" | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<LeagueDraftEntry | null>(null);

  const quarter = selectedQuarterId === "all-time" ? undefined : parseQuarterId(selectedQuarterId);
  const { standings: allTime, loading: allTimeLoading } = useLeagueStandings(quarter ? undefined : leagueId);
  const { standings: season, loading: seasonLoading } = useLeagueSeasonStandings(leagueId, quarter);
  const standings = quarter ? season : allTime;
  const standingsLoading = quarter ? seasonLoading : allTimeLoading;
  const ranks = useMemo(() => tieRanksForStandings(standings), [standings]);

  useEffect(() => {
    if (selectedQuarterId === "all-time") return;
    if (!quarters.some((q) => quarterId(q) === selectedQuarterId)) setSelectedQuarterId(quarterId(activeQuarter));
  }, [quarters, selectedQuarterId, activeQuarter]);

  const isAdmin = league?.admin_id === user?.id;
  const isMember = members.some((m) => m.user_id === user?.id);
  const myInvite = invites.find((inv) => inv.league_id === leagueId) ?? null;

  const inScope = useCallback(
    (d: LeagueDraftEntry) => {
      if (!quarter) return true;
      const when = d.scheduled_at ?? d.draft?.created_at;
      return !!when && quartersEqual(getQuarter(when), quarter);
    },
    [quarter],
  );
  const scheduled = useMemo(() => drafts.filter((d) => !d.draft_id && d.scheduled_at), [drafts]);
  const active = useMemo(() => drafts.filter((d) => d.draft_id && !d.draft?.is_complete).filter(inScope), [drafts, inScope]);
  const completed = useMemo(() => drafts.filter((d) => d.draft_id && d.draft?.is_complete).filter(inScope), [drafts, inScope]);

  // Special-draft names/photos for card titles.
  const [specDraftData, setSpecDraftData] = useState<Map<string, { name: string; photo_url: string | null }>>(() => new Map());
  useEffect(() => {
    const ids = new Set<string>();
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const d of drafts) {
      if (d.draft?.theme === "spec-draft" && d.draft.option) ids.add(d.draft.option);
      if (!d.draft_id && d.draft_type === "spec-draft" && d.theme && uuidLike.test(d.theme)) ids.add(d.theme);
    }
    if (ids.size === 0) return;
    let cancelled = false;
    supabase
      .from("spec_drafts")
      .select("id, name, photo_url")
      .in("id", [...ids])
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSpecDraftData((prev) => {
          const next = new Map(prev);
          (data as any[]).forEach((row) => next.set(row.id, { name: row.name, photo_url: row.photo_url }));
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [drafts]);

  // Picks + participants of this league's drafts → placement, points, player counts, chart.
  const linkedDraftIdsKey = useMemo(
    () => [...new Set(drafts.filter((d) => d.draft_id).map((d) => d.draft_id as string))].sort().join(","),
    [drafts],
  );
  const [draftPickData, setDraftPickData] = useState<{
    metrics: Record<string, LeagueDraftMetricPack>;
    participants: DraftParticipantRow[];
  } | null>(null);
  useEffect(() => {
    const ids = linkedDraftIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setDraftPickData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [picksRes, partsRes] = await Promise.all([
        supabase.from("draft_picks").select("draft_id, calculated_score, player_name").in("draft_id", ids),
        supabase.from("draft_participants").select("draft_id, user_id, participant_name, status").in("draft_id", ids),
      ]);
      if (cancelled) return;
      if (picksRes.error || partsRes.error) {
        setDraftPickData(null);
        return;
      }
      const picks = (picksRes.data ?? []) as any[];
      const participants = (partsRes.data ?? []) as DraftParticipantRow[];
      const metrics: Record<string, LeagueDraftMetricPack> = {};
      for (const id of ids) metrics[id] = buildLeagueDraftMetrics(id, picks, participants);
      setDraftPickData({ metrics, participants });
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedDraftIdsKey]);

  // Admin opens the draft room (creates the draft + pre-joins members).
  const openDraftRoom = async (entry: LeagueDraftEntry) => {
    if (openingId) return;
    setOpeningId(entry.id);
    const { data: draftId, error } = await supabase.rpc("start_league_scheduled_draft", { p_entry_id: entry.id });
    setOpeningId(null);
    if (error || !draftId) {
      Alert.alert("Could not open draft room", error?.message ?? "Something went wrong. Please try again.");
      return;
    }
    router.push(`/draft/${draftId}`);
  };

  const onScheduledPress = (entry: LeagueDraftEntry) => {
    const msUntil = entry.scheduled_at ? new Date(entry.scheduled_at).getTime() - Date.now() : Infinity;
    if (msUntil <= ONE_HOUR_MS) {
      if (isAdmin) openDraftRoom(entry);
      else
        Alert.alert(
          "Waiting for the admin",
          'The admin will open the draft room. You\'ll see a "Join Draft" button as soon as it\'s ready.',
        );
    } else {
      setDetailEntry(entry);
    }
  };

  const viewDraft = (entry: LeagueDraftEntry) => {
    if (!entry.draft_id) return;
    router.push(entry.draft?.is_complete ? `/final-scores/${entry.draft_id}` : `/draft/${entry.draft_id}`);
  };

  const confirmRemove = (entry: LeagueDraftEntry) =>
    Alert.alert(
      "Remove from league history?",
      "This removes the draft entry from this league's history. The draft itself is not deleted — it will still be accessible via its direct link. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const ok = await removeScheduledDraft(entry.id);
            if (!ok) Alert.alert("Could not remove draft", "Something went wrong. Please try again.");
          },
        },
      ],
    );

  const respondToInvite = async (action: "accept" | "decline") => {
    if (!myInvite || inviteBusy) return;
    setInviteBusy(action);
    if (action === "accept") {
      const id = await acceptInvite(myInvite.id);
      if (id) {
        await Promise.all([refetchInvites(), refetchMembers(), refetchLeague()]);
        setInviteBusy(null);
        return;
      }
      Alert.alert("Could not accept invite", "Something went wrong. Please try again.");
    } else {
      const ok = await declineInvite(myInvite.id);
      if (ok) {
        router.replace("/leagues");
        return;
      }
      Alert.alert("Could not decline invite", "Something went wrong. Please try again.");
    }
    setInviteBusy(null);
  };

  const seasonOptions = [
    ...quarters.map((q) => ({
      value: quarterId(q),
      label: quarterLabel(q),
      tag: quartersEqual(q, activeQuarter) ? "current" : undefined,
    })),
    { value: "all-time", label: "All time" },
  ];
  const seasonSelect = (
    <SelectSheet value={selectedQuarterId} options={seasonOptions} onChange={setSelectedQuarterId} title="Season" />
  );

  // ── Loading / not found / invite preview ──
  if (leagueLoading || invitesLoading) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm">Loading…</Text>
        </View>
      </View>
    );
  }

  if (!league) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center gap-6 p-4">
          <Text className="text-sm text-greyscale-blue-200">League not found.</Text>
          <Button label="Back to leagues" variant="outline" inline onPress={() => router.replace("/leagues")} />
        </View>
      </View>
    );
  }

  // Invited but not a member yet: Accept / Decline instead of the full page.
  if (myInvite && !isMember) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center p-4">
          <GlowCard
            gap={16}
            style={{ width: "100%", maxWidth: 420, alignItems: "center", borderLeftWidth: 3, borderLeftColor: colors.brand }}
          >
            <Text className="font-brockmann-semibold text-xs uppercase text-brand" style={{ letterSpacing: 2.4 }}>
              League invite
            </Text>
            <Text className="text-center font-brockmann-bold text-xl leading-7" style={{ letterSpacing: 0.8 }}>
              {league.name}
            </Text>
            <Text className="text-center text-sm text-greyscale-blue-300">
              {myInvite.inviter?.name ?? "Someone"} invited you to join this league.
            </Text>
            <View className="w-full flex-row gap-3 pt-2">
              <View className="flex-1">
                <Button
                  label={inviteBusy === "accept" ? "Joining…" : "Accept invite"}
                  variant="brand"
                  disabled={inviteBusy !== null}
                  onPress={() => respondToInvite("accept")}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={inviteBusy === "decline" ? "Declining…" : "Decline"}
                  variant="outline"
                  disabled={inviteBusy !== null}
                  onPress={() => respondToInvite("decline")}
                />
              </View>
            </View>
            <Button label="Back to leagues" variant="ghost" inline onPress={() => router.replace("/leagues")} />
          </GlowCard>
        </View>
      </View>
    );
  }

  const standingsHeading = quarter ? `${quarterLabel(quarter)} STANDINGS` : "ALL-TIME STANDINGS";
  const draftsHeading = quarter ? `${quarterLabel(quarter)} DRAFTS` : "LEAGUE DRAFTS";
  const nothingYet = scheduled.length + active.length + completed.length === 0;

  return (
    <View className="flex-1">
      <AppHeader backHref="/leagues" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 24, paddingBottom: insets.bottom + 48, gap: 24 }}
      >
        {/* Hero: faded trophy behind the copy, league name in Chaney */}
        <View style={{ paddingHorizontal: 12, paddingVertical: 24 }}>
          <View style={{ position: "absolute", left: -32, top: 0, opacity: 0.7 }} pointerEvents="none">
            <LeagueTrophy width={124} />
          </View>
          <View style={{ gap: 16, alignItems: "flex-end" }}>
            <View style={{ alignSelf: "stretch", gap: 16 }}>
              <Text className="font-chaney" style={{ fontSize: 44, lineHeight: 50, letterSpacing: 1 }}>
                {league.name}
              </Text>
              <Text className="font-brockmann-medium text-xl leading-7">
                {members.length} {members.length === 1 ? "member" : "members"} · {drafts.length}{" "}
                {drafts.length === 1 ? "draft" : "drafts"}
              </Text>
            </View>
            {isAdmin && (
              <Button
                label="Settings"
                variant="outline"
                small
                inline
                icon={<Settings size={16} color={colors.textGrey} />}
                onPress={() => Linking.openURL(`${SITE}/league/${leagueId}/settings`)}
              />
            )}
          </View>
        </View>

        <PillTabs tabs={TABS} value={tab} onChange={setTab} />

        <View style={{ gap: 12 }}>
          {isAdmin && (
            <Button
              label="Schedule Draft"
              variant="outline"
              icon={<CalendarClock size={20} color={colors.textPrimary} />}
              onPress={() => Linking.openURL(`${SITE}/league/${leagueId}/settings?tab=schedule`)}
            />
          )}
          <Button label="Start New Draft" onPress={() => router.push(`/draft/new?league=${leagueId}`)} />
        </View>

        {/* Standings */}
        {tab === "standings" && (
          <GlowCard>
            <View className="gap-4">
              <SectionTitle>{standingsHeading}</SectionTitle>
              {seasonSelect}
            </View>
            {standingsLoading ? (
              <Text className="py-8 text-center text-sm">Loading standings…</Text>
            ) : standings.length === 0 ? (
              <View className="items-center gap-2 py-12">
                <Text className="text-sm text-greyscale-blue-300">No scores yet.</Text>
                <Text className="text-xs text-greyscale-blue-400">Add completed drafts to start tracking standings.</Text>
              </View>
            ) : (
              <>
                <View style={{ gap: 16 }}>
                  {standings.map((s, i) => (
                    <StandingRow key={s.user_id} s={s} rank={ranks[i]} isYou={s.user_id === user?.id} />
                  ))}
                </View>
                {completed.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 24 }}>
                    <LeagueStandingsChart
                      standings={standings}
                      completedDrafts={completed}
                      draftPickData={draftPickData}
                      specDraftData={specDraftData}
                    />
                  </View>
                )}
              </>
            )}
          </GlowCard>
        )}

        {/* Drafts */}
        {tab === "drafts" && (
          <GlowCard>
            <View className="gap-4">
              <SectionTitle>{draftsHeading}</SectionTitle>
              {seasonSelect}
            </View>

            <View style={{ gap: 16 }}>
              {draftsLoading && <Text className="py-6 text-center text-sm">Loading drafts…</Text>}

              {!draftsLoading && nothingYet && (
                <View className="items-center gap-2 py-12">
                  <Text className="text-sm text-greyscale-blue-300">No drafts yet.</Text>
                  {isAdmin && (
                    <Text className="text-center text-xs text-greyscale-blue-400">
                      Tap Start New Draft above or schedule one in settings.
                    </Text>
                  )}
                </View>
              )}

              {!draftsLoading && scheduled.length > 0 && (
                <View style={{ gap: 16 }}>
                  <GroupLabel>Upcoming</GroupLabel>
                  {scheduled.map((entry) => {
                    const specId = entry.draft_type === "spec-draft" && entry.theme ? entry.theme : null;
                    const specMeta = specId ? specDraftData.get(specId) : undefined;
                    const withinHour = entry.scheduled_at ? new Date(entry.scheduled_at).getTime() - Date.now() <= ONE_HOUR_MS : false;
                    const isOpening = openingId === entry.id;
                    const adminLabel = withinHour ? (isOpening ? "Opening…" : "Open Draft Room") : "Edit";
                    return (
                      <LeagueDraftCard
                        key={entry.id}
                        entry={entry}
                        headline={upcomingHeadline(entry, specMeta)}
                        specInfo={entry.draft_type === "spec-draft" ? specMeta : undefined}
                        participantCount={0}
                        categoriesCount={entry.categories?.length ?? 0}
                        displayDate={entry.scheduled_at ? new Date(entry.scheduled_at) : null}
                        isScheduled
                        isComplete={false}
                        isMultiplayer={!!entry.is_multiplayer}
                        canEditSchedule={!!isAdmin}
                        viewLabel={isAdmin ? adminLabel : "View Details"}
                        viewDisabled={isAdmin && isOpening}
                        onView={
                          isAdmin
                            ? withinHour
                              ? () => openDraftRoom(entry)
                              : () => Linking.openURL(`${SITE}/league/${leagueId}/settings?tab=schedule&edit=${entry.id}`)
                            : () => onScheduledPress(entry)
                        }
                        onDetails={!isAdmin ? () => onScheduledPress(entry) : undefined}
                      />
                    );
                  })}
                </View>
              )}

              {!draftsLoading && active.length > 0 && (
                <View style={{ gap: 16 }}>
                  <GroupLabel>In progress</GroupLabel>
                  {active.map((entry) => {
                    const id = entry.draft_id!;
                    const m = draftPickData?.metrics[id];
                    const participants = draftPickData?.participants ?? [];
                    // League members are pre-joined as "invited" until they open the draft once —
                    // say "Join Draft" until this viewer has actually shown up.
                    const viewerJoined = user
                      ? participants.find((p) => p.draft_id === id && p.user_id === user.id)?.status === "joined"
                      : false;
                    return (
                      <LeagueDraftCard
                        key={entry.id}
                        entry={entry}
                        specInfo={entry.draft?.theme === "spec-draft" ? specDraftData.get(entry.draft.option ?? "") : undefined}
                        participantCount={m?.participantCount ?? 0}
                        categoriesCount={entry.draft?.categories?.length ?? entry.categories?.length ?? 0}
                        displayDate={entry.draft?.created_at ? new Date(entry.draft.created_at) : null}
                        isScheduled={false}
                        isComplete={false}
                        isMultiplayer={entry.draft ? !!entry.draft.is_multiplayer : !!entry.is_multiplayer}
                        viewLabel={viewerJoined ? "Continue Draft" : "Join Draft"}
                        onView={() => viewDraft(entry)}
                        onDelete={isAdmin ? () => confirmRemove(entry) : undefined}
                      />
                    );
                  })}
                </View>
              )}

              {!draftsLoading && completed.length > 0 && (
                <View style={{ gap: 16 }}>
                  <GroupLabel>Completed</GroupLabel>
                  {completed.map((entry) => {
                    const id = entry.draft_id!;
                    const m = draftPickData?.metrics[id];
                    const participants = draftPickData?.participants ?? [];
                    const placement = user && m ? draftPlacementRank(user.id, participants, id, m.byParticipantName) : null;
                    const earned = user && m ? draftLeaguePointsByUserId(id, participants, m.byParticipantName)[user.id] ?? null : null;
                    return (
                      <LeagueDraftCard
                        key={entry.id}
                        entry={entry}
                        specInfo={entry.draft?.theme === "spec-draft" ? specDraftData.get(entry.draft.option ?? "") : undefined}
                        participantCount={m?.participantCount ?? 0}
                        categoriesCount={entry.draft?.categories?.length ?? entry.categories?.length ?? 0}
                        displayDate={entry.draft?.created_at ? new Date(entry.draft.created_at) : null}
                        isScheduled={false}
                        isComplete
                        isMultiplayer={entry.draft ? !!entry.draft.is_multiplayer : !!entry.is_multiplayer}
                        placementRank={placement}
                        leaguePointsEarned={earned}
                        viewLabel="View Draft"
                        onView={() => viewDraft(entry)}
                        onDelete={isAdmin ? () => confirmRemove(entry) : undefined}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          </GlowCard>
        )}

        {tab === "messages" && <LeagueMessageBoard leagueId={leagueId} isAdmin={!!isAdmin} />}
      </ScrollView>

      <ScheduledDraftDetailModal
        entry={detailEntry}
        specName={
          detailEntry?.draft_type === "spec-draft" && detailEntry.theme ? specDraftData.get(detailEntry.theme)?.name : undefined
        }
        isAdmin={!!isAdmin}
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        onEditSettings={() => {
          setDetailEntry(null);
          Linking.openURL(`${SITE}/league/${leagueId}/settings`);
        }}
      />
    </View>
  );
}
