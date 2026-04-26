"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ArrowLeft,
  Clock,
  Target,
  Zap,
  Swords,
  Loader2,
  User,
  Users,
  Shield,
  BarChart2,
  TrendingUp,
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

  // ── helpers ──────────────────────────────────────────────────────────────
  const avatarSrc = (url?: string) =>
    !url ? null : url.startsWith("http") ? url : `https:${url}`;

  const SectionTitle = ({
    icon,
    label,
    sub,
  }: {
    icon: React.ReactNode;
    label: string;
    sub?: string;
  }) => (
    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
      {icon}
      {label}
      {sub && (
        <span className="text-xs text-muted-foreground font-normal">{sub}</span>
      )}
    </h2>
  );

  const StatPill = ({
    label,
    value,
    valueClass = "",
    sub,
  }: {
    label: string;
    value: string;
    valueClass?: string;
    sub?: string;
  }) => (
    <div className="rounded-lg bg-background/50 border border-border/40 px-4 py-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );

  const TeammateRow = ({
    t,
  }: {
    t: {
      name: string;
      total: number;
      wins: number;
      losses: number;
      winRate: number;
      avgRating: number;
      avatar?: string;
    };
  }) => {
    const wr = t.winRate;
    const wrClass =
      wr >= 55
        ? "text-green-400"
        : wr <= 45
          ? "text-red-400"
          : "text-foreground";
    const barColor =
      wr >= 55 ? "bg-green-500" : wr <= 45 ? "bg-red-500" : "bg-blue-400";
    const av = avatarSrc(t.avatar);
    return (
      <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {av ? (
            <img
              src={av}
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
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium truncate">{t.name}</span>
            <span
              className={`text-sm font-bold tabular-nums flex-shrink-0 ${wrClass}`}
            >
              {wr.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-border/40 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor}`}
                style={{ width: `${wr}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground flex-shrink-0">
              {t.wins}W–{t.losses}L · {t.total}g
              {t.avgRating > 0 && ` · ${t.avgRating}`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen px-4 pb-12 md:px-8">
      <div className="max-w-4xl mx-auto">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between py-4 mb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-sm font-semibold text-muted-foreground">
            Player Analysis
          </h1>
          <div className="w-10" />
        </div>

        {/* ── Search ── */}
        <div ref={searchRef} className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for a player..."
              value={searchQuery}
              onChange={handleQueryChange}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              className="w-full pl-10 pr-10 py-3 bg-card border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-72 overflow-y-auto">
              {searchResults.map((player) => (
                <button
                  key={player.profile_id}
                  onClick={() => selectPlayerFromSearch(player)}
                  className="w-full px-3 py-2.5 text-left hover:bg-accent flex items-center gap-3 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {player.avatars?.small ? (
                      <img
                        src={avatarSrc(player.avatars.small)!}
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
                        <span className="text-xs">
                          {AOE4WorldAPI.getCountryFlag(player.country)}
                        </span>
                      )}
                    </div>
                    {player.rating != null && (
                      <div className="text-xs text-muted-foreground">
                        {player.rating} rating
                        {player.win_rate != null &&
                          ` · ${AOE4WorldAPI.formatWinRate(player.win_rate)} WR`}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {loadingProgress && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Loading season data…</span>
                <span>
                  {loadingProgress.loaded} / {loadingProgress.total}
                </span>
              </div>
              <div className="h-1 bg-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Empty state ── */}
        {!playerData && !loading && (
          <div className="rounded-xl bg-card border border-border/50 p-16 text-center">
            <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Search for a player above to begin
            </p>
          </div>
        )}

        {/* ── Player loaded ── */}
        {playerData && (
          <>
            {/* ── Player header + mode toggle ── */}
            <div className="rounded-xl bg-card border border-border/50 p-5 mb-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {playerData.avatars?.medium && (
                  <img
                    src={playerData.avatars.medium}
                    alt={playerData.name}
                    className="w-12 h-12 rounded-lg border border-border/50"
                  />
                )}
                <div>
                  <div className="text-lg font-bold leading-tight">
                    {playerData.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {playerData.country && (
                      <span>
                        {AOE4WorldAPI.getCountryFlag(playerData.country)}{" "}
                        {playerData.country.toUpperCase()}
                      </span>
                    )}
                    <a
                      href={playerData.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View on AOE4World
                    </a>
                  </div>
                </div>
              </div>
              <div className="inline-flex rounded-lg border border-border/50 bg-background/40 p-0.5">
                {(["rm_solo", "rm_team"] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {m === "rm_solo" ? "1v1 Ranked" : "Team Ranked"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Ranked stats bar ── */}
            {modeStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-card border border-border/50 px-4 py-3 flex items-center gap-3">
                  <RankBadge
                    rankLevel={modeStats.rank_level}
                    size="sm"
                    showLabel={false}
                  />
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Rating
                    </div>
                    <div className="text-xl font-bold">
                      {modeStats.rating || "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Peak {modeStats.max_rating}
                    </div>
                  </div>
                </div>
                <StatPill
                  label="Rank"
                  value={
                    modeStats.rank ? `#${modeStats.rank.toLocaleString()}` : "—"
                  }
                  sub={
                    modeStats.rank_level ? titleCase(modeStats.rank_level) : ""
                  }
                />
                <StatPill
                  label="Win Rate"
                  value={`${modeStats.win_rate?.toFixed(1) ?? 0}%`}
                  valueClass={
                    modeStats.win_rate >= 50 ? "text-green-400" : "text-red-400"
                  }
                  sub={`${modeStats.wins_count}W – ${modeStats.losses_count}L`}
                />
                <StatPill
                  label="Streak"
                  value={`${modeStats.streak > 0 ? "+" : ""}${modeStats.streak}`}
                  valueClass={
                    modeStats.streak > 0
                      ? "text-green-400"
                      : modeStats.streak < 0
                        ? "text-red-400"
                        : ""
                  }
                  sub={
                    modeStats.streak > 0
                      ? "Winning"
                      : modeStats.streak < 0
                        ? "Losing"
                        : "Neutral"
                  }
                />
              </div>
            )}

            {analytics && (
              <>
                {/* ── Season overview ── */}
                <div className="rounded-xl bg-card border border-border/50 p-5 mb-4">
                  <SectionTitle
                    icon={<Zap className="w-4 h-4 text-primary" />}
                    label="Season Overview"
                    sub={`${analytics.totalWins + analytics.totalLosses} games · Season 12`}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Rolling 10-game win rate trend
                      </p>
                      <WinRateChart results={analytics.recentResults} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                      <StatPill
                        label="Overall WR"
                        value={`${analytics.winRate.toFixed(1)}%`}
                        valueClass={
                          analytics.winRate >= 50
                            ? "text-green-400"
                            : "text-red-400"
                        }
                        sub={`${analytics.totalWins}W – ${analytics.totalLosses}L`}
                      />
                      <StatPill
                        label="Avg win"
                        value={formatDuration(
                          Math.floor(analytics.avgWinDuration),
                        )}
                        sub="game length"
                      />
                      <StatPill
                        label="Avg loss"
                        value={formatDuration(
                          Math.floor(analytics.avgLossDuration),
                        )}
                        sub="game length"
                      />
                    </div>
                  </div>
                </div>

                {/* ── SOLO MODE ── */}
                {mode === "rm_solo" && (
                  <>
                    {/* Civ + Map side by side */}
                    {(analytics.civs.length > 0 ||
                      analytics.maps.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {analytics.civs.length > 0 && (
                          <div className="rounded-xl bg-card border border-border/50 p-5">
                            <SectionTitle
                              icon={<Target className="w-4 h-4 text-primary" />}
                              label="Civilizations"
                              sub="win rate by civ"
                            />
                            <PerfBarChart
                              data={analytics.civs.map((c) => ({
                                ...c,
                                key: titleCase(c.key),
                              }))}
                              maxItems={8}
                            />
                          </div>
                        )}
                        {analytics.maps.length > 0 && (
                          <div className="rounded-xl bg-card border border-border/50 p-5">
                            <SectionTitle
                              icon={<Target className="w-4 h-4 text-primary" />}
                              label="Maps"
                              sub="win rate by map"
                            />
                            <PerfBarChart data={analytics.maps} maxItems={8} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Matchups full width */}
                    {analytics.vsCivs.length > 0 && (
                      <div className="rounded-xl bg-card border border-border/50 p-5 mb-4">
                        <SectionTitle
                          icon={<Swords className="w-4 h-4 text-primary" />}
                          label="Matchups"
                          sub="win rate vs opponent civ (min 2 games)"
                        />
                        <MatchupBarChart
                          data={analytics.vsCivs.map((m) => ({
                            ...m,
                            key: titleCase(m.key),
                          }))}
                          maxItems={14}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* ── TEAM MODE ── */}
                {mode === "rm_team" && (
                  <>
                    {/* Format donut + teammate quality side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {analytics.formats.length > 0 && (
                        <div className="rounded-xl bg-card border border-border/50 p-5">
                          <SectionTitle
                            icon={
                              <BarChart2 className="w-4 h-4 text-primary" />
                            }
                            label="Game Formats"
                            sub="by games played"
                          />
                          <FormatDonutChart formats={analytics.formats} />
                        </div>
                      )}
                      {(analytics.avgTeamRatingWins > 0 ||
                        analytics.avgTeamRatingLosses > 0) && (
                        <div className="rounded-xl bg-card border border-border/50 p-5">
                          <SectionTitle
                            icon={
                              <TrendingUp className="w-4 h-4 text-primary" />
                            }
                            label="Teammate Quality"
                            sub="avg rating in wins vs losses"
                          />
                          <div className="space-y-3 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                In wins
                              </span>
                              <span className="text-xl font-bold text-green-400">
                                {Math.round(analytics.avgTeamRatingWins)}
                              </span>
                            </div>
                            <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, (analytics.avgTeamRatingWins / 2000) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                In losses
                              </span>
                              <span className="text-xl font-bold text-red-400">
                                {Math.round(analytics.avgTeamRatingLosses)}
                              </span>
                            </div>
                            <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, (analytics.avgTeamRatingLosses / 2000) * 100)}%`,
                                }}
                              />
                            </div>
                            {analytics.avgTeamRatingWins > 0 &&
                              analytics.avgTeamRatingLosses > 0 && (
                                <p className="text-xs text-muted-foreground pt-1">
                                  {analytics.avgTeamRatingWins >
                                  analytics.avgTeamRatingLosses
                                    ? `Wins correlate with ~${Math.round(analytics.avgTeamRatingWins - analytics.avgTeamRatingLosses)} higher avg teammate rating.`
                                    : "Teammate rating has minimal impact on your outcomes."}
                                </p>
                              )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Teammates full-width table */}
                    {analytics.teammates.length > 0 && (
                      <div className="rounded-xl bg-card border border-border/50 p-5 mb-4">
                        <SectionTitle
                          icon={<Users className="w-4 h-4 text-primary" />}
                          label="Teammates"
                          sub="min 2 games · sorted by games played"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                          {analytics.teammates.slice(0, 12).map((t) => (
                            <TeammateRow key={t.name} t={t} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Civ + Map side by side */}
                    {(analytics.civs.length > 0 ||
                      analytics.maps.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {analytics.civs.length > 0 && (
                          <div className="rounded-xl bg-card border border-border/50 p-5">
                            <SectionTitle
                              icon={<Target className="w-4 h-4 text-primary" />}
                              label="Civilizations"
                              sub="win rate by civ"
                            />
                            <PerfBarChart
                              data={analytics.civs.map((c) => ({
                                ...c,
                                key: titleCase(c.key),
                              }))}
                              maxItems={8}
                            />
                          </div>
                        )}
                        {analytics.civSynergies.length > 0 && (
                          <div className="rounded-xl bg-card border border-border/50 p-5">
                            <SectionTitle
                              icon={<Shield className="w-4 h-4 text-primary" />}
                              label="Civ Synergies"
                              sub="your civ + ally civ"
                            />
                            <PerfBarChart
                              data={analytics.civSynergies
                                .slice(0, 8)
                                .map((s) => ({
                                  ...s,
                                  key: s.key
                                    .split(" + ")
                                    .map(titleCase)
                                    .join(" + "),
                                }))}
                              maxItems={8}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Maps full width */}
                    {analytics.maps.length > 0 && (
                      <div className="rounded-xl bg-card border border-border/50 p-5 mb-4">
                        <SectionTitle
                          icon={<Target className="w-4 h-4 text-primary" />}
                          label="Maps"
                          sub="win rate by map"
                        />
                        <PerfBarChart data={analytics.maps} maxItems={10} />
                      </div>
                    )}

                    {/* Matchups vs opponent civs */}
                    {analytics.vsCivs.length > 0 && (
                      <div className="rounded-xl bg-card border border-border/50 p-5 mb-4">
                        <SectionTitle
                          icon={<Swords className="w-4 h-4 text-primary" />}
                          label="Matchups"
                          sub="win rate vs opponent civ (min 2 games)"
                        />
                        <MatchupBarChart
                          data={analytics.vsCivs.map((m) => ({
                            ...m,
                            key: titleCase(m.key),
                          }))}
                          maxItems={14}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
