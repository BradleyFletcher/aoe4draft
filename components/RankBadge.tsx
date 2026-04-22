// AOE4 Rank Badge Component using official AOE4 World badges
interface RankBadgeProps {
  rankLevel: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function RankBadge({
  rankLevel,
  size = "md",
  showLabel = true,
}: RankBadgeProps) {
  if (!rankLevel) {
    return <span className="text-xs text-muted-foreground">Unranked</span>;
  }

  // Map rank levels to display names
  const rankLabels: Record<string, string> = {
    bronze_1: "Bronze I",
    bronze_2: "Bronze II",
    bronze_3: "Bronze III",
    silver_1: "Silver I",
    silver_2: "Silver II",
    silver_3: "Silver III",
    gold_1: "Gold I",
    gold_2: "Gold II",
    gold_3: "Gold III",
    platinum_1: "Platinum I",
    platinum_2: "Platinum II",
    platinum_3: "Platinum III",
    diamond_1: "Diamond I",
    diamond_2: "Diamond II",
    diamond_3: "Diamond III",
    conqueror_1: "Conqueror I",
    conqueror_2: "Conqueror II",
    conqueror_3: "Conqueror III",
  };

  const label =
    rankLabels[rankLevel] ||
    rankLevel.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const sizeConfig = {
    sm: { size: "20px", text: "text-[10px]" },
    md: { size: "24px", text: "text-xs" },
    lg: { size: "32px", text: "text-sm" },
  };

  const config = sizeConfig[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.text} font-medium`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/rank_badges/${rankLevel}.svg`}
        alt={label}
        width={config.size}
        height={config.size}
        className="flex-shrink-0"
      />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
