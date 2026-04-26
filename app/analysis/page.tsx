"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  Loader2,
  User,
  Users,
  Shield,
  BarChart2,
} from "lucide-react";
import {
  AOE4WorldAPI,
  type AOE4PlayerStats,
  type AOE4Player,
  type Game,
} from "@/lib/aoe4world";
import RankBadge from "@/components/RankBadge";
import {
  titleCase,
  formatDuration,
  type AggregatedStat,
} from "@/components/analysis/helpers";
import { StatCard } from "@/components/analysis/StatCard";
import {
  PerfBar,
  MatchupRow,
  HighlightCard,
} from "@/components/analysis/PerfBar";
import { LossRow } from "@/components/analysis/LossRow";
import { ImprovementInsights } from "@/components/analysis/Insights";
import {
  WinRateChart,
  PerfBarChart,
  MatchupBarChart,
  FormatDonutChart,
} from "@/components/analysis/AnalysisCharts";

type GameMode = "rm_solo" | "rm_team";

export default function PlayerAnalysisPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AOE4Player[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [playerData, setPlayerData] = useState<AOE4PlayerStats | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [mode, setMode] = useState<GameMode>("rm_solo");
  const [expandedLoss, setExpandedLoss] = useState<number | null>(null);

  const SEASON_START = "2026-01-01";
  const LIMIT = 50;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchOpen(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await AOE4WorldAPI.searchPlayers(q);
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      } catch {
        /* ignore */
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const selectPlayerFromSearch = async (player: AOE4Player) => {
    setSearchQuery(player.name);
    setSearchOpen(false);
    setSearchResults([]);
    setLoading(true);
    try {
      const stats = await AOE4WorldAPI.getPlayerStats(player.profile_id);
      setPlayerData(stats);
      await loadGames(player.profile_id, mode);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadGames = async (profileId: number, leaderboard: GameMode) => {
    setLoadingProgress(null);

    // Page 1 — also tells us total_count
    const firstUrl = `https://aoe4world.com/api/v0/players/${profileId}/games?leaderboard=${leaderboard}&limit=${LIMIT}&since=${SEASON_START}&page=1`;
    const firstRes = await fetch(firstUrl);
    const firstData = await firstRes.json();
    const totalCount: number = firstData.total_count ?? 0;
    const firstBatch: Game[] = firstData.games ?? [];
    const totalPages = Math.ceil(totalCount / LIMIT);

    setLoadingProgress({ loaded: firstBatch.length, total: totalCount });

    if (totalPages <= 1) {
      setRecentGames(firstBatch);
      setLoadingProgress(null);
      return;
    }

    // Fetch remaining pages in parallel
    const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const rest = await Promise.all(
      pageNums.map((page) =>
        fetch(
          `https://aoe4world.com/api/v0/players/${profileId}/games?leaderboard=${leaderboard}&limit=${LIMIT}&since=${SEASON_START}&page=${page}`,
        )
          .then((r) => r.json())
          .then((d) => (d.games as Game[]) ?? []),
      ),
    );

    const allGames = [...firstBatch, ...rest.flat()];
    setRecentGames(allGames);
    setLoadingProgress(null);
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

    // Team-specific
    const teammateStats = new Map<
      string,
      {
        wins: number;
        losses: number;
        profileId: number;
        rating: number[];
        avatar?: string;
      }
    >();
    const formatStats = new Map<string, { wins: number; losses: number }>();
    const civSynergyStats = new Map<string, { wins: number; losses: number }>();
    const teamRatingWins: number[] = [];
    const teamRatingLosses: number[] = [];

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
      const bump = (
        m: Map<string, { wins: number; losses: number }>,
        k: string,
      ) => {
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

      // Team stats
      bump(formatStats, game.kind);
      const teammates = game.teams[myTeamIdx].filter(
        (e) => e.player.profile_id !== profileId,
      );
      const teamRatings: number[] = [];
      for (const e of teammates) {
        const p = e.player as {
          profile_id: number;
          name: string;
          result: string;
          civilization: string;
          rating?: number;
          avatars?: { small?: string };
        };
        const key = p.name;
        if (!teammateStats.has(key)) {
          teammateStats.set(key, {
            wins: 0,
            losses: 0,
            profileId: p.profile_id,
            rating: [],
            avatar: p.avatars?.small,
          });
        }
        const ts = teammateStats.get(key)!;
        if (myResult === "win") ts.wins++;
        else ts.losses++;
        if (p.rating) {
          ts.rating.push(p.rating);
          teamRatings.push(p.rating);
        }
        // Civ synergy: my civ + teammate civ
        const combo = [myCiv!, p.civilization].sort().join(" + ");
        bump(civSynergyStats, combo);
      }
      const avgTeamRating = teamRatings.length
        ? teamRatings.reduce((a, b) => a + b, 0) / teamRatings.length
        : 0;
      if (avgTeamRating > 0) {
        if (myResult === "win") teamRatingWins.push(avgTeamRating);
        else teamRatingLosses.push(avgTeamRating);
      }
    }

    const toSorted = (
      m: Map<string, { wins: number; losses: number }>,
      minGames = 2,
    ): AggregatedStat[] =>
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
    const formats = toSorted(formatStats, 1);
    const civSynergies = toSorted(civSynergyStats, 2);

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const byWR = (arr: AggregatedStat[]) =>
      [...arr].sort((a, b) => b.winRate - a.winRate);

    // Teammate summaries
    const teammates = Array.from(teammateStats.entries())
      .map(([name, s]) => ({
        name,
        profileId: s.profileId,
        wins: s.wins,
        losses: s.losses,
        total: s.wins + s.losses,
        winRate: (s.wins / (s.wins + s.losses)) * 100,
        avgRating: s.rating.length ? Math.round(avg(s.rating)) : 0,
        avatar: s.avatar,
      }))
      .filter((t) => t.total >= 2)
      .sort((a, b) => b.total - a.total);

    return {
      maps,
      civs,
      vsCivs,
      formats,
      civSynergies,
      teammates,
      mostPlayedTeammates: teammates.slice(0, 5),
      bestTeammates: [...teammates]
        .filter((t) => t.total >= 3)
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 5),
      worstTeammates: [...teammates]
        .filter((t) => t.total >= 3)
        .sort((a, b) => a.winRate - b.winRate)
        .slice(0, 5),
      avgTeamRatingWins: avg(teamRatingWins),
      avgTeamRatingLosses: avg(teamRatingLosses),
      totalWins,
      totalLosses,
      winRate:
        totalWins + totalLosses > 0
          ? (totalWins / (totalWins + totalLosses)) * 100
          : 0,
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
        type MyData = {
          result: string;
          civilization: string;
          rating_diff: number;
        };
        let myData: MyData | null = null;
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
              myData = {
                result: p.result,
                civilization: p.civilization,
                rating_diff: p.rating_diff ?? 0,
              };
              myTeamIdx = idx;
            }
          });
        });
        game.teams.forEach((team, idx) => {
          if (idx !== myTeamIdx && team[0])
            oppCiv = team[0].player.civilization;
        });
        return { game, myData: myData as MyData | null, oppCiv };
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
            Deep stats, matchup analysis, and improvement insights from recent
            matches
          </p>
          <div ref={searchRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Type a player name to search..."
                value={searchQuery}
                onChange={handleQueryChange}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                className="w-full pl-10 pr-10 py-2.5 bg-background/60 border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-72 overflow-y-auto">
                {searchResults.map((player) => (
                  <button
                    key={player.profile_id}
                    onClick={() => selectPlayerFromSearch(player)}
                    className="w-full px-3 py-2.5 text-left hover:bg-accent flex items-center gap-3 transition-colors border-b border-border/30 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {player.avatars?.small ? (
                        <img
                          src={
                            player.avatars.small.startsWith("http")
                              ? player.avatars.small
                              : `https:${player.avatars.small}`
                          }
                          alt={player.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {player.name}
                        </span>
                        {player.country && (
                          <span className="text-xs flex-shrink-0">
                            {AOE4WorldAPI.getCountryFlag(player.country)}
                          </span>
                        )}
                      </div>
                      {player.rating != null && (
                        <div className="text-xs text-muted-foreground">
                          {player.rating} rating
                          {player.win_rate != null &&
                            ` • ${AOE4WorldAPI.formatWinRate(player.win_rate)} WR`}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadingProgress && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Fetching season games...</span>
                <span>
                  {loadingProgress.loaded} / {loadingProgress.total}
                </span>
              </div>
              <div className="h-1 bg-background/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
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
                    <h2 className="text-xl font-bold leading-tight">
                      {playerData.name}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {AOE4WorldAPI.getCountryFlag(playerData.country)}{" "}
                      {playerData.country?.toUpperCase()}
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
                      mode === "rm_solo"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    1v1 Ranked
                  </button>
                  <button
                    onClick={() => handleModeChange("rm_team")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === "rm_team"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
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
                  badge={
                    <RankBadge rankLevel={modeStats.rank_level} size="sm" />
                  }
                />
                <StatCard
                  label="Rank"
                  value={`#${modeStats.rank?.toLocaleString() || "—"}`}
                  sub={
                    modeStats.rank_level ? titleCase(modeStats.rank_level) : ""
                  }
                />
                <StatCard
                  label="Win Rate"
                  value={`${modeStats.win_rate?.toFixed(1) || 0}%`}
                  sub={`${modeStats.wins_count}W - ${modeStats.losses_count}L`}
                  valueClass={
                    modeStats.win_rate >= 50 ? "text-green-400" : "text-red-400"
                  }
                />
                <StatCard
                  label="Streak"
                  value={`${modeStats.streak > 0 ? "+" : ""}${modeStats.streak}`}
                  sub={
                    modeStats.streak > 0
                      ? "Winning"
                      : modeStats.streak < 0
                        ? "Losing"
                        : "Even"
                  }
                  valueClass={
                    modeStats.streak > 0
                      ? "text-green-400"
                      : modeStats.streak < 0
                        ? "text-red-400"
                        : ""
                  }
                />
              </section>
            )}

            {analytics && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Season Form
                  <span className="text-xs text-muted-foreground font-normal">
                    ({analytics.totalWins + analytics.totalLosses} games this
                    season)
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted-foreground mb-2">
                      Rolling 10-game win rate
                    </div>
                    <WinRateChart results={analytics.recentResults} />
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {analytics.totalWins}W - {analytics.totalLosses}L
                      </span>
                      <span>{analytics.winRate.toFixed(0)}% overall</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" /> Avg win length
                      </div>
                      <div className="text-lg font-bold">
                        {formatDuration(Math.floor(analytics.avgWinDuration))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" /> Avg loss length
                      </div>
                      <div className="text-lg font-bold">
                        {formatDuration(Math.floor(analytics.avgLossDuration))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── TEAM-ONLY SECTIONS ── */}
            {analytics && mode === "rm_team" && (
              <>
                {/* Game format breakdown */}
                {analytics.formats.length > 0 && (
                  <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-primary" />
                      Format Breakdown
                    </h2>
                    <FormatDonutChart formats={analytics.formats} />
                  </section>
                )}

                {/* Team rating insight */}
                {(analytics.avgTeamRatingWins > 0 ||
                  analytics.avgTeamRatingLosses > 0) && (
                  <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Teammate Quality Impact
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-4 text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          Avg teammate rating in{" "}
                          <span className="text-green-400 font-medium">
                            wins
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-green-400">
                          {Math.round(analytics.avgTeamRatingWins)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-4 text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          Avg teammate rating in{" "}
                          <span className="text-red-400 font-medium">
                            losses
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-red-400">
                          {Math.round(analytics.avgTeamRatingLosses)}
                        </div>
                      </div>
                    </div>
                    {analytics.avgTeamRatingWins > 0 &&
                      analytics.avgTeamRatingLosses > 0 && (
                        <p className="text-xs text-muted-foreground mt-3 text-center">
                          {analytics.avgTeamRatingWins >
                          analytics.avgTeamRatingLosses
                            ? `Wins happen with teammates ~${Math.round(analytics.avgTeamRatingWins - analytics.avgTeamRatingLosses)} rating higher — strong correlation with teammate quality.`
                            : `Teammate rating has minimal impact on outcomes — performance is consistent regardless of team strength.`}
                        </p>
                      )}
                  </section>
                )}

                {/* Teammates */}
                {analytics.mostPlayedTeammates.length > 0 && (
                  <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Teammates
                      <span className="text-xs text-muted-foreground font-normal">
                        (min 2 games together)
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Most played */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> Most Played With
                        </div>
                        <div className="space-y-2">
                          {analytics.mostPlayedTeammates.map((t) => (
                            <div
                              key={t.name}
                              className="flex items-center gap-3 rounded-lg bg-background/40 border border-border/40 px-3 py-2"
                            >
                              <div className="w-7 h-7 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                {t.avatar ? (
                                  <img
                                    src={
                                      t.avatar.startsWith("http")
                                        ? t.avatar
                                        : `https:${t.avatar}`
                                    }
                                    alt={t.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {t.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t.total} games{" "}
                                  {t.avgRating > 0 &&
                                    `• ~${t.avgRating} rating`}
                                </div>
                              </div>
                              <div
                                className={`text-sm font-bold tabular-nums ${t.winRate >= 55 ? "text-green-400" : t.winRate <= 45 ? "text-red-400" : "text-foreground"}`}
                              >
                                {t.winRate.toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Best & worst by WR */}
                      <div className="space-y-4">
                        {analytics.bestTeammates.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5" /> Best Win
                              Rate With
                            </div>
                            <div className="space-y-1.5">
                              {analytics.bestTeammates.slice(0, 3).map((t) => (
                                <div
                                  key={t.name}
                                  className="flex items-center justify-between text-xs rounded bg-green-500/5 border border-green-500/15 px-3 py-1.5"
                                >
                                  <span className="font-medium truncate mr-2">
                                    {t.name}
                                  </span>
                                  <span className="text-green-400 font-bold tabular-nums flex-shrink-0">
                                    {t.winRate.toFixed(0)}%{" "}
                                    <span className="text-muted-foreground font-normal">
                                      ({t.total}g)
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {analytics.worstTeammates.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                              <TrendingDown className="w-3.5 h-3.5" /> Lowest
                              Win Rate With
                            </div>
                            <div className="space-y-1.5">
                              {analytics.worstTeammates.slice(0, 3).map((t) => (
                                <div
                                  key={t.name}
                                  className="flex items-center justify-between text-xs rounded bg-red-500/5 border border-red-500/15 px-3 py-1.5"
                                >
                                  <span className="font-medium truncate mr-2">
                                    {t.name}
                                  </span>
                                  <span className="text-red-400 font-bold tabular-nums flex-shrink-0">
                                    {t.winRate.toFixed(0)}%{" "}
                                    <span className="text-muted-foreground font-normal">
                                      ({t.total}g)
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Civ synergies */}
                {analytics.civSynergies.length > 0 && (
                  <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      Civ Synergies
                      <span className="text-xs text-muted-foreground font-normal">
                        (your civ + teammate civ combos)
                      </span>
                    </h2>
                    <PerfBarChart
                      data={analytics.civSynergies
                        .slice(0, 8)
                        .map((s) => ({
                          ...s,
                          key: s.key.split(" + ").map(titleCase).join(" + "),
                        }))}
                      maxItems={8}
                    />
                  </section>
                )}
              </>
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
                  items={analytics.strongestCivs.map((c) => ({
                    ...c,
                    key: titleCase(c.key),
                  }))}
                  positive
                />
                <HighlightCard
                  title="Weakest Civs"
                  icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                  items={analytics.weakestCivs.map((c) => ({
                    ...c,
                    key: titleCase(c.key),
                  }))}
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
                    (win rate vs opponent civs, min 2 games)
                  </span>
                </h2>
                <MatchupBarChart
                  data={analytics.vsCivs.map((m) => ({
                    ...m,
                    key: titleCase(m.key),
                  }))}
                  maxItems={12}
                />
              </section>
            )}

            {analytics && analytics.civs.length > 0 && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Civilization Performance
                </h2>
                <PerfBarChart
                  data={analytics.civs.map((c) => ({
                    ...c,
                    key: titleCase(c.key),
                  }))}
                />
              </section>
            )}

            {analytics && analytics.maps.length > 0 && (
              <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Map Performance
                </h2>
                <PerfBarChart data={analytics.maps} />
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
                      onToggle={() =>
                        setExpandedLoss(expandedLoss === idx ? null : idx)
                      }
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
                <ImprovementInsights
                  analytics={analytics}
                  streak={modeStats?.streak}
                />
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
