import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import type { ScoredPick } from "../../hooks/useFinalScores";
import { categoryLabel } from "../../lib/draftBoard";
import { colors } from "../../lib/theme";
import { CategoryChip, GlowCard, Text } from "../ui";

function RoundDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center justify-center" style={{ gap: 8, height: 16 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.accent }} />
      <Text className="text-xs leading-4 text-purple-300" style={{ letterSpacing: 0.72 }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.accent }} />
    </View>
  );
}

// Port of the website's FinalScoresPickOrder: picks grouped by round, one row per pick.
export function FinalScoresPickOrder({ picks, enriching }: { picks: ScoredPick[]; enriching?: boolean }) {
  const sorted = useMemo(() => [...picks].sort((a, b) => a.pick_order - b.pick_order), [picks]);
  const rounds = useMemo(() => {
    if (sorted.length === 0) return [];
    const size = Math.max(1, new Set(sorted.map((p) => String(p.player_id ?? p.player_name))).size);
    const out: ScoredPick[][] = [];
    for (let i = 0; i < sorted.length; i += size) out.push(sorted.slice(i, i + size));
    return out;
  }, [sorted]);

  if (sorted.length === 0) {
    return <Text className="py-6 text-center text-sm text-greyscale-blue-300">No picks to show.</Text>;
  }

  return (
    <GlowCard gap={16} padding={16}>
      <Text className="text-center font-brockmann-bold text-xl leading-7" style={{ letterSpacing: 0.96 }}>
        PICK ORDER
      </Text>
      {rounds.map((round, i) => (
        <View key={i} style={{ gap: 18 }}>
          <RoundDivider label={`ROUND ${i + 1}`} />
          <View style={{ gap: 2 }}>
            {round.map((pick) => {
              const score = pick.score != null ? pick.score.toFixed(2) : null;
              return (
                <View key={pick.id} className="bg-card" style={{ padding: 16, gap: 12 }}>
                  <View className="flex-row flex-wrap items-center" style={{ columnGap: 8, rowGap: 6 }}>
                    <View style={{ minWidth: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
                      <Text style={{ fontSize: 16, lineHeight: 18 }}>{pick.pick_order}</Text>
                    </View>
                    <Text className="font-brockmann-medium text-sm leading-5">
                      <Text className="font-brockmann-bold text-sm">{pick.player_name}</Text> picks in
                    </Text>
                    <CategoryChip label={categoryLabel(pick.category)} />
                  </View>
                  <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                    <Text className="flex-1 font-brockmann-semibold text-lg leading-6" style={{ letterSpacing: 0.48 }}>
                      {pick.movie_title}
                    </Text>
                    {enriching && score === null ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <Text className="font-brockmann-semibold text-xl leading-7 text-purple-300" style={{ letterSpacing: 0.48 }}>
                        {score ?? "—"}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </GlowCard>
  );
}
