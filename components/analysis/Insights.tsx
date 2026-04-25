import type { AggregatedStat } from "./helpers";
import { titleCase, formatDuration } from "./helpers";

interface Analytics {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  avgWinDuration: number;
  avgLossDuration: number;
  strongestCivs: AggregatedStat[];
  weakestCivs: AggregatedStat[];
  strongestMaps: AggregatedStat[];
  weakestMaps: AggregatedStat[];
  worstMatchups: AggregatedStat[];
  bestMatchups: AggregatedStat[];
}

export function ImprovementInsights({
  analytics,
  streak,
}: {
  analytics: Analytics;
  streak?: number;
}) {
  const tips: { icon: string; title: string; body: string }[] = [];

  if (analytics.weakestCivs.length > 0) {
    const w = analytics.weakestCivs[0];
    if (w.winRate < 40 && w.total >= 3) {
      tips.push({
        icon: "⚠️",
        title: `Struggling with ${titleCase(w.key)}`,
        body: `Only ${w.winRate.toFixed(0)}% WR (${w.wins}W-${w.losses}L) in recent games. Consider dropping this civ or studying matchups.`,
      });
    }
  }

  if (analytics.strongestCivs.length > 0) {
    const b = analytics.strongestCivs[0];
    if (b.winRate >= 60 && b.total >= 3) {
      tips.push({
        icon: "🏆",
        title: `Main ${titleCase(b.key)} more`,
        body: `${b.winRate.toFixed(0)}% WR (${b.wins}W-${b.losses}L). This is your strongest civ right now — lean into it.`,
      });
    }
  }

  if (analytics.weakestMaps.length > 0) {
    const wm = analytics.weakestMaps[0];
    if (wm.winRate < 40 && wm.total >= 3) {
      tips.push({
        icon: "🗺️",
        title: `Weak on ${wm.key}`,
        body: `${wm.winRate.toFixed(0)}% WR — ban this map in drafts or watch pro replays for map-specific strategies.`,
      });
    }
  }

  if (analytics.worstMatchups.length > 0) {
    const wm = analytics.worstMatchups[0];
    if (wm.winRate < 40 && wm.total >= 3) {
      tips.push({
        icon: "⚔️",
        title: `Tough matchup vs ${titleCase(wm.key)}`,
        body: `${wm.winRate.toFixed(0)}% WR when facing ${titleCase(wm.key)}. Study this matchup specifically — counter units, timings, map control.`,
      });
    }
  }

  if (analytics.avgLossDuration > 0 && analytics.avgWinDuration > 0) {
    if (analytics.avgLossDuration < analytics.avgWinDuration - 300) {
      tips.push({
        icon: "⏱️",
        title: "Early game weakness",
        body: `Your losses (${formatDuration(Math.floor(analytics.avgLossDuration))}) are much shorter than wins (${formatDuration(Math.floor(analytics.avgWinDuration))}). Focus on early defense, walls, and scouting.`,
      });
    } else if (analytics.avgLossDuration > analytics.avgWinDuration + 300) {
      tips.push({
        icon: "⏱️",
        title: "Late game weakness",
        body: `Your losses are much longer than wins. Work on closing games earlier — push timings, siege transitions, and eco cuts.`,
      });
    }
  }

  if (streak !== undefined && streak <= -3) {
    tips.push({
      icon: "🧘",
      title: `${Math.abs(streak)} game losing streak`,
      body: "Take a break, review replays, or switch to a comfort civ. Tilt can compound losses.",
    });
  }

  if (analytics.winRate >= 60) {
    tips.push({
      icon: "🚀",
      title: "Climbing hard",
      body: `${analytics.winRate.toFixed(0)}% recent WR — push for rank while you're on form.`,
    });
  } else if (analytics.winRate < 40) {
    tips.push({
      icon: "📉",
      title: "Below-average form",
      body: `Only ${analytics.winRate.toFixed(0)}% in recent games. Stick to comfort picks and focus on fundamentals.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      icon: "✨",
      title: "Solid performance",
      body: "No major red flags — keep playing and review losses for incremental gains.",
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {tips.map((t, i) => (
        <div
          key={i}
          className="rounded-lg bg-background/40 border border-border/40 p-3"
        >
          <div className="flex items-start gap-2">
            <div className="text-xl leading-none mt-0.5">{t.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold mb-0.5">{t.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {t.body}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
