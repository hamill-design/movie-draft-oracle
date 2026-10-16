import { Pressable, View } from "react-native";
import { format } from "date-fns";
import { Calendar, Trash2, Trophy, User, Users } from "lucide-react-native";
import type { LeagueDraftEntry } from "../../hooks/useLeagues";
import { placementOrdinalLabel } from "../../lib/leagueDraftMetrics";
import { colors } from "../../lib/theme";
import { DraftActorPortrait } from "../ActorPortrait";
import { Image } from "expo-image";
import { Button, StatusPill, Text } from "../ui";

type SpecInfo = { name: string; photo_url: string | null } | undefined;

const cleanActor = (s: string) => (s.includes("|") ? s.split("|")[0] : s);

function themeTitle(entry: LeagueDraftEntry, spec: SpecInfo): string {
  const opt = entry.draft?.option ?? "";
  const theme = entry.draft?.theme ?? "";
  if (theme === "spec-draft") return spec?.name || opt || entry.draft?.title || "Draft";
  if (theme === "people") return cleanActor(opt) || entry.draft?.title || "Draft";
  if (theme === "year") return opt || entry.draft?.title || "Draft";
  return entry.draft?.title || opt || "Draft";
}

export type LeagueDraftCardProps = {
  entry: LeagueDraftEntry;
  headline?: string;
  specInfo?: SpecInfo;
  participantCount: number;
  categoriesCount: number;
  displayDate: Date | null;
  isScheduled: boolean;
  isComplete: boolean;
  isMultiplayer: boolean;
  onView: () => void;
  placementRank?: number | null;
  leaguePointsEarned?: number | null;
  viewLabel: string;
  canEditSchedule?: boolean;
  viewDisabled?: boolean;
  onDetails?: () => void;
  onDelete?: () => void;
};

