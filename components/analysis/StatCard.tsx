import React from "react";

export function StatCard({
  label,
  value,
  sub,
  badge,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <div className={`text-xl font-bold ${valueClass}`}>{value}</div>
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
