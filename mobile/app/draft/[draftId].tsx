import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Clock, Copy, Film, Trophy } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { isParticipantOnline, useDraftRoom } from "../../hooks/useDraftRoom";
import { useSpecCategories } from "../../hooks/useSpecCategories";
import type { PickerMovie } from "../../hooks/useMovieSearch";
import { buildBoard } from "../../lib/draftBoard";
import { MONO, colors } from "../../lib/theme";
import { MultiPersonIcon, PersonIcon } from "../../components/icons";
import { DraftBoardTable, PlayerRail, PlayerSlots, RosterList } from "../../components/DraftBoard";
import { MoviePickerModal } from "../../components/MoviePickerModal";
import { ParticipantAvatar } from "../../components/ParticipantAvatar";
import { VotingPanel } from "../../components/VotingPanel";
import { AppHeader, Button, GlowCard, PageHero, PillTabs, SectionHeader, Text } from "../../components/ui";

const cleanActor = (s: string) => (s.includes("|") ? s.split("|")[0] : s);

type LiveTab = "pick" | "board" | "rosters";
const LIVE_TABS = [
  { key: "pick", label: "Pick" },
  { key: "board", label: "Board" },
  { key: "rosters", label: "Rosters" },
] as const;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm leading-5 text-greyscale-blue-300">{label}</Text>
      <Text numberOfLines={1} className="flex-1 text-right font-brockmann-medium text-sm leading-5">
        {value}
      </Text>
    </View>
  );
}

