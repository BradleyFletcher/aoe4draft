"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  ReferenceLine,
} from "recharts";
import { type AggregatedStat } from "./helpers";

// ─── Shared colours ────────────────────────────────────────────────────────
const WIN_COLOR = "#4ade80";
const LOSS_COLOR = "#f87171";
const NEUTRAL_COLOR = "#60a5fa";

function wrColor(wr: number) {
  if (wr >= 60) return "#4ade80";
  if (wr >= 50) return "#a3e635";
  if (wr >= 40) return "#facc15";
  return "#f87171";
}

// ─── Tooltip helpers ────────────────────────────────────────────────────────
const darkTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

// ─── 1. Win-rate timeline (rolling 10-game window) ──────────────────────────
interface WinRateChartProps {
  results: ("W" | "L")[];
}

export function WinRateChart({ results }: WinRateChartProps) {
  const WINDOW = 10;
  // results[0] = newest → reverse so chart reads oldest→newest
  const ordered = [...results].reverse();
  const data = ordered.map((_, i) => {
    const slice = ordered.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const wins = slice.filter((r) => r === "W").length;
    return {
      game: i + 1,
      wr: Math.round((wins / slice.length) * 100),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
      >
        <defs>
          <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={NEUTRAL_COLOR} stopOpacity={0.3} />
            <stop offset="95%" stopColor={NEUTRAL_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="game"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          label={{
            value: "Game (oldest → newest)",
            position: "insideBottom",
            offset: -2,
            fontSize: 10,
            fill: "hsl(var(--muted-foreground))",
          }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          {...darkTooltip}
          formatter={(v) => [`${String(v)}%`, `Rolling ${WINDOW}-game WR`]}
          labelFormatter={(l) => `Game ${l}`}
        />
        <ReferenceLine
          y={50}
          stroke="rgba(255,255,255,0.15)"
          strokeDasharray="4 4"
        />
        <Area
          type="monotone"
          dataKey="wr"
          stroke={NEUTRAL_COLOR}
          strokeWidth={2}
          fill="url(#wrGrad)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── 2. Horizontal bar chart for civ or map stats ───────────────────────────
interface PerfChartProps {
  data: AggregatedStat[];
  maxItems?: number;
}

export function PerfBarChart({ data, maxItems = 10 }: PerfChartProps) {
  const sliced = data.slice(0, maxItems).map((s) => ({
    name: s.key,
    WR: Math.round(s.winRate),
    wins: s.wins,
    losses: s.losses,
    total: s.total,
  }));

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(180, sliced.length * 36)}
    >
      <BarChart
        data={sliced}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="rgba(255,255,255,0.06)"
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          {...darkTooltip}
          formatter={(
            _: unknown,
            __: unknown,
            props: {
              payload?: { wins: number; losses: number; total: number };
            },
          ) => {
            const p = props.payload;
            return p
              ? [`${p.wins}W – ${p.losses}L (${p.total} games)`, "Record"]
              : ["—", "Record"];
          }}
          labelFormatter={(l) => l}
        />
        <ReferenceLine
          x={50}
          stroke="rgba(255,255,255,0.15)"
          strokeDasharray="4 4"
        />
        <Bar
          dataKey="WR"
          radius={[0, 4, 4, 0]}
          label={{
            position: "right",
            fontSize: 10,
            fill: "hsl(var(--muted-foreground))",
            formatter: (v: unknown) => `${v}%`,
          }}
        >
          {sliced.map((entry) => (
            <Cell key={entry.name} fill={wrColor(entry.WR)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 3. Matchup analysis grouped bar chart ──────────────────────────────────
interface MatchupChartProps {
  data: AggregatedStat[];
  maxItems?: number;
}

export function MatchupBarChart({ data, maxItems = 8 }: MatchupChartProps) {
  const sliced = data
    .slice(0, maxItems)
    .map((s) => ({
      name: s.key,
      Wins: s.wins,
      Losses: s.losses,
      total: s.total,
    }));

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(180, sliced.length * 40)}
    >
      <BarChart
        data={sliced}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        barCategoryGap="25%"
        barGap={2}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="rgba(255,255,255,0.06)"
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...darkTooltip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Wins" fill={WIN_COLOR} radius={[0, 3, 3, 0]} />
        <Bar dataKey="Losses" fill={LOSS_COLOR} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 4. Team format donut chart ─────────────────────────────────────────────
const FORMAT_COLORS = ["#60a5fa", "#818cf8", "#a78bfa", "#f472b6", "#34d399"];

interface FormatDonutProps {
  formats: AggregatedStat[];
}

export function FormatDonutChart({ formats }: FormatDonutProps) {
  const data = formats.map((f) => ({
    name: f.key.replace("rm_", "").toUpperCase(),
    value: f.total,
    wins: f.wins,
    losses: f.losses,
    wr: Math.round(f.winRate),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          label={({ name, index }) =>
            `${name} ${data[index as number]?.wr ?? 0}%`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={FORMAT_COLORS[i % FORMAT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...darkTooltip}
          formatter={(
            _: unknown,
            __: unknown,
            props: { payload?: { wins: number; losses: number; wr: number } },
          ) => {
            const p = props.payload;
            return p
              ? [`${p.wins}W – ${p.losses}L (${p.wr}% WR)`, "Record"]
              : ["—", "Record"];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
