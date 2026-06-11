import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { LeagueDraftEntry, LeagueStanding } from '@/hooks/useLeagues';
import { getCleanActorName } from '@/lib/utils';
import {
  draftLeaguePointsByUserId,
  type DraftParticipantRow,
  type LeagueDraftMetricPack,
} from '@/lib/leagueDraftMetrics';

interface Props {
  standings: LeagueStanding[];
  completedDrafts: LeagueDraftEntry[];
  draftPickData: {
    metrics: Record<string, LeagueDraftMetricPack>;
    participants: DraftParticipantRow[];
  } | null;
  specDraftData: Map<string, { name: string; photo_url: string | null }>;
}

const DRAFT_TYPE_LABELS: Record<string, string> = {
  classic: 'Classic',
  year: 'By Year',
  people: 'By Filmmaker',
  'spec-draft': 'Special Draft',
  filmography: 'By Filmography',
};

/** Base line colors by standings order (player 1–6). */
const BASE_PLAYER_COLORS = [
  '#7142FF', // purple
  '#42FFCD',
  '#42C6FF',
  '#41DA86',
  '#C841DA',
  '#425BFF',
] as const;

function tintHex(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `#${clamp(mix(r)).toString(16).padStart(2, '0')}${clamp(mix(g)).toString(16).padStart(2, '0')}${clamp(mix(b)).toString(16).padStart(2, '0')}`;
}

/** Player 7+ reuse the same hue order with progressively lighter tints. */
function playerColor(index: number): string {
  const base = BASE_PLAYER_COLORS[index % BASE_PLAYER_COLORS.length];
  const cycle = Math.floor(index / BASE_PLAYER_COLORS.length);
  if (cycle === 0) return base;
  const tintAmount = Math.min(0.6, cycle * 0.18);
  return tintHex(base, tintAmount);
}

type ChartRow = {
  draftKey: string;
  themeLabel: string;
  dateLabel: string;
  sortTime: number;
  pointsEarned: Record<string, number>;
  [userId: string]: string | number | Record<string, number>;
};

type PlayerSeries = {
  userId: string;
  name: string;
  color: string;
};

function draftThemeLabel(
  entry: LeagueDraftEntry,
  specDraftData: Map<string, { name: string; photo_url: string | null }>,
): string {
  const d = entry.draft;
  const theme = d?.theme ?? entry.draft_type ?? '';
  if (theme === 'spec-draft') {
    const specId = d?.option ?? entry.theme ?? '';
    return specDraftData.get(specId)?.name ?? d?.option ?? 'Special draft';
  }
  if (theme === 'filmography' || theme === 'people') {
    const name = getCleanActorName(d?.option ?? entry.theme ?? '');
    return name || entry.theme?.trim() || 'Draft';
  }
  if (theme === 'year') {
    return d?.option?.trim() || entry.theme?.trim() || 'Draft';
  }
  if (d?.option?.trim()) return d.option.trim();
  if (entry.theme?.trim()) return entry.theme.trim();
  return DRAFT_TYPE_LABELS[theme] ?? 'Draft';
}

function draftCompletedAt(entry: LeagueDraftEntry): number {
  const iso = entry.draft?.updated_at ?? entry.draft?.created_at ?? entry.added_at;
  return new Date(iso).getTime();
}

function formatDraftDate(entry: LeagueDraftEntry): string {
  const iso = entry.draft?.updated_at ?? entry.draft?.created_at ?? entry.added_at;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

const CustomXAxisTick = ({ x, y, payload, rows }: {
  x?: number;
  y?: number;
  payload?: { value: string };
  rows: ChartRow[];
}) => {
  if (x == null || y == null || !payload?.value || payload.value === '__start__') return null;
  const row = rows.find(r => r.draftKey === payload.value);
  if (!row?.themeLabel) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor="middle"
        fill="#FCFFFF"
        fontSize={11}
        fontFamily="Brockmann, sans-serif"
        dy={14}
      >
        {row.themeLabel.length > 16 ? `${row.themeLabel.slice(0, 15)}…` : row.themeLabel}
      </text>
      <text
        textAnchor="middle"
        fill="#BDC3C2"
        fontSize={10}
        fontFamily="Brockmann, sans-serif"
        dy={28}
      >
        {row.dateLabel}
      </text>
    </g>
  );
};

function niceYAxisMax(maxScore: number): number {
  const padded = Math.ceil(maxScore * 1.12);
  if (padded <= 5) return 5;
  if (padded <= 10) return 10;
  if (padded <= 25) return Math.ceil(padded / 5) * 5;
  if (padded <= 50) return Math.ceil(padded / 10) * 10;
  return Math.ceil(padded / 25) * 25;
}

function niceYAxisTicks(max: number): number[] {
  if (max <= 5) return [5];
  if (max <= 10) return [5, 10];
  const step = max <= 25 ? 5 : max <= 50 ? 10 : 25;
  const ticks: number[] = [];
  for (let v = step; v <= max; v += step) ticks.push(v);
  return ticks;
}

const CustomYAxisTick = ({ x, y, payload }: {
  x?: number;
  y?: number;
  payload?: { value: number };
}) => {
  if (x == null || y == null || payload?.value == null || payload.value === 0) return null;
  const value = Math.round(payload.value);
  if (value === 0) return null;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="#9e9ca3"
      fontSize={11}
      fontFamily="Brockmann, sans-serif"
    >
      {value}
    </text>
  );
};

