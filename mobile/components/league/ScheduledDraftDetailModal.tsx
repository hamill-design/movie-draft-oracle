import { Modal, Pressable, View } from "react-native";
import { format } from "date-fns";
import { Calendar, Monitor, Settings, Trophy, Wifi, X } from "lucide-react-native";
import type { LeagueDraftEntry } from "../../hooks/useLeagues";
import { colors } from "../../lib/theme";
import { Button, Text } from "../ui";

const TYPE_LABEL: Record<string, string> = {
  filmography: "By Filmography",
  people: "By Filmmaker",
  year: "By Year",
  "spec-draft": "Special Draft",
  classic: "Classic Draft",
};

function headline(entry: LeagueDraftEntry, specName?: string): string {
  const t = entry.draft_type;
  const theme = entry.theme ?? "";
  if (t === "spec-draft") return specName ?? (theme.trim() || "Special Draft");
  if (t === "filmography" || t === "people") return (theme.includes("|") ? theme.split("|")[0] : theme) || "Draft";
  return theme.trim() || "Draft";
}

// Port of the website's ScheduledDraftDetailModal (opens for drafts more than an hour away).
export function ScheduledDraftDetailModal({
  entry,
  specName,
  isAdmin,
  open,
  onClose,
  onEditSettings,
}: {
  entry: LeagueDraftEntry | null;
  specName?: string;
  isAdmin: boolean;
  open: boolean;
  onClose: () => void;
  onEditSettings: () => void;
}) {
  if (!entry) return null;
  const date = entry.scheduled_at ? new Date(entry.scheduled_at) : null;
  const typeLabel = TYPE_LABEL[entry.draft_type ?? ""] ?? entry.draft_type ?? "Draft";
  const mp = entry.is_multiplayer;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: colors.sectionContainer, borderRadius: 8, boxShadow: "0px 0px 24px rgba(59,3,148,0.6)", maxWidth: 520, width: "100%", alignSelf: "center" }}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ position: "absolute", right: 16, top: 16, zIndex: 2 }} accessibilityLabel="Close">
            <X size={16} color="#9CA3A2" />
          </Pressable>

          <View style={{ padding: 24, gap: 4 }}>
            <View className="mb-3 flex-row items-center gap-2">
              <View
                className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: mp ? "rgba(20,84,96,0.6)" : "rgba(88,40,120,0.6)",
                  borderWidth: 0.5,
                  borderColor: mp ? "#B2FFEA" : "#EDEBFF",
                }}
              >
                {mp ? <Wifi size={10} color="#B2FFEA" /> : <Monitor size={10} color="#EDEBFF" />}
                <Text className="font-brockmann-semibold text-[10px]" style={{ color: mp ? "#B2FFEA" : "#EDEBFF" }}>
                  {mp ? "Multiplayer" : "Local"}
                </Text>
              </View>
              <Text className="font-brockmann-medium text-[10px] text-greyscale-blue-400">{typeLabel}</Text>
            </View>
            <Text className="font-brockmann-bold text-xl leading-7">{headline(entry, specName)}</Text>
            {date && (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Calendar size={13} color={colors.accent} />
                <Text className="text-sm text-purple-300">{format(date, "EEEE, MMMM d 'at' h:mm a")}</Text>
              </View>
            )}
          </View>

          <View className="h-px bg-white/10" />

          <View style={{ padding: 24, gap: 20 }}>
            {entry.categories?.length > 0 && (
              <View className="gap-2">
                <View className="flex-row items-center gap-1.5">
                  <Trophy size={12} color="#9CA3A2" />
                  <Text className="font-brockmann-semibold text-xs uppercase text-greyscale-blue-400" style={{ letterSpacing: 1.5 }}>
                    Categories
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {entry.categories.map((cat) => (
                    <View key={cat} className="rounded-full px-2.5 py-1" style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <Text className="text-xs text-greyscale-blue-200">{cat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {!!entry.notes && (
              <View className="gap-2">
                <Text className="font-brockmann-semibold text-xs uppercase text-greyscale-blue-400" style={{ letterSpacing: 1.5 }}>
                  Notes
                </Text>
                <Text className="text-sm italic text-greyscale-blue-300">{entry.notes}</Text>
              </View>
            )}
            {!(entry.categories?.length > 0) && !entry.notes && (
              <Text className="text-sm text-greyscale-blue-500">No additional details.</Text>
            )}
          </View>

          <View className="h-px bg-white/10" />

          <View className="flex-row items-center justify-between px-6 py-4">
            {isAdmin ? (
              <Pressable onPress={onEditSettings} className="flex-row items-center gap-1.5">
                <Settings size={14} color="#9CA3A2" />
                <Text className="font-brockmann-medium text-sm text-greyscale-blue-400">Edit in Settings</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Button label="Close" variant="outline" small inline onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
