"use client";

import { useState, useEffect, useRef } from "react";
import {
  AOE4WorldAPI,
  type AOE4Player,
  type AOE4PlayerStats,
} from "@/lib/aoe4world";
import { TeamPlayer } from "@/lib/draft";
import {
  Loader2,
  Search,
  User,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import RankBadge from "./RankBadge";

interface PlayerSearchProps {
  value: TeamPlayer;
  onChange: (player: TeamPlayer) => void;
  placeholder?: string;
  className?: string;
}

export default function PlayerSearch({
  value,
  onChange,
  placeholder = "Search for player...",
  className = "",
}: PlayerSearchProps) {
  const [query, setQuery] = useState(value.name || "");
  const [results, setResults] = useState<AOE4Player[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<AOE4PlayerStats | null>(
    null,
  );
  const [statsLoading, setStatsLoading] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const isTypingRef = useRef(false);

  // Update query when value changes externally (but not during typing)
  useEffect(() => {
    if (!isTypingRef.current && value.name !== query) {
      setQuery(value.name || "");
    }
  }, [value.name]);

  // Load player stats if we have a profileId
  useEffect(() => {
    if (value.profileId && !value.aoe4Data) {
      loadPlayerStats(value.profileId);
    }
  }, [value.profileId]);

  // Update selected player when aoe4Data changes
  useEffect(() => {
    if (value.aoe4Data) {
      setSelectedPlayer(value.aoe4Data);
    }
  }, [value.aoe4Data]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadPlayerStats = async (profileId: number) => {
    setStatsLoading(true);
    try {
      const stats = await AOE4WorldAPI.getPlayerStats(profileId);
      if (stats) {
        setSelectedPlayer(stats);
        onChange({ ...value, aoe4Data: stats });
      }
    } catch (error) {
      console.warn("Failed to load player stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const searchPlayers = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const players = await AOE4WorldAPI.searchPlayers(searchQuery);
      setResults(players);
      setIsOpen(players.length > 0);
    } catch (error) {
      console.warn("Failed to search players:", error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true;
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear existing player data if query changes
    if (newQuery !== value.name) {
      onChange({ name: newQuery });
      setSelectedPlayer(null);
    }

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      searchPlayers(newQuery);
      isTypingRef.current = false;
    }, 300);
  };

  const selectPlayer = (player: AOE4Player) => {
    isTypingRef.current = false;
    setQuery(player.name);
    setIsOpen(false);
    onChange({
      name: player.name,
      profileId: player.profile_id,
    });

    // Load detailed stats
    loadPlayerStats(player.profile_id);
  };

  const clearPlayer = () => {
    isTypingRef.current = false;
    setQuery("");
    onChange({ name: "" });
    setSelectedPlayer(null);
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const primaryStats = selectedPlayer
    ? AOE4WorldAPI.getPrimaryRating(selectedPlayer)
    : null;

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={(e) => {
            // Clear default text if it matches the placeholder pattern
            if (query.match(/^Team \d Player \d$/)) {
              setQuery("");
              onChange({ name: "" });
            }
            // Show results if we have any
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 bg-input rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        {query && (
          <button
            onClick={clearPlayer}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((player) => (
            <button
              key={player.profile_id}
              onClick={() => selectPlayer(player)}
              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                      e.currentTarget.parentElement!.innerHTML =
                        '<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                    }}
                  />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{player.name}</span>
                  {player.country && (
                    <span className="text-xs">
                      {AOE4WorldAPI.getCountryFlag(player.country)}
                    </span>
                  )}
                </div>
                {player.rating !== null && (
                  <div className="text-xs text-muted-foreground">
                    {player.rating} rating •{" "}
                    {player.win_rate
                      ? AOE4WorldAPI.formatWinRate(player.win_rate)
                      : "N/A"}{" "}
                    win rate
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Player Stats Display */}
      {selectedPlayer && primaryStats && (
        <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border/50">
          {statsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading stats...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {selectedPlayer.avatars?.small ? (
                      <img
                        src={
                          selectedPlayer.avatars.small.startsWith("http")
                            ? selectedPlayer.avatars.small
                            : `https:${selectedPlayer.avatars.small}`
                        }
                        alt={selectedPlayer.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML =
                            '<svg class="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                        }}
                      />
                    ) : (
                      <User className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="font-medium text-sm">
                    {selectedPlayer.name}
                  </span>
                  {selectedPlayer.country && (
                    <span className="text-xs">
                      {AOE4WorldAPI.getCountryFlag(selectedPlayer.country)}
                    </span>
                  )}
                </div>
                <a
                  href={selectedPlayer.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  View Profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* 1v1 Ranked */}
              {selectedPlayer.modes.rm_solo &&
                selectedPlayer.modes.rm_solo.rating > 0 && (
                  <div className="space-y-2 border-t border-border/50 pt-3">
                    <h3 className="font-semibold text-sm">1v1 Ranked</h3>
                    <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/5 rounded-lg p-3 border border-blue-500/10">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                            Rating
                          </div>
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <RankBadge
                              rankLevel={
                                selectedPlayer.modes.rm_solo.rank_level
                              }
                              size="sm"
                              showLabel={false}
                            />
                            <div className="text-2xl font-bold text-blue-400">
                              {selectedPlayer.modes.rm_solo.rating}
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground/50">
                            Peak: {selectedPlayer.modes.rm_solo.max_rating}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                            Win Rate
                          </div>
                          <div className="text-2xl font-bold text-green-400 mb-1">
                            {AOE4WorldAPI.formatWinRate(
                              selectedPlayer.modes.rm_solo.win_rate,
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground/50">
                            <span className="text-green-400">
                              {selectedPlayer.modes.rm_solo.wins_count}W
                            </span>
                            <span className="mx-1">-</span>
                            <span className="text-red-400">
                              {selectedPlayer.modes.rm_solo.losses_count}L
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                            Games
                          </div>
                          <div className="text-2xl font-bold mb-1">
                            {selectedPlayer.modes.rm_solo.games_count}
                          </div>
                          {selectedPlayer.modes.rm_solo.rank && (
                            <div className="text-[10px] text-muted-foreground/50">
                              Rank #
                              {selectedPlayer.modes.rm_solo.rank.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Team Ranked */}
              {selectedPlayer.modes.rm_team &&
                selectedPlayer.modes.rm_team.rating > 0 && (
                  <div className="space-y-2 border-t border-border/50 pt-3">
                    <h3 className="font-semibold text-sm">Team Ranked</h3>
                    <div className="bg-gradient-to-br from-purple-500/5 to-purple-600/5 rounded-lg p-3 border border-purple-500/10">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                            Rating
                          </div>
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <RankBadge
                              rankLevel={
                                selectedPlayer.modes.rm_team.rank_level
                              }
                              size="sm"
                              showLabel={false}
                            />
                            <div className="text-2xl font-bold text-purple-400">
                              {selectedPlayer.modes.rm_team.rating}
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground/50">
                            Peak: {selectedPlayer.modes.rm_team.max_rating}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                            Win Rate
                          </div>
                          <div className="text-2xl font-bold text-green-400 mb-1">
                            {AOE4WorldAPI.formatWinRate(
                              selectedPlayer.modes.rm_team.win_rate,
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground/50">
                            <span className="text-green-400">
                              {selectedPlayer.modes.rm_team.wins_count}W
                            </span>
                            <span className="mx-1">-</span>
                            <span className="text-red-400">
                              {selectedPlayer.modes.rm_team.losses_count}L
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-wider">
                            Games
                          </div>
                          <div className="text-2xl font-bold mb-1">
                            {selectedPlayer.modes.rm_team.games_count}
                          </div>
                          {selectedPlayer.modes.rm_team.rank && (
                            <div className="text-[10px] text-muted-foreground/50">
                              Rank #
                              {selectedPlayer.modes.rm_team.rank.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Top Civilizations */}
              {primaryStats.civilizations &&
                primaryStats.civilizations.length > 0 && (
                  <div>
                    <div className="font-medium text-xs mb-1">Top Civs</div>
                    <div className="flex flex-wrap gap-1">
                      {primaryStats.civilizations.slice(0, 3).map((civ) => (
                        <span
                          key={civ.civilization}
                          className="text-xs px-2 py-1 bg-background rounded border border-border/50"
                        >
                          {civ.civilization
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}{" "}
                          ({AOE4WorldAPI.formatWinRate(civ.win_rate)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
