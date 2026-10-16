import { View } from "react-native";
import { Image } from "expo-image";
import { calculateDetailedScore, type MovieScoringData } from "../../lib/scoreCalculator";
import { categoryLabel } from "../../lib/draftBoard";
import { colors } from "../../lib/theme";
import { DollarIcon, FilmReelIcon, RibbonIcon, StarIcon, TrophyIcon } from "../icons";
import { CategoryChip, GlowCard, Text } from "../ui";

const TMDB = "https://image.tmdb.org/t/p/w185";

const OSCAR: Record<string, { label: string; bg: string; fg: string }> = {
  winner: { label: "Winner", bg: "#FFD60A", fg: "#1D1D1F" },
  nominee: { label: "Nominee", bg: "#FFF2B2", fg: "#1D1D1F" },
  none: { label: "None", bg: "#D9E0DF", fg: "#2B2F31" },
  unknown: { label: "Unknown", bg: "#D9E0DF", fg: "#1D1D1F" },
};

export function OscarStatusChip({ status }: { status?: string | null }) {
  const cfg = OSCAR[status ?? "none"] ?? OSCAR.none;
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
      <Text className="font-brockmann-semibold text-xs leading-4" style={{ color: cfg.fg }}>
        {cfg.label}
      </Text>
    </View>
  );
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function Metric({ icon, label, value, pct, extra }: { icon: React.ReactNode; label: string; value: string; pct: number; extra?: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {icon}
          <Text className="text-xs leading-4">{label}</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Text className="font-brockmann-semibold text-xs leading-4">{value}</Text>
          {extra}
        </View>
      </View>
      <View style={{ height: 8, borderRadius: 9999, backgroundColor: "#2C2B2D", overflow: "hidden" }}>
        <View style={{ height: 8, width: `${Math.max(0, Math.min(pct, 100))}%`, backgroundColor: colors.brand }} />
      </View>
    </View>
  );
}

// Port of the website's MovieScoreCard: poster, title, score, pick badge + category chip, score breakdown bars, box office data.
export function MovieScoreCard({
  title,
  year,
  genre,
  posterPath,
  pickNumber,
  category,
  scoringData,
}: {
  title: string;
  year?: number | null;
  genre?: string | null;
  posterPath?: string | null;
  pickNumber?: number;
  category?: string;
  scoringData: MovieScoringData;
}) {
  const b = calculateDetailedScore(scoringData);
  const has = (k: string) => b.availableComponents.includes(k);
  const grey = colors.textGrey;
  const posterUri = posterPath ? (posterPath.startsWith("/") ? `${TMDB}${posterPath}` : posterPath) : null;
  const sub = year && genre ? `${year} • ${genre}` : year ? String(year) : genre ?? "";

  return (
    <GlowCard>
      <View className="flex-row" style={{ gap: 12 }}>
        {posterUri && (
          <Image
            source={{ uri: posterUri }}
            style={{ width: 80, height: 119, borderRadius: 2, borderWidth: 0.5, borderColor: "#BCB2FF" }}
            contentFit="cover"
          />
        )}
        <View className="flex-1" style={{ gap: 12 }}>
          <Text className="text-right font-brockmann-bold text-purple-300" style={{ fontSize: 32, lineHeight: 36, letterSpacing: 1.28 }}>
            {b.finalScore.toFixed(2)}
          </Text>
          <View style={{ gap: 4 }}>
            <Text className="font-brockmann-semibold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: 0.48 }}>
              {title}
            </Text>
            {!!sub && <Text className="text-sm leading-5">{sub}</Text>}
          </View>
        </View>
      </View>

      <View style={{ gap: 16 }}>
        {pickNumber != null && !!category && (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16, lineHeight: 18 }}>{pickNumber}</Text>
            </View>
            <CategoryChip label={categoryLabel(category)} />
          </View>
        )}

        <View style={{ gap: 12 }}>
          <Text className="font-brockmann-semibold text-base leading-6" style={{ letterSpacing: 0.32 }}>
            Score Breakdown
          </Text>

          {has("Box Office") && (
            <Metric
              icon={<DollarIcon size={16} color={grey} />}
              label="Box Office Score"
              value={`${scoringData.revenue && scoringData.budget ? (((scoringData.revenue - scoringData.budget) / scoringData.revenue) * 100).toFixed(2) : 0}%`}
              pct={b.boxOfficeScore}
              extra={
                b.boxOfficeFlopPenalty != null ? (
                  <Text className="font-brockmann-semibold text-xs leading-4" style={{ color: "#E85D5D" }}>
                    −{b.boxOfficeFlopPenalty} pts
                  </Text>
                ) : undefined
              }
            />
          )}
          {has("RT Critics") && (
            <Metric icon={<RibbonIcon size={16} color={grey} />} label="RT Critics" value={`${scoringData.rtCriticsScore || 0}%`} pct={scoringData.rtCriticsScore || 0} />
          )}
          {has("Metacritic") && (
            <Metric icon={<StarIcon size={16} color={grey} />} label="Metacritic" value={`${scoringData.metacriticScore || 0}/100`} pct={scoringData.metacriticScore || 0} />
          )}
          {has("IMDB") && (
            <Metric icon={<FilmReelIcon size={16} color={grey} />} label="IMDB" value={`${Math.round((scoringData.imdbRating || 0) * 10)}%`} pct={((scoringData.imdbRating || 0) / 10) * 100} />
          )}

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TrophyIcon size={16} color={colors.gold} />
              <Text className="text-xs leading-4">Oscar Status</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="font-brockmann-semibold text-xs leading-4">+{b.oscarBonus} pts</Text>
              <OscarStatusChip status={scoringData.oscarStatus} />
            </View>
          </View>
        </View>

        {!!(scoringData.budget || scoringData.revenue) && (
          <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.itemStroke, gap: 8 }}>
            <Text className="font-brockmann-semibold text-base leading-6" style={{ letterSpacing: 0.32 }}>
              Box Office Data
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {!!scoringData.budget && (
                <View className="flex-row" style={{ gap: 8, minWidth: 150 }}>
                  <Text className="text-sm leading-5 text-greyscale-blue-300">Budget:</Text>
                  <Text className="font-brockmann-medium text-sm leading-5">{money(scoringData.budget)}</Text>
                </View>
              )}
              {!!scoringData.revenue && (
                <View className="flex-row" style={{ gap: 8, minWidth: 140 }}>
                  <Text className="text-sm leading-5 text-greyscale-blue-300">Revenue:</Text>
                  <Text className="font-brockmann-medium text-sm leading-5">{money(scoringData.revenue)}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </GlowCard>
  );
}