// Lobby + live draft, laid out like the website's draft page: title, (start block), board, Draft Status card,
// Join Code / Participants card, then voting and "View Final Scores" once complete.
export default function DraftRoom() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const room = useDraftRoom(draftId);
  const [liveTab, setLiveTab] = useState<LiveTab>("pick");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [pickCategory, setPickCategory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const { draft, participants, picks, isHost, hasStarted, joinedCount, starting } = room;
  const specCategories = useSpecCategories(draft?.theme, draft?.option);
  const board = useMemo(
    () => (draft ? buildBoard(draft, participants, picks, user?.id) : null),
    [draft, participants, picks, user?.id],
  );

  // When the turn moves on, follow the player on the clock again.
  const currentRow = board?.currentRowIndex ?? -1;
  useEffect(() => setSelectedRow(null), [currentRow]);

  if (room.loading) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text className="text-sm text-greyscale-blue-300">Loading your draft...</Text>
        </View>
      </View>
    );
  }

  if (room.error || !draft || !board) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center p-4">
          <GlowCard style={{ width: "100%", maxWidth: 420, alignItems: "center" }}>
            <Text className="text-center font-brockmann-bold text-2xl leading-8" style={{ letterSpacing: 0.96 }}>
              Draft Not Found
            </Text>
            <Text className="text-center text-sm leading-5 text-greyscale-blue-300">{room.error ?? "This draft does not exist or you do not have permission to view it."}</Text>
            <Button label="Back to Home" variant="outline" inline onPress={() => router.replace("/leagues")} />
          </GlowCard>
        </View>
      </View>
    );
  }

  const isComplete = draft.is_complete;
  const live = hasStarted && !isComplete;
  const currentId = draft.current_turn_participant_id || draft.current_turn_user_id;
  const myTurn = live && !!currentId && String(currentId) === user?.id;
  const currentPlayer = board.rows[board.currentRowIndex]?.participant;
  const takenMovieIds = new Set(picks.map((p) => Number(p.movie_id)));
  const viewRow = selectedRow ?? (board.currentRowIndex >= 0 ? board.currentRowIndex : Math.max(board.myRowIndex, 0));

  // Hero title like the website: "{OPTION} MOVIES" (special drafts: just the name).
  const isSpec = draft.theme === "spec-draft";
  const heroTitle = isSpec ? draft.title?.trim() || "Special Draft" : cleanActor(draft.option || draft.title || "");
  const heroSize = heroTitle.length <= 10 ? 40 : heroTitle.length <= 18 ? 34 : 28;

  const copyCode = async () => {
    if (!draft.invite_code) return;
    await Clipboard.setStringAsync(String(draft.invite_code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () =>
    Share.share({ message: `Join my Movie Drafter draft! Use the code ${draft.invite_code} at moviedrafter.com` });

  const start = async () => {
    setStartError(null);
    const err = await room.startDraft();
    if (err) {
      setStartError(err);
      Alert.alert("Could not start the draft", err);
    }
  };

  const submitPick = async (movie: PickerMovie, category: string): Promise<string | null> => {
    const err = await room.makePick({
      id: movie.id,
      title: movie.title,
      year: movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : movie.year,
      genre: movie.genre_names?.[0] || movie.genre || "Unknown",
      category,
      posterPath: movie.poster_path ?? movie.posterPath ?? undefined,
    });
    if (!err) setPickCategory(null);
    return err;
  };

  const visibleParticipants = participants.filter((p) => p.status !== "invited");

  return (
    <View className="flex-1">
      <AppHeader backHref="/leagues" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 24 }}>
        <PageHero title={heroTitle} suffix={isSpec ? undefined : "MOVIES"} size={heroSize} />

        {/* "Everybody Ready?" — host only, before the draft starts */}
        {!hasStarted && participants.length >= 2 && !isComplete && isHost && (
          <View className="items-center gap-4 p-6">
            <View className="items-center gap-2">
              <Text className="text-center font-brockmann-medium text-xl leading-7">Everybody Ready?</Text>
              <Text className="text-center text-sm leading-5 text-greyscale-blue-300">
                {joinedCount} {joinedCount === 1 ? "player has" : "players have"} joined. Click below to randomize turn order and start the draft!
              </Text>
            </View>
            <Pressable
              onPress={start}
              disabled={starting}
              className="items-center justify-center rounded-control active:opacity-80"
              style={{ backgroundColor: colors.purple500, paddingHorizontal: 32, paddingVertical: 16, opacity: starting ? 0.7 : 1 }}
            >
              <Text className="font-brockmann-semibold text-lg leading-6">{starting ? "Starting..." : "Start Draft"}</Text>
            </Pressable>
            {!!startError && <Text className="text-center text-sm text-[#FF6C6C]">{startError}</Text>}
          </View>
        )}

        {/* Live board — one player at a time, plus the full board and rosters */}
        {live && (
          <View style={{ gap: 16 }}>
            <PillTabs tabs={LIVE_TABS} value={liveTab} onChange={setLiveTab} />

            {liveTab === "pick" && (
              <View style={{ gap: 16 }}>
                <PlayerRail board={board} selected={viewRow} onSelect={setSelectedRow} now={room.now} />
                <GlowCard gap={16} padding={16}>
                  <Text className="font-brockmann-medium text-base">
                    {board.rows[viewRow]?.participant.participant_name}
                    {viewRow === board.myRowIndex ? " (you)" : ""}
                  </Text>
                  <PlayerSlots
                    board={board}
                    rowIndex={viewRow}
                    canPick={myTurn}
                    activeCategory={pickCategory}
                    onPickCategory={setPickCategory}
                    onCancel={() => setPickCategory(null)}
                  />
                </GlowCard>
                {currentPlayer?.is_ai && (
                  <View className="items-center gap-2 py-2">
                    <Text className="font-brockmann-medium text-lg leading-6">{currentPlayer.participant_name} is thinking...</Text>
                    <ActivityIndicator color={colors.accent} />
                    <Text className="text-center text-xs text-greyscale-blue-400">AI players make their picks from the host's web browser for now.</Text>
                  </View>
                )}
              </View>
            )}
            {liveTab === "board" && <DraftBoardTable board={board} />}
            {liveTab === "rosters" && <RosterList board={board} />}
          </View>
        )}

        {/* Draft Status */}
        <GlowCard>
          <SectionHeader icon={<Clock size={24} color={colors.accent} />} title="Draft Status" />
          {isComplete ? (
            <View className="items-center gap-3">
              <Text className="text-center font-brockmann-semibold text-base leading-6">Draft Complete</Text>
              <Text className="text-center text-sm leading-5 text-greyscale-blue-300">All picks have been made!</Text>
            </View>
          ) : !hasStarted && participants.length >= 2 && !isHost ? (
            <View className="items-center gap-2">
              <Text className="text-center font-brockmann-semibold text-base leading-6">Waiting on the Host to start the draft</Text>
              <Text className="text-center text-sm leading-5 text-greyscale-blue-300">The host will begin the draft when ready.</Text>
            </View>
          ) : (
            <>
              <View className="gap-3">
                <StatRow label="Pick Number:" value={String(draft.current_pick_number)} />
                <StatRow label="Current Turn:" value={currentPlayer?.participant_name || "Unknown"} />
              </View>
              {hasStarted && !myTurn && (
                <View
                  className="items-center gap-3 rounded-card bg-card"
                  style={{ paddingTop: 22, paddingBottom: 24, paddingHorizontal: 24, borderWidth: 1, borderColor: colors.itemStroke }}
                >
                  <Clock size={20} color={colors.textGrey} />
                  <View className="items-center gap-1 self-stretch">
                    <Text numberOfLines={1} className="self-stretch text-center font-brockmann-semibold text-base leading-6" style={{ letterSpacing: 0.32 }}>
                      Waiting for {currentPlayer?.participant_name}
                    </Text>
                    <Text className="text-center text-sm leading-5 text-greyscale-blue-300">It's their turn to make a pick</Text>
                  </View>
                </View>
              )}
              {myTurn && (
                <View
                  className="items-center gap-3 rounded-card"
                  style={{ padding: 24, backgroundColor: colors.purple800, borderWidth: 3, borderColor: colors.purple500 }}
                >
                  <Film size={24} color={colors.gold} />
                  <View className="items-center gap-1">
                    <Text className="text-center font-brockmann-semibold text-base leading-6" style={{ letterSpacing: 0.32 }}>
                      It's Your Turn!
                    </Text>
                    <Text className="text-center text-sm leading-5">Make your next pick to your movie roster</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </GlowCard>

        {/* Join Code / Participants */}
        <GlowCard>
          {!!draft.invite_code && (
            <View className="gap-3">
              <Text className="font-brockmann-bold text-2xl leading-6" style={{ letterSpacing: 0.24 }}>
                Join Code
              </Text>
              <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                <View className="rounded-full bg-card" style={{ paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: colors.textPrimary }}>
                  <Text style={{ fontFamily: MONO, fontSize: 18, lineHeight: 28, letterSpacing: 1.08 }}>{String(draft.invite_code)}</Text>
                </View>
                <Pressable
                  onPress={copyCode}
                  className="flex-row items-center gap-2 rounded-control bg-card active:opacity-80"
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.textPrimary }}
                >
                  <Text className="font-brockmann-medium text-sm">{copied ? "Copied!" : "Copy"}</Text>
                  {copied ? <Check size={16} color={colors.textPrimary} /> : <Copy size={16} color={colors.textPrimary} />}
                </Pressable>
                <Button label="Share" variant="outline" small inline onPress={shareCode} />
              </View>
            </View>
          )}

          <View className="gap-4">
            <SectionHeader icon={<MultiPersonIcon size={24} color="#BCB2FF" />} title="Participants" />
            <View className="flex-row flex-wrap" style={{ gap: 18 }}>
              {visibleParticipants.map((p) => (
                <View key={p.id} className="items-center" style={{ width: 72, gap: 4 }}>
                  <ParticipantAvatar name={p.participant_name} avatarUrl={p.avatar_url} size={64} fontSize={18} online={isParticipantOnline(p, room.now)} />
                  <Text numberOfLines={1} className="text-[11px] text-greyscale-blue-300">
                    {p.participant_name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </GlowCard>

        {participants.length < 2 && !isComplete && (
          <View className="items-center gap-3 p-6">
            <PersonIcon size={24} color={colors.textPrimary} />
            <Text className="text-center font-brockmann-medium text-xl leading-7">Waiting For Players</Text>
            <Text className="text-center text-sm leading-5 text-greyscale-blue-300">
              Need at least 2 players to start the draft. Share the invite code above!
            </Text>
          </View>
        )}

        {isComplete && (
          <>
            <VotingPanel draftId={draft.id} />
            <Pressable
              onPress={() => router.replace(`/final-scores/${draft.id}`)}
              className="flex-row items-center justify-center gap-2 self-center rounded-control active:opacity-80"
              style={{ backgroundColor: colors.purple500, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Trophy size={18} color={colors.gold} />
              <Text className="font-brockmann-medium text-sm">View Final Scores</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <MoviePickerModal
        visible={pickCategory !== null}
        category={pickCategory}
        theme={draft.theme}
        option={draft.option}
        categories={draft.categories}
        specCategories={specCategories}
        takenMovieIds={takenMovieIds}
        onClose={() => setPickCategory(null)}
        onConfirm={submitPick}
      />
    </View>
  );
}
