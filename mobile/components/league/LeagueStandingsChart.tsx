import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { LeagueDraftEntry, LeagueStanding } from "../../hooks/useLeagues";
import {
  draftLeaguePointsByUserId,
  type DraftParticipantRow,
  type LeagueDraftMetricPack,
} from "../../lib/leagueDraftMetrics";
import { Text } from "../ui";

// Cumulative league points per completed draft. Port of the website's
// LeagueStandingsChart (recharts) drawn with react-native-svg; tap a draft to see the points it awarded.

type Props = {
  standings: LeagueStanding[];
  completedDrafts: LeagueDraftEntry[];
  draftPickData: { metrics: Record<string, LeagueDraftMetricPack>; participants: DraftParticipantRow[] } | null;
  specDraftData: Map<string, { name: string; photo_url: string | null }>;
};

const DRAFT_TYPE_LABELS: Record<string, string> = {
  classic: "Classic",
  year: "By Year",
  people: "By Filmmaker",
  "spec-draft": "Special Draft",
  filmography: "By Filmography",
};

const BASE_COLORS = ["#7142FF", "#42FFCD", "#42C6FF", "#41DA86", "#C841DA", "#425BFF"] as const;

function tintHex(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `#${ch.map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function playerColor(index: number): string {
  const base = BASE_COLORS[index % BASE_COLORS.length];
  const cycle = Math.floor(index / BASE_COLORS.length);
  return cycle === 0 ? base : tintHex(base, Math.min(0.6, cycle * 0.18));
}

const cleanActor = (s: string) => (s.includes("|") ? s.split("|")[0] : s);

function themeLabel(entry: LeagueDraftEntry, spec: Map<string, { name: string }>): string {
  const d = entry.draft;
  const theme = d?.theme ?? entry.draft_type ?? "";
  if (theme === "spec-draft") return spec.get(d?.option ?? entry.theme ?? "")?.name ?? d?.option ?? "Special draft";
  if (theme === "filmography" || theme === "people") return cleanActor(d?.option ?? entry.theme ?? "") || entry.theme?.trim() || "Draft";
  if (theme === "year") return d?.option?.trim() || entry.theme?.trim() || "Draft";
  if (d?.option?.trim()) return d.option.trim();
  if (entry.theme?.trim()) return entry.theme.trim();
  return DRAFT_TYPE_LABELS[theme] ?? "Draft";
}

const completedAt = (e: LeagueDraftEntry) => new Date(e.draft?.updated_at ?? e.draft?.created_at ?? e.added_at).getTime();
const dateLabel = (e: LeagueDraftEntry) =>
  new Date(e.draft?.updated_at ?? e.draft?.created_at ?? e.added_at).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });

function niceMax(maxScore: number): number {
  const padded = Math.ceil(maxScore * 1.12);
  if (padded <= 5) return 5;
  if (padded <= 10) return 10;
  if (padded <= 25) return Math.ceil(padded / 5) * 5;
  if (padded <= 50) return Math.ceil(padded / 10) * 10;
  return Math.ceil(padded / 25) * 25;
}

function niceTicks(max: number): number[] {
  if (max <= 5) return [5];
  if (max <= 10) return [5, 10];
  const step = max <= 25 ? 5 : max <= 50 ? 10 : 25;
  const ticks: number[] = [];
  for (let v = step; v <= max; v += step) ticks.push(v);
  return ticks;
}

export function LeagueStandingsChart({ standings, completedDrafts, draftPickData, specDraftData }: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const { rows, players, yMax } = useMemo(() => {
    const players = standings.map((s, i) => ({ userId: s.user_id, name: s.display_name ?? "Unknown", color: playerColor(i) }));
    const cumulative = new Map(players.map((p) => [p.userId, 0]));
    const drafts = [...completedDrafts].filter((d) => d.draft_id && d.draft?.is_complete).sort((a, b) => completedAt(a) - completedAt(b));

    const rows: { label: string; date: string; values: Record<string, number>; earned: Record<string, number> }[] = [];
    if (drafts.length > 0) rows.push({ label: "", date: "", values: Object.fromEntries(players.map((p) => [p.userId, 0])), earned: {} });

    for (const entry of drafts) {
      const id = entry.draft_id!;
      const metrics = draftPickData?.metrics[id];
      const earned = metrics ? draftLeaguePointsByUserId(id, draftPickData?.participants ?? [], metrics.byParticipantName) : {};
      for (const [uid, pts] of Object.entries(earned)) if (cumulative.has(uid)) cumulative.set(uid, (cumulative.get(uid) ?? 0) + pts);
      rows.push({
        label: themeLabel(entry, specDraftData),
        date: dateLabel(entry),
        values: Object.fromEntries(players.map((p) => [p.userId, cumulative.get(p.userId) ?? 0])),
        earned: Object.fromEntries(players.map((p) => [p.userId, earned[p.userId] ?? 0])),
      });
    }
    const peak = Math.max(1, ...rows.flatMap((r) => players.map((p) => r.values[p.userId] ?? 0)));
    return { rows, players, yMax: niceMax(peak) };
  }, [standings, completedDrafts, draftPickData, specDraftData]);

  if (!standings.length || rows.length <= 1) return null;

  const H = 300;
  const M = { top: 8, right: 16, bottom: 64, left: 36 };
  const pad = 22;
  const innerW = Math.max(width - M.left - M.right, 1);
  const innerH = H - M.top - M.bottom;
  const x = (i: number) => M.left + pad + (i * (innerW - 2 * pad)) / Math.max(rows.length - 1, 1);
  const y = (v: number) => M.top + innerH * (1 - v / yMax);
  const maxChars = Math.max(5, Math.floor((innerW / rows.length) / 6));
  const sel = selected != null ? rows[selected] : null;

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-brockmann-medium text-[11px] text-greyscale-purp-400">League pts</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", columnGap: 12, rowGap: 4 }}>
        {players.map((p) => (
          <View key={p.userId} className="flex-row items-center gap-1.5">
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
            <Text className="text-xs text-greyscale-blue-300">{p.name}</Text>
          </View>
        ))}
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={H}>
            {niceTicks(yMax).map((t) => (
              <G key={t}>
                <Line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <SvgText x={M.left - 6} y={y(t) + 4} textAnchor="end" fill="#9E9CA3" fontSize={11} fontFamily="Brockmann-Regular">
                  {t}
                </SvgText>
              </G>
            ))}
            {players.map((p) => (
              <Polyline
                key={p.userId}
                points={rows.map((r, i) => `${x(i)},${y(r.values[p.userId] ?? 0)}`).join(" ")}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
              />
            ))}
            {players.map((p) =>
              rows.map((r, i) => (
                <Circle key={`${p.userId}-${i}`} cx={x(i)} cy={y(r.values[p.userId] ?? 0)} r={4} fill={p.color} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
              )),
            )}
            {rows.map((r, i) =>
              r.label ? (
                <G key={`x-${i}`}>
                  <SvgText x={x(i)} y={H - M.bottom + 18} textAnchor="middle" fill="#FCFFFF" fontSize={11} fontFamily="Brockmann-Regular">
                    {r.label.length > maxChars ? `${r.label.slice(0, maxChars - 1)}…` : r.label}
                  </SvgText>
                  <SvgText x={x(i)} y={H - M.bottom + 32} textAnchor="middle" fill="#BDC3C2" fontSize={10} fontFamily="Brockmann-Regular">
                    {r.date}
                  </SvgText>
                </G>
              ) : null,
            )}
          </Svg>
        )}
        {/* Invisible tap targets, one per draft column */}
        {width > 0 && (
          <View style={{ position: "absolute", top: 0, left: 0, width, height: H, flexDirection: "row" }} pointerEvents="box-none">
            {rows.map((r, i) =>
              r.label ? (
                <Pressable
                  key={i}
                  onPress={() => setSelected((cur) => (cur === i ? null : i))}
                  style={{ position: "absolute", left: x(i) - 24, width: 48, top: 0, height: H }}
                />
              ) : null,
            )}
          </View>
        )}
      </View>

      {sel && (
        <View className="rounded-md bg-card p-3" style={{ borderWidth: 1, borderColor: "#49474B" }}>
          <Text className="font-brockmann-semibold text-sm">{sel.label}</Text>
          <Text className="mb-2 text-xs text-greyscale-blue-400">{sel.date}</Text>
          {players.map((p) => (
            <View key={p.userId} className="flex-row items-center justify-between py-0.5">
              <View className="flex-1 flex-row items-center gap-2">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
                <Text numberOfLines={1} className="flex-1 text-sm text-greyscale-blue-200">{p.name}</Text>
              </View>
              <Text className="text-sm">{(sel.earned[p.userId] ?? 0) > 0 ? `+${sel.earned[p.userId]}` : "—"}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
