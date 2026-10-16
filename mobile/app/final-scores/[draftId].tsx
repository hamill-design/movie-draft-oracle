import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useFinalScores, type TeamScore } from "../../hooks/useFinalScores";
import type { DraftParticipant, DraftRoom } from "../../hooks/useDraftRoom";
import { buildBoard } from "../../lib/draftBoard";
import { colors } from "../../lib/theme";
import { ShareIcon } from "../../components/icons";
import { DraftBoardTable } from "../../components/DraftBoard";
import { FinalScoresPickOrder } from "../../components/final/FinalScoresPickOrder";
import { MovieScoreCard } from "../../components/final/MovieScoreCard";
import { AppHeader, Button, GlowCard, PageHero, PillTabs, RankBadge, SectionTitle, Text } from "../../components/ui";

type DetailTab = "roster" | "board" | "picks";
const TABS = [
  { key: "roster", label: "Roster" },
  { key: "board", label: "Draft Board" },
  { key: "picks", label: "Pick Order" },
] as const;

function LeaderRow({
  team,
  rank,
  selected,
  hasVotes,
  enriching,
  onPress,
}: {
  team: TeamScore;
  rank: number;
  selected: boolean;
  hasVotes: boolean;
  enriching: boolean;
  onPress: () => void;
}) {
  const topPick = [...team.picks].filter((p) => p.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const shown = hasVotes ? team.combinedScore : team.averageScore;
  const sub = topPick ? `Top Movie: ${topPick.movie_title}` : `${team.scoredPicks}/${team.totalPicks} movies scored`;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-card"
      style={{
        gap: 16,
        paddingVertical: 16,
        paddingLeft: 16,
        paddingRight: 24,
        backgroundColor: selected ? colors.brand : colors.uiPrimary,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.itemStroke,
      }}
    >
      <RankBadge rank={rank} />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-brockmann-semibold text-base leading-6" style={{ letterSpacing: 0.32 }}>
          {team.playerName}
        </Text>
        <Text numberOfLines={1} className="text-sm leading-5" style={{ color: selected ? colors.textPrimary : "#BDC3C2" }}>
          {sub}
        </Text>
      </View>
      <View className="items-end">
        {enriching && team.scoredPicks < team.totalPicks && shown === 0 ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Text className="font-brockmann-bold" style={{ fontSize: 32, lineHeight: 36, letterSpacing: 1.28, color: selected ? colors.textPrimary : colors.accent }}>
            {shown.toFixed(2)}
          </Text>
        )}
        {hasVotes && team.votePoints > 0 && <Text className="text-xs text-greyscale-blue-300">+{team.votePoints.toFixed(1)} vote</Text>}
      </View>
    </Pressable>
  );
}

export default function FinalScores() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { draft, picks, participants, teams, loading, error, enriching, hasVotes } = useFinalScores(draftId);
  const [tab, setTab] = useState<DetailTab>("roster");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Leaderboard order can change as ratings arrive; default to the winner until someone is picked.
  useEffect(() => {
    if (!selectedTeam && teams.length > 0) setSelectedTeam(teams[0].playerName);
  }, [teams, selectedTeam]);

  const board = useMemo(() => {
    if (!draft) return null;
    const room = { ...draft, categories: draft.categories ?? [] } as unknown as DraftRoom;
    const parts = participants.map((p: any) => ({ ...p, status: "joined", is_host: false })) as unknown as DraftParticipant[];
    return buildBoard(room, parts, picks as any, user?.id);
  }, [draft, participants, picks, user?.id]);

  if (loading) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </View>
    );
  }
  if (error || !draft || !board) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-base text-greyscale-blue-300">{error ?? "Draft not found."}</Text>
        </View>
      </View>
    );
  }

  const heroTitle = (draft.optionLabel || draft.title || "").toString();
  const heroSize = heroTitle.length <= 10 ? 40 : heroTitle.length <= 18 ? 34 : 28;
  const selected = teams.find((t) => t.playerName === selectedTeam) ?? null;

  const share = () => {
    const lines = teams.map((t, i) => `${i + 1}. ${t.playerName} — ${(hasVotes ? t.combinedScore : t.averageScore).toFixed(2)}`);
    Share.share({ message: `${heroTitle} Draft — final scores on Movie Drafter\n\n${lines.join("\n")}` });
  };

  return (
    <View className="flex-1">
      <AppHeader backHref="/leagues" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 24 }}>
        <PageHero label="FINAL SCORES" title={heroTitle} suffix="DRAFT" size={heroSize} />

        <Button
          label="Share Results"
          variant="outline"
          icon={<ShareIcon size={24} color={colors.textPrimary} />}
          onPress={share}
        />

        {enriching && (
          <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
            <ActivityIndicator color={colors.brand} />
            <Text className="text-sm text-greyscale-blue-300">Fetching ratings — scores update as they arrive…</Text>
          </View>
        )}

        {/* Leaderboard */}
        <GlowCard gap={24}>
          <SectionTitle center>Final Scores</SectionTitle>
          <View style={{ gap: 16 }}>
            {teams.map((t, i) => (
              <LeaderRow
                key={t.playerName}
                team={t}
                rank={i + 1}
                selected={t.playerName === selectedTeam}
                hasVotes={hasVotes}
                enriching={enriching}
                onPress={() => {
                  setSelectedTeam(t.playerName);
                  setTab("roster");
                }}
              />
            ))}
            {teams.length === 0 && <Text className="py-6 text-center text-sm text-greyscale-blue-300">No picks yet.</Text>}
          </View>
        </GlowCard>

        <PillTabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === "roster" &&
          (selected ? (
            <View style={{ gap: 16 }}>
              {[...selected.picks]
                .sort((a, b) => a.pick_order - b.pick_order)
                .map((p) => (
                  <MovieScoreCard
                    key={p.id}
                    title={p.movie_title}
                    year={p.movie_year}
                    genre={(p as any).movie_genre}
                    posterPath={p.poster_path}
                    pickNumber={p.pick_order}
                    category={p.category}
                    scoringData={{
                      budget: p.movie_budget,
                      revenue: p.movie_revenue,
                      rtCriticsScore: p.rt_critics_score,
                      rtAudienceScore: p.rt_audience_score,
                      metacriticScore: p.metacritic_score,
                      imdbRating: p.imdb_rating,
                      oscarStatus: p.oscar_status,
                    }}
                  />
                ))}
            </View>
          ) : (
            <Text className="py-6 text-center text-sm text-greyscale-blue-300">Select a player from the leaderboard to view their roster.</Text>
          ))}

        {tab === "board" && <DraftBoardTable board={board} showScores scoreOf={(p) => p.score ?? null} />}
        {tab === "picks" && <FinalScoresPickOrder picks={picks} enriching={enriching} />}
      </ScrollView>
    </View>
  );
}
