import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  useLeague,
  useLeagueActions,
  useLeagueDrafts,
  useLeagueMembers,
  useLeagueMessages,
  useLeagueQuarters,
  useLeagueSeasonStandings,
  useLeagueStandings,
  usePendingLeagueInvites,
  type LeagueDraftEntry,
  type LeagueMessage,
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
import { tieRanksForStandings } from "../../lib/leagueRanks";
import { Button, Card, Centered, ScreenHeader } from "../../components/ui";

type Tab = "standings" | "drafts" | "messages";
const TABS: { key: Tab; label: string }[] = [
  { key: "standings", label: "Standings" },
  { key: "drafts", label: "Drafts" },
  { key: "messages", label: "Messages" },
];

const ONE_HOUR_MS = 60 * 60 * 1000;

const DRAFT_TYPE_LABELS: Record<string, string> = {
  classic: "Classic",
  year: "By Year",
  people: "By Filmmaker",
  "spec-draft": "Special Draft",
  filmography: "By Filmography",
};

// ── Small pieces ─────────────────────────────────────────────────────────────

const RANK_COLORS = ["#FFD60A", "#CCCCCC", "#DE7E3E"];

function StandingRow({ s, rank, isYou }: { s: LeagueStanding; rank: number; isYou: boolean }) {
  const badge = RANK_COLORS[rank - 1] ?? "#907AFF";
  return (
    <View
      className={`flex-row items-center gap-4 rounded-lg py-4 pl-4 pr-5 ${
        isYou ? "border-2 border-accent bg-[#160038]" : "border border-white/15 bg-card"
      }`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: badge }}
      >
        <Text className="text-base font-bold text-[#1D1D1F]">{rank}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-white">
          {s.display_name ?? "Unknown"}
        </Text>
        <Text className="text-sm text-white/50">
          {s.draft_count} {s.draft_count === 1 ? "draft" : "drafts"} · {s.raw_score.toFixed(1)} movie
          score
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-3xl font-bold text-accent">{s.total_score}</Text>
        <Text className="text-xs text-white/40">pts</Text>
      </View>
    </View>
  );
}