const ChartTooltip = ({
  active,
  payload,
  label,
  rows,
  players,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  rows: ChartRow[];
  players: PlayerSeries[];
}) => {
  if (!active || !payload?.length || !label || label === '__start__') return null;
  const row = rows.find(r => r.draftKey === label);
  if (!row?.themeLabel) return null;

  return (
    <div className="rounded-md border border-[#49474B] bg-[#1D1D1F] px-3 py-2 shadow-md text-sm font-brockmann max-w-xs">
      <p className="m-0 font-semibold text-greyscale-blue-100">{row.themeLabel}</p>
      <p className="m-0 mb-2 text-xs text-greyscale-blue-400">{row.dateLabel}</p>
      <ul className="m-0 list-none space-y-1 p-0">
        {players.map(player => {
          const earned = row.pointsEarned[player.userId] ?? 0;
          return (
            <li key={player.userId} className="flex items-center justify-between gap-4 text-greyscale-blue-200">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: player.color }}
                  aria-hidden
                />
                <span className="truncate">{player.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-greyscale-blue-100">
                {earned > 0 ? `+${earned}` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const LeagueStandingsChart: React.FC<Props> = ({
  standings,
  completedDrafts,
  draftPickData,
  specDraftData,
}) => {
  const { chartRows, players, yAxisMax } = useMemo(() => {
    const playerSeries: PlayerSeries[] = standings.map((s, index) => ({
      userId: s.user_id,
      name: s.display_name ?? 'Unknown',
      color: playerColor(index),
    }));

    const cumulative = new Map<string, number>(
      playerSeries.map(p => [p.userId, 0]),
    );

    const sortedDrafts = [...completedDrafts]
      .filter(d => d.draft_id && d.draft?.is_complete)
      .sort((a, b) => draftCompletedAt(a) - draftCompletedAt(b));

    const rows: ChartRow[] = [];

    if (sortedDrafts.length > 0) {
      const origin: ChartRow = {
        draftKey: '__start__',
        themeLabel: '',
        dateLabel: '',
        sortTime: draftCompletedAt(sortedDrafts[0]) - 1,
        pointsEarned: {},
      };
      for (const player of playerSeries) {
        origin[player.userId] = 0;
      }
      rows.push(origin);
    }

    for (const entry of sortedDrafts) {
      const draftId = entry.draft_id!;
      const metrics = draftPickData?.metrics[draftId];
      const participants = draftPickData?.participants ?? [];

      const earned = metrics
        ? draftLeaguePointsByUserId(draftId, participants, metrics.byParticipantName)
        : {};

      for (const [userId, pts] of Object.entries(earned)) {
        if (cumulative.has(userId)) {
          cumulative.set(userId, (cumulative.get(userId) ?? 0) + pts);
        }
      }

      const pointsEarned: Record<string, number> = {};
      for (const player of playerSeries) {
        pointsEarned[player.userId] = earned[player.userId] ?? 0;
      }

      const row: ChartRow = {
        draftKey: entry.id,
        themeLabel: draftThemeLabel(entry, specDraftData),
        dateLabel: formatDraftDate(entry),
        sortTime: draftCompletedAt(entry),
        pointsEarned,
      };
      for (const player of playerSeries) {
        row[player.userId] = cumulative.get(player.userId) ?? 0;
      }
      rows.push(row);
    }

    const peak = rows.reduce((max, row) => {
      const rowMax = playerSeries.reduce(
        (inner, player) => Math.max(inner, Number(row[player.userId] ?? 0)),
        0,
      );
      return Math.max(max, rowMax);
    }, 0);

    return {
      chartRows: rows,
      players: playerSeries,
      maxScore: Math.max(peak, 1),
      yAxisMax: niceYAxisMax(Math.max(peak, 1)),
    };
  }, [standings, completedDrafts, draftPickData, specDraftData]);

  if (!standings.length || chartRows.length <= 1) return null;

  const xAxisTicks = chartRows
    .filter(row => row.themeLabel)
    .map(row => row.draftKey);

  const yAxisTicks = niceYAxisTicks(yAxisMax);

  return (
    <div className="w-full overflow-visible">
      <p className="m-0 mb-2 text-[11px] font-medium text-[#9e9ca3] font-brockmann">League pts</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartRows}
          margin={{ top: 8, right: 32, bottom: 8, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="draftKey"
            ticks={xAxisTicks}
            tick={(props) => <CustomXAxisTick {...props} rows={chartRows} />}
            axisLine={false}
            tickLine={false}
            interval={0}
            height={64}
            padding={{ left: 28, right: 28 }}
          />
          <YAxis
            domain={[0, yAxisMax]}
            ticks={yAxisTicks}
            tick={<CustomYAxisTick />}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
        <Tooltip
          content={(
            <ChartTooltip
              rows={chartRows}
              players={players}
            />
          )}
          cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            paddingBottom: 12,
            fontFamily: 'Brockmann, sans-serif',
            fontSize: 12,
            color: '#BDC3C2',
          }}
        />
        {players.map(player => (
          <Line
            key={player.userId}
            type="monotone"
            dataKey={player.userId}
            name={player.name}
            stroke={player.color}
            strokeWidth={2}
            dot={{ r: 4, fill: player.color, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 1 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LeagueStandingsChart;
