import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot,
} from 'recharts';
import type { LeagueStanding } from '@/hooks/useLeagues';

interface Props {
  standings: LeagueStanding[];
}

const RANK_COLORS = ['#7142FF', '#907AFF', '#B5A3FF', '#D4CAFF'];
const DEFAULT_COLOR = '#49474b';

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md text-sm font-brockmann">
      <p className="font-semibold text-foreground">{d.display_name ?? 'Unknown'}</p>
      <p className="text-muted-foreground">
        {d.total_score} league pts · {d.draft_count} draft{d.draft_count !== 1 ? 's' : ''}
      </p>
      {d.raw_score > 0 && (
        <p className="text-muted-foreground text-xs">{d.raw_score.toFixed(1)} movie score</p>
      )}
    </div>
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, index } = props;
  const color = RANK_COLORS[index] ?? DEFAULT_COLOR;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="rgba(0,0,0,0.3)"
      strokeWidth={1}
    />
  );
};

const LeagueStandingsChart: React.FC<Props> = ({ standings }) => {
  if (!standings.length) return null;

  const data = [...standings]
    .sort((a, b) => b.total_score - a.total_score)
    .map((s, i) => ({
      ...s,
      display_name: s.display_name ?? 'Unknown',
      rank_index: i,
    }));

  const maxScore = Math.max(...data.map(d => d.total_score), 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="display_name"
          tick={{ fill: '#fcffff', fontSize: 12, fontFamily: 'Brockmann, sans-serif' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, maxScore * 1.15]}
          tick={{ fill: '#9e9ca3', fontSize: 11, fontFamily: 'Brockmann, sans-serif' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v === 0 ? '' : v.toFixed(0)}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="total_score"
          stroke="#7142FF"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 7, fill: '#7142FF', stroke: 'rgba(113,66,255,0.3)', strokeWidth: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LeagueStandingsChart;
