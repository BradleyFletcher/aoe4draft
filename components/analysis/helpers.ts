export interface AggregatedStat {
  key: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
