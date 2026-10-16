import { Pressable, ScrollView, View } from "react-native";
import { categoryLabel, type DraftBoard as Board } from "../lib/draftBoard";
import { isParticipantOnline } from "../hooks/useDraftRoom";
import { colors } from "../lib/theme";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { CategoryChip, GlowCard, SectionTitle, Text } from "./ui";

const NAME_W = 120;
const COL_W = 150;

// Read-only board: the website's DraftBoard table (glow card, purple header, current player's row tinted).
export function DraftBoardTable({ board, showScores = false, scoreOf }: { board: Board; showScores?: boolean; scoreOf?: (pick: any) => number | null }) {
  return (
    <GlowCard gap={16} padding={16}>
      <SectionTitle center>Draft Board</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View className="flex-row" style={{ borderBottomWidth: 1, borderBottomColor: colors.accent }}>
            <View style={{ width: NAME_W, padding: 8 }}>
              <Text className="font-brockmann-medium text-sm text-purple-300">Player</Text>
            </View>
            {board.categories.map((c) => (
              <View key={c} style={{ width: COL_W, padding: 8 }}>
                <Text className="text-center font-brockmann-medium text-sm text-purple-300">{categoryLabel(c)}</Text>
              </View>
            ))}
          </View>
          {board.rows.map((row, r) => (
            <View
              key={row.key}
              className="flex-row"
              style={{ backgroundColor: r === board.currentRowIndex ? colors.purple800 : "transparent", borderBottomWidth: 1, borderBottomColor: "rgba(144,122,255,0.35)" }}
            >
              <View style={{ width: NAME_W, padding: 8, justifyContent: "center" }}>
                <Text numberOfLines={2} className="font-brockmann-medium text-sm">
                  {row.participant.participant_name}
                </Text>
              </View>
              {board.categories.map((c) => {
                const pick = board.cells.get(`${r}|${c}`);
                const score = showScores && pick ? (scoreOf ? scoreOf(pick) : (pick.calculated_score ?? null)) : null;
                return (
                  <View key={c} style={{ width: COL_W, padding: 8, minHeight: 56, alignItems: "center", justifyContent: "center" }}>
                    {pick ? (
                      <>
                        <Text numberOfLines={2} className="text-center text-sm leading-4">
                          {pick.movie_title}
                        </Text>
                        {score != null && (
                          <Text className="font-brockmann-semibold" style={{ fontSize: 13, lineHeight: 18, color: "#B794FF" }}>
                            {Number(score).toFixed(1)}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text className="text-sm text-greyscale-blue-500">-</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </GlowCard>
  );
}

// One person's slots at a time (phone-friendly version of the board's row), styled with the web cell states.
export function PlayerSlots({
  board,
  rowIndex,
  canPick,
  activeCategory,
  onPickCategory,
  onCancel,
}: {
  board: Board;
  rowIndex: number;
  canPick: boolean;
  activeCategory: string | null;
  onPickCategory: (category: string) => void;
  onCancel: () => void;
}) {
  const isCurrent = rowIndex === board.currentRowIndex;
  const isMine = rowIndex === board.myRowIndex;
  return (
    <View style={{ gap: 12 }}>
      {board.categories.map((c) => {
        const pick = board.cells.get(`${rowIndex}|${c}`);
        const open = !pick && isMine && isCurrent && canPick;
        const selecting = activeCategory === c;
        let body: React.ReactNode;
        let bg = "#1A1D29";
        if (pick) {
          bg = "transparent";
          body = (
            <Text numberOfLines={2} className="text-center text-sm leading-4">
              {pick.movie_title}
            </Text>
          );
        } else if (selecting) {
          bg = colors.purple800;
          body = <Text className="text-center text-sm text-purple-300">Cancel</Text>;
        } else if (open) {
          bg = colors.brand;
          body = <Text className="text-center font-brockmann-bold text-2xl leading-6">+</Text>;
        } else if (isCurrent) {
          bg = colors.purple800;
          body = null;
        }
        return (
          <View key={c} className="flex-row items-center" style={{ gap: 12 }}>
            <View style={{ width: 104 }}>
              <Text className="font-brockmann-medium text-sm text-purple-300">{categoryLabel(c)}</Text>
            </View>
            <Pressable
              disabled={!(open || selecting)}
              onPress={() => (selecting ? onCancel() : onPickCategory(c))}
              style={{ flex: 1, minHeight: 44, borderRadius: 4, backgroundColor: bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 8, borderWidth: pick ? 1 : 0, borderColor: colors.itemStroke }}
            >
              {body}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// Avatar rail: pick whose picks you're looking at. Ring = on the clock, dot = online.
export function PlayerRail({ board, selected, onSelect, now }: { board: Board; selected: number; onSelect: (i: number) => void; now: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 4 }}>
      {board.rows.map((row, i) => {
        const p = row.participant;
        const isSel = i === selected;
        return (
          <Pressable key={row.key} onPress={() => onSelect(i)} className="items-center" style={{ width: 64, opacity: isSel ? 1 : 0.6 }}>
            <ParticipantAvatar
              name={p.participant_name}
              avatarUrl={p.avatar_url}
              size={44}
              ring={i === board.currentRowIndex}
              online={isParticipantOnline(p, now)}
            />
            <Text numberOfLines={1} className={`mt-1 text-[11px] ${isSel ? "font-brockmann-semibold" : ""}`}>
              {i === board.myRowIndex ? "You" : p.participant_name}
            </Text>
            {isSel && <View style={{ height: 2, width: 24, backgroundColor: colors.brand, marginTop: 2 }} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Per-player list with category chips (phone-friendly roster view, in the website's card style).
export function RosterList({ board }: { board: Board }) {
  return (
    <View style={{ gap: 16 }}>
      {board.rows.map((row, r) => (
        <GlowCard key={row.key} gap={12} padding={16}>
          <Text className="font-brockmann-semibold text-lg">
            {row.participant.participant_name}
            {r === board.myRowIndex ? "  (you)" : ""}
          </Text>
          {board.categories.map((c) => {
            const pick = board.cells.get(`${r}|${c}`);
            return (
              <View key={c} className="gap-1.5 rounded bg-card p-3">
                <CategoryChip label={categoryLabel(c)} />
                <Text numberOfLines={2} className={`text-sm ${pick ? "font-brockmann-semibold" : "text-greyscale-blue-500"}`}>
                  {pick ? `${pick.movie_title}${pick.movie_year ? ` (${pick.movie_year})` : ""}` : "Not picked yet"}
                </Text>
              </View>
            );
          })}
        </GlowCard>
      ))}
    </View>
  );
}
