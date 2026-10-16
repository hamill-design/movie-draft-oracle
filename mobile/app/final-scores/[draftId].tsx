import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useFinalScores, type ScoredPick, type TeamScore } from "../../hooks/useFinalScores";
import { categoryLabel, posterUrl } from "../../lib/draftBoard";
import { Button, Centered, ScreenHeader } from "../../components/ui";

const RANK_COLORS = ["#FFD60A", "#CCCCCC", "#DE7E3E"];

function PickRow({ pick, showPlayer }: { pick: ScoredPick; showPlayer?: boolean }) {
  const uri = posterUrl(pick.poster_path, "w92");
  return (
    <View className="flex-row items-center gap-3 border-t border-white/10 py-2">
      {uri ? (
        <Image source={{ uri }} style={{ width: 36, height: 54, borderRadius: 3 }} />
      ) : (
        <View style={{ width: 36, height: 54 }} className="rounded-sm bg-white/10" />
      )}
      <View className="flex-1">
        <Text className="text-[11px] uppercase text-white/40">
          {showPlayer ? `${pick.player_name} · ` : ""}
          {categoryLabel(pick.category)}
        </Text>
        <Text numberOfLines={2} className="text-sm font-medium text-white">
          {pick.movie_title}
          {pick.movie_year ? ` (${pick.movie_year})` : ""}
        </Text>
      </View>
      <Text className={`text-base font-bold ${pick.score != null ? "text-accent" : "text-white/30"}`}>
        {pick.score != null ? pick.score.toFixed(1) : "–"}
      </Text>
    </View>
  );
}

function TeamCard({
  team,
  rank,
  isYou,
  open,
  onToggle,
  hasVotes,
}: {
  team: TeamScore;
  rank: number;
  isYou: boolean;
  open: boolean;
  onToggle: () => void;
  hasVotes: boolean;
}) {
  const shown = hasVotes ? team.combinedScore : team.averageScore;
  return (
    <Pressable
      onPress={onToggle}
      className={`rounded-lg p-4 ${isYou ? "border-2 border-accent bg-[#160038]" : "border border-white/15 bg-card"}`}
    >
      <View className="flex-row items-center gap-4">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: RANK_COLORS[rank - 1] ?? "#907AFF" }}
        >
          <Text className="text-base font-bold text-[#1D1D1F]">{rank}</Text>
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-white">
            {team.playerName}
            {isYou ? "  (you)" : ""}
          </Text>
          <Text className="text-sm text-white/50">
            {team.scoredPicks}/{team.totalPicks} movies scored
            {hasVotes ? ` · ${team.voteCount} ${team.voteCount === 1 ? "vote" : "votes"}` : ""}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-3xl font-bold text-accent">{shown.toFixed(1)}</Text>
          {hasVotes && (
            <Text className="text-[11px] text-white/40">
              {team.averageScore.toFixed(1)} + {team.votePoints.toFixed(1)} votes
            </Text>
          )}
        </View>
      </View>
      {open && (
        <View className="mt-3">
          {[...team.picks]
            .sort((a, b) => a.pick_order - b.pick_order)
            .map((p) => (
              <PickRow key={p.id} pick={p} />
            ))}
        </View>
      )}
    </Pressable>
  );
}

export default function FinalScores() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { draft, picks, participants, teams, loading, error, enriching, hasVotes } = useFinalScores(draftId);
  const [tab, setTab] = useState<"leaderboard" | "picks">("leaderboard");
  const [openTeam, setOpenTeam] = useState<string | null>(null);

  if (loading) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="Final scores" />
        <Centered>
          <ActivityIndicator color="#7142FF" />
        </Centered>
      </View>
    );
  }
  if (error || !draft) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="Final scores" />
        <Centered>
          <Text className="text-center text-base text-white/60">{error ?? "Draft not found."}</Text>
        </Centered>
      </View>
    );
  }

  const title = draft.title?.trim() || "Final scores";
  const myName = participants.find((p) => p.user_id === user?.id)?.participant_name;

  const share = () => {
    const lines = teams.map(
      (t, i) => `${i + 1}. ${t.playerName} — ${(hasVotes ? t.combinedScore : t.averageScore).toFixed(1)}`,
    );
    Share.share({ message: `${title} — final scores on Movie Drafter\n\n${lines.join("\n")}` });
  };

  return (
    <View className="flex-1 bg-ink">
      <ScreenHeader title={title} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <View>
          <Text className="text-3xl font-bold text-white">FINAL SCORES</Text>
          {!!draft.optionLabel && <Text className="mt-1 text-base text-white/60">{draft.optionLabel}</Text>}
        </View>

        {enriching && (
          <View className="flex-row items-center gap-2 rounded-lg bg-surface px-4 py-3">
            <ActivityIndicator color="#7142FF" />
            <Text className="flex-1 text-sm text-white/60">Fetching ratings — scores will update as they arrive…</Text>
          </View>
        )}

        <View className="flex-row overflow-hidden rounded-full border border-white/20">
          {(
            [
              ["leaderboard", "Leaderboard"],
              ["picks", "Pick order"],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className={`flex-1 items-center py-3 ${tab === key ? "bg-brand" : "bg-card"}`}
            >
              <Text className="text-sm font-medium text-white">{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "leaderboard" ? (
          <View className="gap-3">
            {teams.map((t, i) => (
              <TeamCard
                key={t.playerName}
                team={t}
                rank={i + 1}
                isYou={t.playerName === myName}
                open={openTeam === t.playerName}
                onToggle={() => setOpenTeam((cur) => (cur === t.playerName ? null : t.playerName))}
                hasVotes={hasVotes}
              />
            ))}
            {teams.length === 0 && <Text className="py-10 text-center text-sm text-white/50">No picks yet.</Text>}
          </View>
        ) : (
          <View className="rounded-lg bg-surface px-4 pb-2 pt-1">
            {picks.map((p) => (
              <PickRow key={p.id} pick={p} showPlayer />
            ))}
          </View>
        )}

        <Button label="Share results" variant="outline" onPress={share} />
      </ScrollView>
    </View>
  );
}
