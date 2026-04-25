"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Trophy,
  ArrowLeft,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Swords,
} from "lucide-react";
import {
  AOE4WorldAPI,
  type AOE4PlayerStats,
  type Game,
} from "@/lib/aoe4world";
import RankBadge from "@/components/RankBadge";
import { titleCase, formatDuration, type AggregatedStat } from "@/components/analysis/helpers";
import { StatCard } from "@/components/analysis/StatCard";
import { PerfBar, MatchupRow, HighlightCard } from "@/components/analysis/PerfBar";
import { LossRow } from "@/components/analysis/LossRow";
import { ImprovementInsights } from "@/components/analysis/Insights";

type GameMode = "rm_solo" | "rm_team";

export default function PlayerAnalysisPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [playerData, setPlayerData] = useState<AOE4PlayerStats | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<GameMode>("rm_solo");
  const [expandedLoss, setExpandedLoss] = useState<number | null>(null);

  const loadGames = async (profileId: number, leaderboard: GameMode) => {
    const res = await fetch(
      `https://aoe4world.com/api/v0/players/${profileId}/games?leaderboard=${leaderboard}&limit=50`,
    );
    const data = await res.json();
    setRecentGames(data.games || []);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await AOE4WorldAPI.searchPlayers(searchQuery);
      if (results && results.length > 0) {
        const profileId = results[0].profile_id;
        const stats = await AOE4WorldAPI.getPlayerStats(profileId);
        setPlayerData(stats);
        await loadGames(profileId, mode);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: GameMode) => {
    setMode(newMode);
    if (playerData) {
      setLoading(true);
      await loadGames(playerData.profile_id, newMode);
      setLoading(false);
    }
  };

  const analytics = useMemo(() => {
    if (!playerData || recentGames.length === 0) return null;
    const profileId = playerData.profile_id;
    const mapStats = new Map<string, { wins: number; losses: number }>();
    const civStats = new Map<string, { wins: number; losses: number }>();
    const vsCivStats = new Map<string, { wins: number; losses: number }>();
    const winDurations: number[] = [];
    const lossDurations: number[] = [];
    let totalWins = 0;
    let totalLosses = 0;
    const recentResults: ("W" | "L")[] = [];

    for (const game of recentGames) {
      let myResult: "win" | "loss" | null = null;
      let myCiv: string | null = null;
      let myTeamIdx = -1;
      const opponentCivs: string[] = [];
      game.teams.forEach((team, idx) => {
        team.forEach((e) => {
          if (e.player.profile_id === profileId) {
            myResult = e.player.result;
            myCiv = e.player.civilization;
            myTeamIdx = idx;
          }
        });
      });
      if (!myResult || !myCiv) continue;
      game.teams.forEach((team, idx) => {
        if (idx !== myTeamIdx) {
          team.forEach((e) => opponentCivs.push(e.player.civilization));
        }
      });
      const bump = (m: Map<string, { wins: number; losses: number }>, k: string) => {
        if (!m.has(k)) m.set(k, { wins: 0, losses: 0 });
        const v = m.get(k)!;
        if (myResult === "win") v.wins++;
        else v.losses++;
      };
      bump(mapStats, game.map);
      bump(civStats, myCiv);
      for (const oc of opponentCivs) bump(vsCivStats, oc);
      if (myResult === "win") {
        totalWins++;
        winDurations.push(game.duration);
      } else {
        totalLosses++;
        lossDurations.push(game.duration);
      }
      recentResults.push(myResult === "win" ? "W" : "L");
    }

    const toSorted = (m: Map<string, { wins: number; losses: number }>, minGames = 2): AggregatedStat[] =>
      Array.from(m.entries())
        .map(([key, v]) => ({
          key,
          wins: v.wins,
          losses: v.losses,
          total: v.wins + v.losses,
          winRate: (v.wins / (v.wins + v.losses)) * 100,
        }))
        .filter((s) => s.total >= minGames)
        .sort((a, b) => b.total - a.total);

    const maps = toSorted(mapStats, 2);
    const civs = toSorted(civStats, 2);
    const vsCivs = toSorted(vsCivStats, 2);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const byWR = (arr: AggregatedStat[]) => [...arr].sort((a, b) => b.winRate - a.winRate);

    return {
      maps,
      civs,
      vsCivs,
      totalWins,
      totalLosses,
      winRate: totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0,
      avgWinDuration: avg(winDurations),
      avgLossDuration: avg(lossDurations),
      recentResults,
      strongestMaps: byWR(maps).slice(0, 3),
      weakestMaps: [...byWR(maps)].reverse().slice(0, 3),
      strongestCivs: byWR(civs).slice(0, 3),
      weakestCivs: [...byWR(civs)].reverse().slice(0, 3),
      bestMatchups: byWR(vsCivs).slice(0, 3),
      worstMatchups: [...byWR(vsCivs)].reverse().slice(0, 3),
    };
  }, [playerData, recentGames]);

  const recentLosses = useMemo(() => {
    if (!playerData) return [];
    return recentGames
      .map((game) => {
        let myData: { result: string; civilization: string; rating_diff: number } | null = null;
        let oppCiv = "";
        let myTeamIdx = -1;
        game.teams.forEach((team, idx) => {
          team.forEach((e) => {
            const p = e.player as {
              profile_id: number;
              result: string;
              civilization: string;
              rating_diff?: number;
            };
            if (p.profile_id === playerData.profile_id) {
              myData = { result: p.result, civilization: p.civilization, rating_diff: p.rating_diff ?? 0 };
              myTeamIdx = idx;
            }
          });
        });
        game.teams.forEach((team, idx) => {
          if (idx !== myTeamIdx && team[0]) oppCiv = team[0].player.civilization;
        });
        return { game, myData, oppCiv };
      })
      .filter((x) => x.myData?.result === "loss")
      .slice(0, 5);
  }, [playerData, recentGames]);

  const modeStats = playerData?.modes?.[mode];

  return (
    <main className="min-h-screen px-4 pb-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 mt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>

        <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
          <h1 className="text-xl font-bold mb-1">Player Analysis</h1>
          <p className="text-xs text-muted-foreground mb-4">
            Deep stats, matchup analysis, and improvement insights from recent matches
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for a player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 bg-background/60 border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Analyze"}
            </button>
          </div>
        </section>

        {playerData && (
          <>
            <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  {playerData.avatars?.medium && (
                    <img
                      src={playerData.avatars.medium}
                      alt={playerData.name}
                      className="w-14 h-14 rounded-lg border border-border/50"
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-bold leading-tight">{playerData.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {AOE4WorldAPI.getCountryFlag(playerData.country)} {playerData.country?.toUpperCase()}
                      {" • "}
                      <a
                        href={playerData.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Profile
                      </a>
                    </p>
                  </div>
                </div>
                <div className="inline-flex rounded-lg border border-border/50 bg-background/40 p-0.5">
                  <button
                    onClick={() => handleModeChange("rm_solo")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === "rm_solo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    1v1 Ranked
                  </button>
                  <button
                    onClick={() => handleModeChange("rm_team")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === "rm_team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Team Ranked
                  </button>
                </div>
              </div>
            </section>

            {modeStats && (
              <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Rating"
                  value={modeStats.rating?.toString() || "—"}
                  sub={`Peak ${modeStats.max_rating}`}
                  badge={<RankBadge rankLevel={modeStats.rank_level} size="sm" />}
                />
                <StatCard
                  label="Rank"
                  value={`#${modeStats.rank?.toLocaleString() || "—"}`}
                  sub={modeStats.rank_level ? titleCase(modeStats.rank_level) : ""}
                />
                <StatCard
                  label="Win Rate"
                  value={`${modeStats.win_rate?.toFixed(1) || 0}%`}
                  sub={`${modeStats.wins_count}W - ${modeStats.losses_count}L`}
                  valueClass={modeStats.win_rate >= 50 ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                  label="Streak"
                  value={`${modeStats.streak > 0 ? "+" : ""}${modeStats.streak}`}
                  sub={modeStats.streak > 0 ? "Winning" : modeStats.streak < 0 ? "Losing" : "Even"}
                  valueClass={modeStats.streak > 0 ? "text-green-400" : modeStats.streak < 0 ? "text-red-400" : ""}
                />
              </section>
            )}

            {analytics && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Recent Form
                  <span className="text-xs text-muted-foreground font-normal">
                    (last {analytics.totalWins + analytics.totalLosses} games)
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground mb-2">Result timeline (newest first)</div>
                    <div className="flex flex-wrap gap-1">
                      {analytics.recentResults.slice(0, 20).map((r, i) => (
                        <div
                          key={i}
                          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                            r === "W"
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {r}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 h-2 bg-background/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${analytics.winRate >= 50 ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${analytics.winRate}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{analytics.totalWins}W - {analytics.totalLosses}L</span>
                      <span>{analytics.winRate.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" /> Avg win length
                      </div>
                      <div className="text-lg font-bold">{formatDuration(Math.floor(analytics.avgWinDuration))}</div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" /> Avg loss length
                      </div>
                      <div className="text-lg font-bold">{formatDuration(Math.floor(analytics.avgLossDuration))}</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {analytics && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <HighlightCard
                  title="Strongest Maps"
                  icon={<Trophy className="w-4 h-4 text-green-400" />}
                  items={analytics.strongestMaps}
                  positive
                />
                <HighlightCard
                  title="Weakest Maps"
                  icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                  items={analytics.weakestMaps}
                  positive={false}
                />
                <HighlightCard
                  title="Strongest Civs"
                  icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
                  items={analytics.strongestCivs.map((c) => ({ ...c, key: titleCase(c.key) }))}
                  positive
                />
                <HighlightCard
                  title="Weakest Civs"
                  icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                  items={analytics.weakestCivs.map((c) => ({ ...c, key: titleCase(c.key) }))}
                  positive={false}
                />
              </div>
            )}

            {analytics && analytics.vsCivs.length > 0 && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-primary" />
                  Matchup Analysis
                  <span className="text-xs text-muted-foreground font-normal">
                    (performance vs opponent civs)
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Favorable Matchups
                    </div>
                    <div className="space-y-2">
                      {analytics.bestMatchups.map((m) => (
                        <MatchupRow key={m.key} stat={{ ...m, key: titleCase(m.key) }} positive />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Tough Matchups
                    </div>
                    <div className="space-y-2">
                      {analytics.worstMatchups.map((m) => (
                        <MatchupRow key={m.key} stat={{ ...m, key: titleCase(m.key) }} positive={false} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {analytics && analytics.civs.length > 0 && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Civilization Performance
                </h2>
                <div className="space-y-2">
                  {analytics.civs.map((c) => (
                    <PerfBar key={c.key} label={titleCase(c.key)} stat={c} />
                  ))}
                </div>
              </section>
            )}

            {analytics && analytics.maps.length > 0 && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Map Performance
                </h2>
                <div className="space-y-2">
                  {analytics.maps.map((m) => (
                    <PerfBar key={m.key} label={m.key} stat={m} color="blue" />
                  ))}
                </div>
              </section>
            )}

            {recentLosses.length > 0 && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Recent Losses — Deep Dive
                </h2>
                <div className="space-y-2">
                  {recentLosses.map(({ game, myData, oppCiv }, idx) => (
                    <LossRow
                      key={game.game_id}
                      game={game}
                      myCiv={myData!.civilization}
                      oppCiv={oppCiv}
                      ratingDiff={myData!.rating_diff}
                      expanded={expandedLoss === idx}
                      onToggle={() => setExpandedLoss(expandedLoss === idx ? null : idx)}
                    />
                  ))}
                </div>
              </section>
            )}

            {analytics && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Room for Improvement
                </h2>
                <ImprovementInsights analytics={analytics} streak={modeStats?.streak} />
              </section>
            )}
          </>
        )}

        {!playerData && !loading && (
          <section className="rounded-xl bg-card border border-border/50 p-10 text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Search for a player to begin analysis
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
