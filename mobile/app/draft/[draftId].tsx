import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import {
  isParticipantOnline,
  useDraftRoom,
  type DraftParticipant,
} from "../../hooks/useDraftRoom";
import { Button, Card, Centered, ScreenHeader } from "../../components/ui";
import { buildBoard } from "../../lib/draftBoard";
import { useSpecCategories } from "../../hooks/useSpecCategories";
import { DraftBoard, RosterList } from "../../components/DraftBoard";
import { VotingPanel } from "../../components/VotingPanel";
import { MoviePickerModal } from "../../components/MoviePickerModal";
import type { PickerMovie } from "../../hooks/useMovieSearch";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ParticipantRow({ p, now }: { p: DraftParticipant; now: number }) {
  const online = isParticipantOnline(p, now);
  const waiting = p.status === "invited";
  return (
    <View className="flex-row items-center gap-3 rounded-lg bg-card px-4 py-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#1A1D29]">
        <Text className="text-base font-semibold text-white">{initials(p.participant_name)}</Text>
        {online && (
          <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-[#41DA86]" />
        )}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-white">
          {p.participant_name}
        </Text>
        <Text className="text-sm text-white/50">
          {p.is_ai ? "AI player" : waiting ? "Hasn't joined yet" : online ? "Online" : "Offline"}
        </Text>
      </View>
      {p.is_host && (
        <View className="rounded-full bg-brand px-3 py-1">
          <Text className="text-xs font-semibold text-white">Host</Text>
        </View>
      )}
    </View>
  );
}

export default function DraftRoom() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const room = useDraftRoom(draftId);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "rosters">("board");
  const [pickCategory, setPickCategory] = useState<string | null>(null);

  const { draft, participants, picks, isHost, hasStarted, joinedCount, starting } = room;
  const specCategories = useSpecCategories(draft?.theme, draft?.option);
  const board = useMemo(
    () => (draft ? buildBoard(draft, participants, picks, user?.id) : null),
    [draft, participants, picks, user?.id],
  );

  if (room.loading) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="Draft" />
        <Centered>
          <ActivityIndicator color="#7142FF" />
        </Centered>
      </View>
    );
  }

  if (room.error || !draft) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="Draft" />
        <Centered>
          <Text className="text-center text-base text-white/60">
            {room.error ?? "Draft not found."}
          </Text>
        </Centered>
      </View>
    );
  }

  const shareCode = () =>
    Share.share({
      message: `Join my Movie Drafter draft! Use the code ${draft.invite_code} at moviedrafter.com`,
    });

  const start = async () => {
    setError(null);
    const err = await room.startDraft();
    if (err) {
      setError(err);
      Alert.alert("Could not start the draft", err);
    }
  };

  const live = hasStarted && !draft.is_complete;
  const currentId = draft.current_turn_participant_id || draft.current_turn_user_id;
  const myTurn = live && !!currentId && String(currentId) === user?.id;
  const currentPlayer = board?.rows[board.currentRowIndex]?.participant;
  const takenMovieIds = new Set(picks.map((p) => Number(p.movie_id)));

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

  const me = participants.find((p) => p.user_id === user?.id);
  const title = draft.title?.trim() || "Draft";
  const subtitle = [draft.theme, draft.option].filter(Boolean).join(" · ");

  return (
    <View className="flex-1 bg-ink">
      <ScreenHeader title={title} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}
      >
        <View>
          <Text className="text-3xl font-bold text-white">{title}</Text>
          {!!subtitle && <Text className="mt-1 text-base text-white/60">{subtitle}</Text>}
          {!!me && (
            <Text className="mt-1 text-sm text-white/40">You're playing as {me.participant_name}</Text>
          )}
        </View>

        {live && board && (
          <>
            <Card>
              {myTurn ? (
                <View className="items-center gap-1">
                  <Text className="text-lg font-semibold text-gold">It's your turn!</Text>
                  <Text className="text-center text-sm text-white/60">
                    Tap a highlighted slot on your row to make a pick.
                  </Text>
                </View>
              ) : (
                <View className="items-center gap-1">
                  <Text className="text-lg font-semibold text-white">
                    Waiting for {currentPlayer?.participant_name ?? "the next player"}
                  </Text>
                  <Text className="text-sm text-white/50">Pick #{draft.current_pick_number}</Text>
                  {currentPlayer?.is_ai && (
                    <Text className="mt-1 text-center text-xs text-white/40">
                      AI players make their picks from the host's web browser for now.
                    </Text>
                  )}
                </View>
              )}
            </Card>

            <View className="flex-row overflow-hidden rounded-full border border-white/20">
              {(["board", "rosters"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  className={`flex-1 items-center py-3 ${view === v ? "bg-brand" : "bg-card"}`}
                >
                  <Text className="text-sm font-medium text-white">{v === "board" ? "Board" : "Rosters"}</Text>
                </Pressable>
              ))}
            </View>

            {view === "board" ? (
              <DraftBoard board={board} canPick={myTurn} onPickCategory={setPickCategory} />
            ) : (
              <RosterList board={board} />
            )}
          </>
        )}

        {/* Status */}
        {!live && (
        <Card>
          {draft.is_complete ? (
            <View className="items-center gap-1">
              <Text className="text-lg font-semibold text-white">Draft complete</Text>
              <Text className="mb-2 text-sm text-white/50">All picks have been made!</Text>
              <Button label="View final scores" onPress={() => router.replace(`/final-scores/${draft.id}`)} />
            </View>
          ) : isHost ? (
            <View className="gap-4">
              <View className="items-center gap-1">
                <Text className="text-xl font-medium text-white">Everybody ready?</Text>
                <Text className="text-center text-sm text-white/60">
                  {joinedCount} {joinedCount === 1 ? "player has" : "players have"} joined. Starting
                  randomizes turn order.
                </Text>
              </View>
              {participants.length < 2 && (
                <Text className="text-center text-sm text-white/40">
                  You need at least 2 players to start.
                </Text>
              )}
              <Button
                label={starting ? "Starting…" : "Start draft"}
                variant="brand"
                onPress={start}
                disabled={participants.length < 2}
                loading={starting}
              />
              {error && <Text className="text-center text-sm text-red-400">{error}</Text>}
            </View>
          ) : (
            <View className="items-center gap-1">
              <Text className="text-lg font-semibold text-white">Waiting on the host to start</Text>
              <Text className="text-center text-sm text-white/50">
                The host will begin the draft when everyone's ready.
              </Text>
            </View>
          )}
        </Card>
        )}

        {draft.is_complete && <VotingPanel draftId={draft.id} />}

        {/* Join code */}
        {!!draft.invite_code && !draft.is_complete && !hasStarted && (
          <Card>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-medium text-white">Join code</Text>
                <Text className="mt-1 text-2xl font-semibold tracking-widest text-white">
                  {draft.invite_code}
                </Text>
              </View>
              <View className="w-28">
                <Button label="Share" variant="outline" onPress={shareCode} />
              </View>
            </View>
          </Card>
        )}

        {/* Players */}
        {!live && (
        <View className="gap-3">
          <Text className="text-xl font-bold tracking-wider text-white">
            PLAYERS ({participants.length})
          </Text>
          {participants.map((p) => (
            <ParticipantRow key={p.id} p={p} now={room.now} />
          ))}
        </View>
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