// Port of the website's LeagueDraftCard.
export function LeagueDraftCard({
  entry,
  headline,
  specInfo,
  participantCount,
  categoriesCount,
  displayDate,
  isScheduled,
  isComplete,
  isMultiplayer,
  onView,
  placementRank,
  leaguePointsEarned,
  viewLabel,
  canEditSchedule = true,
  viewDisabled = false,
  onDetails,
  onDelete,
}: LeagueDraftCardProps) {
  const theme = entry.draft?.theme ?? "";
  const scheduleType = entry.draft_type;
  const hasLinkedDraft = !!entry.draft;
  const showSpecPortrait = theme === "spec-draft" || (!hasLinkedDraft && scheduleType === "spec-draft");
  const showActorPortrait =
    theme === "people" || (!hasLinkedDraft && (scheduleType === "filmography" || scheduleType === "people"));
  const showYearPlaceholder = theme === "year" || (!hasLinkedDraft && scheduleType === "year");
  const actorName = cleanActor(entry.draft?.option ?? entry.theme ?? "");
  const title = headline ?? themeTitle(entry, specInfo);

  // Placement only means something once the draft is finished.
  const showPlacement = !isScheduled && isComplete && placementRank != null && placementRank > 0;
  const showPoints = showPlacement && leaguePointsEarned != null && leaguePointsEarned > 0;
  const showPrimary = !isScheduled || canEditSchedule || !!onDetails;

  const portraitBox = (child: React.ReactNode) => (
    <View style={{ width: 56, height: 56, borderRadius: 4, overflow: "hidden", backgroundColor: "#2C2B2D", alignItems: "center", justifyContent: "center" }}>
      {child}
    </View>
  );

  let portrait: React.ReactNode;
  if (showSpecPortrait) {
    portrait = portraitBox(
      specInfo?.photo_url ? (
        <Image source={{ uri: specInfo.photo_url }} style={{ width: 56, height: 56 }} contentFit="cover" />
      ) : (
        <User size={24} color={colors.textGrey} />
      ),
    );
  } else if (showActorPortrait) {
    portrait = <DraftActorPortrait actorName={actorName} px={56} square />;
  } else {
    portrait = portraitBox(
      showYearPlaceholder ? <Calendar size={24} color={colors.textGrey} /> : <User size={24} color={colors.textGrey} />,
    );
  }

  const metaItem = (icon: React.ReactNode, text: string) => (
    <View className="flex-row items-center gap-1">
      {icon}
      <Text className="font-brockmann-medium text-sm leading-5 text-greyscale-blue-300">{text}</Text>
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: colors.uiPrimary,
        borderRadius: 8,
        padding: 24,
        gap: 16,
        borderWidth: 1,
        borderColor: colors.itemStroke,
      }}
    >
      <View className="flex-row items-start gap-3">
        {portrait}
        <View className="flex-1 gap-2">
          <Text className="font-brockmann-semibold text-lg leading-6">{title}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {isMultiplayer ? (
              <StatusPill label="Multiplayer" bg="#00291E" border="#B2FFEA" color="#B2FFEA" />
            ) : (
              <StatusPill label="Local" bg="#25015E" border="#EDEBFF" color="#EDEBFF" />
            )}
            {isComplete && <StatusPill label="Complete" bg="#0AFFBE" color="#1D1D1F" />}
            {!isComplete && !isScheduled && (
              <StatusPill label="In progress" bg="rgba(245,158,11,0.2)" border="rgba(245,158,11,0.4)" color="#FDE68A" />
            )}
            {isScheduled && <StatusPill label="Scheduled" bg="rgba(104,10,255,0.1)" border="rgba(104,10,255,0.4)" color="#BCB2FF" />}
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-4">
        {displayDate && metaItem(<Calendar size={16} color={colors.textGrey} />, displayDate.toLocaleDateString())}
        {isScheduled && entry.scheduled_at && (
          <Text className="font-brockmann-medium text-sm leading-5 text-greyscale-blue-300">
            {format(new Date(entry.scheduled_at), "h:mm a")}
          </Text>
        )}
        {metaItem(<Users size={16} color={colors.textGrey} />, `${participantCount} ${participantCount === 1 ? "player" : "players"}`)}
        {metaItem(<Trophy size={16} color={colors.textGrey} />, `${categoriesCount} ${categoriesCount === 1 ? "category" : "categories"}`)}
      </View>

      {isScheduled && entry.categories?.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {entry.categories.map((cat) => (
            <View key={cat} className="rounded-full px-2 py-0.5" style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Text className="text-[10px] text-greyscale-blue-300">{cat}</Text>
            </View>
          ))}
        </View>
      )}
      {isScheduled && !!entry.notes && <Text className="text-xs italic text-greyscale-blue-500">{entry.notes}</Text>}

      {showPlacement && placementRank != null && (
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: placementRank === 1 ? "#FFD60A" : "#907AFF",
                borderWidth: placementRank === 1 ? 2 : 0,
                borderColor: "#FFF2B2",
              }}
            >
              <Text className="font-brockmann-bold text-base" style={{ color: placementRank === 1 ? "#1D1D1F" : "#0E0F0F" }}>
                {placementRank}
              </Text>
            </View>
            <Text className="font-brockmann-semibold text-base leading-6">{placementOrdinalLabel(placementRank)}</Text>
          </View>
          {showPoints && (
            <Text className="font-brockmann-bold" style={{ fontSize: 32, lineHeight: 36 }}>
              +{leaguePointsEarned}
            </Text>
          )}
        </View>
      )}

      {showPrimary && (
        <Button
          label={isScheduled && !canEditSchedule ? "View Details" : viewLabel}
          variant="brand"
          small
          disabled={viewDisabled}
          onPress={isScheduled && !canEditSchedule && onDetails ? onDetails : onView}
        />
      )}
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} className="flex-row items-center gap-1.5 self-end" accessibilityLabel="Delete from league history">
          <Trash2 size={13} color="#828786" />
          <Text className="text-xs text-greyscale-blue-500">Remove from league</Text>
        </Pressable>
      )}
    </View>
  );
}
