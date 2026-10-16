import { Image, ScrollView, Text, Pressable, View } from "react-native";
import { categoryLabel, posterUrl, type DraftBoard as Board } from "../lib/draftBoard";

const NAME_W = 92;
const CELL_W = 88;
const CELL_H = 132;

// The draft grid: one row per player (in turn order), one column per category.
// On your turn, your own empty cells light up — tap one to pick for that category.
export function DraftBoard({
  board,
  canPick,
  onPickCategory,
}: {
  board: Board;
  canPick: boolean;
  onPickCategory: (category: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* Category headers */}
        <View className="flex-row">
          <View style={{ width: NAME_W }} />
          {board.categories.map((c) => (
            <View key={c} style={{ width: CELL_W }} className="px-1 pb-2">
              <Text numberOfLines={2} className="text-center text-[11px] font-semibold uppercase text-white/50">
                {categoryLabel(c)}
              </Text>
            </View>
          ))}
        </View>

        {board.rows.map((row, r) => {
          const isCurrent = r === board.currentRowIndex;
          const isMine = r === board.myRowIndex;
          return (
            <View key={row.key} className="mb-2 flex-row">
              <View style={{ width: NAME_W }} className="justify-center pr-2">
                <Text numberOfLines={2} className={`text-sm font-semibold ${isCurrent ? "text-gold" : "text-white"}`}>
                  {row.participant.participant_name}
                </Text>
                {isMine && <Text className="text-[10px] text-accent">You</Text>}
                {isCurrent && <Text className="text-[10px] text-gold">On the clock</Text>}
              </View>
              {board.categories.map((c) => {
                const pick = board.cells.get(`${r}|${c}`);
                const uri = posterUrl(pick?.poster_path, "w185");
                const open = !pick && isMine && canPick;
                return (
                  <Pressable
                    key={c}
                    disabled={!open}
                    onPress={() => onPickCategory(c)}
                    style={{ width: CELL_W - 6, height: CELL_H, marginRight: 6 }}
                    className={`overflow-hidden rounded-md ${
                      open
                        ? "items-center justify-center border-2 border-dashed border-gold bg-[#2B2510] active:opacity-80"
                        : pick
                          ? "bg-card"
                          : "border border-white/10 bg-surface"
                    }`}
                  >
                    {pick ? (
                      <>
                        {uri ? (
                          <Image source={{ uri }} style={{ width: "100%", height: 100 }} resizeMode="cover" />
                        ) : (
                          <View style={{ height: 100 }} className="bg-white/10" />
                        )}
                        <Text numberOfLines={2} className="px-1 pt-1 text-[10px] leading-3 text-white">
                          {pick.movie_title}
                        </Text>
                      </>
                    ) : open ? (
                      <Text className="text-center text-sm font-semibold text-gold">+ Pick</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// Simple per-player list — easier to read than the grid on a small screen.
export function RosterList({ board }: { board: Board }) {
  return (
    <View className="gap-3">
      {board.rows.map((row, r) => (
        <View key={row.key} className="rounded-lg bg-surface p-4">
          <Text className="mb-2 text-base font-semibold text-white">
            {row.participant.participant_name}
            {r === board.myRowIndex ? "  (you)" : ""}
          </Text>
          {board.categories.map((c) => {
            const pick = board.cells.get(`${r}|${c}`);
            const uri = posterUrl(pick?.poster_path, "w92");
            return (
              <View key={c} className="flex-row items-center gap-3 border-t border-white/10 py-2">
                {uri ? (
                  <Image source={{ uri }} style={{ width: 28, height: 42, borderRadius: 2 }} />
                ) : (
                  <View style={{ width: 28, height: 42 }} className="rounded-sm bg-white/10" />
                )}
                <View className="flex-1">
                  <Text className="text-[11px] uppercase text-white/40">{categoryLabel(c)}</Text>
                  <Text numberOfLines={1} className={`text-sm ${pick ? "text-white" : "text-white/30"}`}>
                    {pick ? `${pick.movie_title}${pick.movie_year ? ` (${pick.movie_year})` : ""}` : "Not picked yet"}
                  </Text>
                </View>
                {pick?.calculated_score != null && (
                  <Text className="text-sm font-semibold text-accent">{Number(pick.calculated_score).toFixed(1)}</Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
