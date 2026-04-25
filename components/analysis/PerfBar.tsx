import { AggregatedStat } from "./helpers";

export function PerfBar({
  label,
  stat,
  color = "green",
}: {
  label: string;
  stat: AggregatedStat;
  color?: "green" | "blue";
}) {
  const good = stat.winRate >= 50;
  const goodColor = color === "blue" ? "bg-blue-500" : "bg-green-500";
  const badColor = color === "blue" ? "bg-orange-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {stat.wins}W-{stat.losses}L{" "}
          <span className={good ? "text-green-400" : "text-red-400"}>
            ({stat.winRate.toFixed(0)}%)
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-background/60 rounded-full overflow-hidden">
        <div
          className={`h-full ${good ? goodColor : badColor}`}
          style={{ width: `${stat.winRate}%` }}
        />
      </div>
    </div>
  );
}

export function MatchupRow({
  stat,
  positive,
}: {
  stat: AggregatedStat;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background/40 border border-border/40 px-3 py-2">
      <span className="text-xs font-medium">vs {stat.key}</span>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {stat.wins}-{stat.losses}
        </span>
        <span
          className={`font-bold ${positive ? "text-green-400" : "text-red-400"}`}
        >
          {stat.winRate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function HighlightCard({
  title,
  icon,
  items,
  positive,
}: {
  title: string;
  icon: React.ReactNode;
  items: AggregatedStat[];
  positive: boolean;
}) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">Not enough data</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-medium truncate mr-2">{s.key}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-muted-foreground text-[10px]">
                  {s.wins}-{s.losses}
                </span>
                <span
                  className={`font-bold ${positive ? "text-green-400" : "text-red-400"}`}
                >
                  {s.winRate.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