function SeasonChips({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onSelect(o.id)}
          className={`rounded-full px-4 py-2 ${selected === o.id ? "bg-brand" : "bg-card"}`}
        >
          <Text className="text-sm font-medium text-white">{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function draftHeadline(entry: LeagueDraftEntry): string {
  const title = entry.draft?.title?.trim();
  if (title) return title;
  const theme = entry.theme?.trim();
  if (theme && entry.draft_type !== "spec-draft") return theme;
  return DRAFT_TYPE_LABELS[entry.draft_type ?? ""] ?? "Draft";
}

function formatWhen(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: withTime ? "numeric" : undefined,
    minute: withTime ? "2-digit" : undefined,
  });
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function DraftCard({
  entry,
  badge,
  actionLabel,
  onPress,
  disabled,
}: {
  entry: LeagueDraftEntry;
  badge: string;
  actionLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const multiplayer = entry.draft ? !!entry.draft.is_multiplayer : !!entry.is_multiplayer;
  const when = entry.scheduled_at
    ? formatWhen(entry.scheduled_at, true)
    : formatWhen(entry.draft?.created_at);
  return (
    <View className="rounded-lg border border-white/15 bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-widest text-accent">{badge}</Text>
        <Text className="text-xs text-white/40">{multiplayer ? "Multiplayer" : "Local"}</Text>
      </View>
      <Text numberOfLines={2} className="mt-1 text-lg font-semibold text-white">
        {draftHeadline(entry)}
      </Text>
      <Text className="mt-0.5 text-sm text-white/50">
        {DRAFT_TYPE_LABELS[entry.draft_type ?? ""] ?? ""}
        {entry.draft_type && when ? " · " : ""}
        {when}
      </Text>
      <View className="mt-3">
        <Button label={actionLabel} variant="outline" onPress={onPress} disabled={disabled} />
      </View>
    </View>
  );
}

// ── Messages tab ─────────────────────────────────────────────────────────────

function MessagesTab({ leagueId, isAdmin }: { leagueId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const { posts, repliesMap, loading, sendMessage, deleteMessage } = useLeagueMessages(leagueId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const ok = await sendMessage(draft);
    setSending(false);
    if (ok) setDraft("");
    else Alert.alert("Could not send", "Something went wrong. Please try again.");
  };

  const confirmDelete = (msg: LeagueMessage) => {
    Alert.alert("Delete message?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMessage(msg.id) },
    ]);
  };

  const canDelete = (m: LeagueMessage) => m.user_id === user?.id || isAdmin;

  return (
    <View className="gap-4">
      <Card>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Write something to your league…"
          placeholderTextColor="#BDC3C2"
          className="min-h-[72px] rounded-sm border border-white/30 bg-card px-4 py-3 text-base text-white"
          style={{ textAlignVertical: "top" }}
        />
        <View className="mt-3">
          <Button label="Post" onPress={send} disabled={!draft.trim()} loading={sending} variant="brand" />
        </View>
      </Card>

      {loading && <ActivityIndicator color="#7142FF" />}
      {!loading && posts.length === 0 && (
        <Text className="py-8 text-center text-sm text-white/50">No messages yet. Start the conversation.</Text>
      )}

      {[...posts].reverse().map((post) => (
        <View key={post.id} className="rounded-lg bg-surface p-4">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm font-semibold text-white">{post.author?.name ?? "Unknown"}</Text>
            <Text className="text-xs text-white/40">{timeAgo(post.created_at)}</Text>
          </View>
          <Text className="mt-1 text-base leading-6 text-white/85">{post.content}</Text>
          {canDelete(post) && (
            <Pressable onPress={() => confirmDelete(post)} className="mt-2 self-start active:opacity-70">
              <Text className="text-xs text-white/40">Delete</Text>
            </Pressable>
          )}
          {(repliesMap[post.id] ?? []).map((reply) => (
            <View key={reply.id} className="mt-3 border-l-2 border-white/15 pl-3">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-xs font-semibold text-white">{reply.author?.name ?? "Unknown"}</Text>
                <Text className="text-[10px] text-white/40">{timeAgo(reply.created_at)}</Text>
              </View>
              <Text className="mt-0.5 text-sm text-white/80">{reply.content}</Text>
              {canDelete(reply) && (
                <Pressable onPress={() => confirmDelete(reply)} className="mt-1 self-start active:opacity-70">
                  <Text className="text-[10px] text-white/40">Delete</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function LeagueDetail() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { league, loading: leagueLoading, refetch: refetchLeague } = useLeague(leagueId);
  const { members, refetch: refetchMembers } = useLeagueMembers(leagueId);
  const { drafts, loading: draftsLoading } = useLeagueDrafts(leagueId);
  const { quarters, activeQuarter } = useLeagueQuarters(drafts);
  const { invites, loading: invitesLoading, refetch: refetchInvites } = usePendingLeagueInvites();
  const { acceptInvite, declineInvite } = useLeagueActions();

  const [tab, setTab] = useState<Tab>("standings");
  const [selectedQuarterId, setSelectedQuarterId] = useState(() => quarterId(currentQuarter()));
  const [inviteBusy, setInviteBusy] = useState<"accept" | "decline" | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const quarter = selectedQuarterId === "all-time" ? undefined : parseQuarterId(selectedQuarterId);
  const { standings: allTime, loading: allTimeLoading } = useLeagueStandings(
    quarter ? undefined : leagueId,
  );
  const { standings: season, loading: seasonLoading } = useLeagueSeasonStandings(leagueId, quarter);
  const standings = quarter ? season : allTime;
  const standingsLoading = quarter ? seasonLoading : allTimeLoading;
  const ranks = useMemo(() => tieRanksForStandings(standings), [standings]);

  // If the chosen season isn't in the list (e.g. league switched), fall back to now.
  useEffect(() => {
    if (selectedQuarterId === "all-time") return;
    if (!quarters.some((q) => quarterId(q) === selectedQuarterId)) {
      setSelectedQuarterId(quarterId(activeQuarter));
    }
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
  const scheduled = drafts.filter((d) => !d.draft_id && d.scheduled_at);
  const active = drafts.filter((d) => d.draft_id && !d.draft?.is_complete).filter(inScope);
  const completed = drafts.filter((d) => d.draft_id && d.draft?.is_complete).filter(inScope);

  const seasonOptions = [
    ...quarters.map((q) => ({
      id: quarterId(q),
      label: quarterLabel(q) + (quartersEqual(q, activeQuarter) ? " · now" : ""),
    })),
    { id: "all-time", label: "All time" },
  ];

  // Admin opens a scheduled draft's room (creates the draft + pre-joins members).
  const openDraftRoom = async (entry: LeagueDraftEntry) => {
    if (openingId) return;
    setOpeningId(entry.id);
    const { data: draftId, error } = await supabase.rpc("start_league_scheduled_draft", {
      p_entry_id: entry.id,
    });
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
      Alert.alert(
        draftHeadline(entry),
        `Scheduled for ${formatWhen(entry.scheduled_at, true)}. The draft room opens an hour before.`,
      );
    }
  };

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

  if (leagueLoading || invitesLoading) {
    return (
      <Centered>
        <ActivityIndicator color="#7142FF" />
      </Centered>
    );
  }

  if (!league) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="League" />
        <Centered>
          <Text className="text-base text-white/60">League not found.</Text>
        </Centered>
      </View>
    );
  }

  // Invited but not a member yet: show accept / decline instead of the dashboard.
  if (myInvite && !isMember) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="League invite" />
        <View className="flex-1 justify-center p-6">
          <View className="gap-4 rounded-lg border-l-4 border-brand bg-surface p-6">
            <Text className="text-xs font-semibold uppercase tracking-widest text-accent">League invite</Text>
            <Text className="text-2xl font-bold text-white">{league.name}</Text>
            <Text className="text-base text-white/60">
              {myInvite.inviter?.name ?? "Someone"} invited you to join this league.
            </Text>
            <Button
              label="Accept invite"
              variant="brand"
              onPress={() => respondToInvite("accept")}
              loading={inviteBusy === "accept"}
              disabled={inviteBusy !== null}
            />
            <Button
              label="Decline"
              variant="outline"
              onPress={() => respondToInvite("decline")}
              loading={inviteBusy === "decline"}
              disabled={inviteBusy !== null}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <ScreenHeader title={league.name} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}
        >
          <View>
            <Text className="text-3xl font-bold text-white">{league.name}</Text>
            <Text className="mt-1 text-base text-white/60">
              {members.length} {members.length === 1 ? "member" : "members"} · {drafts.length}{" "}
              {drafts.length === 1 ? "draft" : "drafts"}
            </Text>
          </View>

          {/* Pill tabs */}
          <View className="flex-row overflow-hidden rounded-full border border-white/20">
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                className={`flex-1 items-center py-3 ${tab === t.key ? "bg-brand" : "bg-card"}`}
              >
                <Text className="text-sm font-medium text-white">{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "standings" && (
            <View className="gap-4">
              <SeasonChips options={seasonOptions} selected={selectedQuarterId} onSelect={setSelectedQuarterId} />
              <Text className="text-xl font-bold tracking-wider text-white">
                {quarter ? `${quarterLabel(quarter).toUpperCase()} STANDINGS` : "ALL-TIME STANDINGS"}
              </Text>
              {standingsLoading ? (
                <ActivityIndicator color="#7142FF" />
              ) : standings.length === 0 ? (
                <View className="items-center gap-1 py-10">
                  <Text className="text-sm text-white/60">No scores yet.</Text>
                  <Text className="text-xs text-white/40">Completed drafts will show up here.</Text>
                </View>
              ) : (
                standings.map((s, i) => (
                  <StandingRow key={s.user_id} s={s} rank={ranks[i]} isYou={s.user_id === user?.id} />
                ))
              )}
            </View>
          )}

          {tab === "drafts" && (
            <View className="gap-4">
              <SeasonChips options={seasonOptions} selected={selectedQuarterId} onSelect={setSelectedQuarterId} />
              {draftsLoading && <ActivityIndicator color="#7142FF" />}
              {!draftsLoading && scheduled.length + active.length + completed.length === 0 && (
                <Text className="py-10 text-center text-sm text-white/50">No drafts yet.</Text>
              )}

              {scheduled.length > 0 && (
                <>
                  <Text className="text-xs font-semibold uppercase tracking-widest text-white/40">Upcoming</Text>
                  {scheduled.map((entry) => {
                    const withinHour =
                      !!entry.scheduled_at && new Date(entry.scheduled_at).getTime() - Date.now() <= ONE_HOUR_MS;
                    return (
                      <DraftCard
                        key={entry.id}
                        entry={entry}
                        badge="Scheduled"
                        actionLabel={
                          isAdmin && withinHour
                            ? openingId === entry.id
                              ? "Opening…"
                              : "Open draft room"
                            : "View details"
                        }
                        disabled={openingId === entry.id}
                        onPress={() => onScheduledPress(entry)}
                      />
                    );
                  })}
                </>
              )}

              {active.length > 0 && (
                <>
                  <Text className="text-xs font-semibold uppercase tracking-widest text-white/40">In progress</Text>
                  {active.map((entry) => (
                    <DraftCard
                      key={entry.id}
                      entry={entry}
                      badge="In progress"
                      actionLabel="Join draft"
                      onPress={() => router.push(`/draft/${entry.draft_id}`)}
                    />
                  ))}
                </>
              )}

              {completed.length > 0 && (
                <>
                  <Text className="text-xs font-semibold uppercase tracking-widest text-white/40">Completed</Text>
                  {completed.map((entry) => (
                    <DraftCard
                      key={entry.id}
                      entry={entry}
                      badge="Completed"
                      actionLabel="View final scores"
                      onPress={() => router.push(`/final-scores/${entry.draft_id}`)}
                    />
                  ))}
                </>
              )}
            </View>
          )}

          {tab === "messages" && <MessagesTab leagueId={leagueId} isAdmin={!!isAdmin} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
