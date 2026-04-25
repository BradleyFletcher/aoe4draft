// AOE4 World API integration service

export interface AOE4Player {
  name: string;
  profile_id: number;
  steam_id: string;
  site_url: string;
  avatars: {
    small: string | null;
    medium: string | null;
    full: string | null;
  };
  country: string;
  rating?: number;
  rank?: number;
  rank_level?: string | null;
  streak?: number;
  games_count?: number;
  wins_count?: number;
  losses_count?: number;
  last_game_at?: string;
  win_rate?: number;
}

export interface AOE4PlayerStats {
  name: string;
  profile_id: number;
  steam_id: string;
  site_url: string;
  avatars: {
    small: string | null;
    medium: string | null;
    full: string | null;
  };
  country: string;
  social: Record<string, any>;
  modes: {
    rm_solo?: PlayerModeStats;
    rm_1v1_elo?: PlayerModeStats; // Legacy field for backward compatibility
    qm_1v1?: PlayerModeStats;
    rm_team?: PlayerModeStats;
    qm_2v2?: PlayerModeStats;
    qm_3v3?: PlayerModeStats;
    qm_4v4?: PlayerModeStats;
  };
}

export interface PlayerModeStats {
  rating: number;
  max_rating: number;
  max_rating_7d: number;
  max_rating_1m: number;
  rank: number;
  rank_level: string | null;
  streak: number;
  games_count: number;
  wins_count: number;
  losses_count: number;
  disputes_count: number;
  drops_count: number;
  last_game_at: string;
  win_rate: number;
  rating_history?: Record<
    string,
    {
      rating: number;
      streak: number;
      wins_count: number;
      drops_count: number;
      disputes_count: number;
      games_count: number;
    }
  >;
  season?: number;
  civilizations?: Array<{
    civilization: string;
    win_rate: number;
    pick_rate: number;
    games_count: number;
  }>;
  maps?: Array<{
    map: string;
    win_rate: number;
    games_count: number;
    wins_count: number;
    losses_count: number;
  }>;
}

export interface AutocompleteResponse {
  query: string;
  leaderboard: string;
  count: number;
  players: AOE4Player[];
}

export interface GamePlayerData {
  profile_id: number;
  name: string;
  civilization: string;
  rating: number;
  result: "win" | "loss";
}

export interface GamePlayer {
  player: GamePlayerData;
}

export interface Game {
  game_id: number;
  started_at: string;
  updated_at: string;
  duration: number;
  map: string;
  kind: string;
  leaderboard: string;
  season: number;
  server: string;
  patch: number;
  average_rating: number;
  ongoing: boolean;
  just_finished: boolean;
  teams: GamePlayer[][];
}

export interface GamesResponse {
  count: number;
  games: Game[];
}

export interface HeadToHeadStats {
  totalGames: number; // Only games where they were on opposite teams
  player1Wins: number;
  player2Wins: number;
  winRate: number; // Player 1's win rate against Player 2
}

const AOE4_WORLD_API_BASE = "https://aoe4world.com/api/v0";

export class AOE4WorldAPI {
  private static async fetchAPI<T>(endpoint: string): Promise<T | null> {
    try {
      const response = await fetch(`${AOE4_WORLD_API_BASE}${endpoint}`);
      if (!response.ok) {
        console.warn(
          `AOE4 World API error: ${response.status} ${response.statusText}`,
        );
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("Failed to fetch AOE4 World API:", error);
      return null;
    }
  }

  /**
   * Search for players by name with autocomplete
   */
  static async searchPlayers(
    query: string,
    leaderboard:
      | "qm_1v1"
      | "rm_solo"
      | "rm_team"
      | "qm_2v2"
      | "qm_3v3"
      | "qm_4v4" = "qm_1v1",
    limit: number = 10,
  ): Promise<AOE4Player[]> {
    if (query.length < 3) return [];

    const response = await this.fetchAPI<AutocompleteResponse>(
      `/players/autocomplete?leaderboard=${leaderboard}&query=${encodeURIComponent(query)}&limit=${limit}`,
    );

    return response?.players || [];
  }

  /**
   * Get detailed player stats by profile ID
   */
  static async getPlayerStats(
    profileId: number,
  ): Promise<AOE4PlayerStats | null> {
    return this.fetchAPI<AOE4PlayerStats>(`/players/${profileId}`);
  }

  /**
   * Get player's primary rating (QM 1v1 preferred, fallback to RM Solo)
   */
  static getPrimaryRating(stats: AOE4PlayerStats): PlayerModeStats | null {
    return stats.modes.qm_1v1 || stats.modes.rm_solo || null;
  }

  /**
   * Format rating with rank level
   */
  static formatRating(modeStats: PlayerModeStats): string {
    const rankLevel = modeStats.rank_level
      ? modeStats.rank_level
          .replace("_", " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
      : "Unranked";
    return `${modeStats.rating} (${rankLevel})`;
  }

  /**
   * Format win rate as percentage
   */
  static formatWinRate(winRate: number | null | undefined): string {
    if (winRate === null || winRate === undefined) {
      return "N/A";
    }
    return `${winRate.toFixed(1)}%`;
  }

  /**
   * Get country flag emoji from country code
   */
  static getCountryFlag(countryCode: string): string {
    const flags: Record<string, string> = {
      us: "🇺🇸",
      ca: "🇨🇦",
      mx: "🇲🇽",
      br: "🇧🇷",
      gb: "🇬🇧",
      de: "🇩🇪",
      fr: "🇫🇷",
      es: "🇪🇸",
      it: "🇮🇹",
      nl: "🇳🇱",
      se: "🇸🇪",
      no: "🇳🇴",
      dk: "🇩🇰",
      fi: "🇫🇮",
      pl: "🇵🇱",
      cz: "🇨🇿",
      ru: "🇷🇺",
      ua: "🇺🇦",
      cn: "🇨🇳",
      jp: "🇯🇵",
      kr: "🇰🇷",
      au: "🇦🇺",
      nz: "🇳🇿",
      in: "🇮🇳",
      th: "🇹🇭",
      vn: "🇻🇳",
      sg: "🇸🇬",
      my: "🇲🇾",
      ph: "🇵🇭",
      id: "🇮🇩",
      hk: "🇭🇰",
      tw: "🇹🇼",
      ar: "🇦🇷",
      cl: "🇨🇱",
      co: "🇨🇴",
      pe: "🇵🇪",
      uy: "🇺🇾",
      za: "🇿🇦",
      eg: "🇪🇬",
      ma: "🇲🇦",
      ng: "🇳🇬",
      ke: "🇰🇪",
      tr: "🇹🇷",
      sa: "🇸🇦",
      ae: "🇦🇪",
      il: "🇮🇱",
    };
    return flags[countryCode.toLowerCase()] || "";
  }

  /**
   * Get head-to-head games between two players
   * @param leaderboard - Optional filter (rm_solo, rm_team, etc). If undefined, fetches ALL games including custom.
   */
  static async getHeadToHeadGames(
    player1ProfileId: number,
    player2ProfileId: number,
    leaderboard?: string,
    limit: number = 200,
  ): Promise<Game[]> {
    const leaderboardParam = leaderboard ? `&leaderboard=${leaderboard}` : "";
    const response = await this.fetchAPI<GamesResponse>(
      `/players/${player1ProfileId}/games?opponent_profile_id=${player2ProfileId}${leaderboardParam}&limit=${limit}`,
    );
    return response?.games || [];
  }

  /**
   * Calculate head-to-head statistics
   * Only counts games where players are on OPPOSITE teams
   */
  static calculateHeadToHeadStats(
    games: Game[],
    player1ProfileId: number,
    player2ProfileId: number,
  ): HeadToHeadStats {
    let player1Wins = 0;
    let player2Wins = 0;

    games.forEach((game, index) => {
      // Find which teams each player is on
      let player1Team = -1;
      let player2Team = -1;
      let player1Result: string | null = null;

      game.teams.forEach((team, teamIndex) => {
        team.forEach((p) => {
          if (p.player.profile_id === player1ProfileId) {
            player1Team = teamIndex;
            player1Result = p.player.result;
          }
          if (p.player.profile_id === player2ProfileId) {
            player2Team = teamIndex;
          }
        });
      });

      // Only count if they're on opposite teams
      if (
        player1Team !== -1 &&
        player2Team !== -1 &&
        player1Team !== player2Team
      ) {
        if (player1Result === "win") {
          player1Wins++;
        } else {
          player2Wins++;
        }
      }
    });

    const totalGames = player1Wins + player2Wins;
    const winRate = totalGames > 0 ? (player1Wins / totalGames) * 100 : 50;

    return {
      totalGames,
      player1Wins,
      player2Wins,
      winRate,
    };
  }

  /**
   * Calculate win prediction using ELO and head-to-head data
   */
  static calculateWinPrediction(
    player1Rating: number,
    player2Rating: number,
    headToHeadStats?: HeadToHeadStats,
  ): number {
    // ELO-based probability (60% weight)
    const ratingDiff = player1Rating - player2Rating;
    const eloProbability = 1 / (1 + Math.pow(10, -ratingDiff / 400));
    let prediction = eloProbability * 0.6;

    // Head-to-head record (30% weight) - if they've played before
    if (headToHeadStats && headToHeadStats.totalGames > 0) {
      const h2hProbability = headToHeadStats.winRate / 100;
      prediction += h2hProbability * 0.3;
    } else {
      // If no H2H, give more weight to ELO
      prediction += eloProbability * 0.3;
    }

    // Recent form could go here (10% weight) - for now, use ELO
    prediction += eloProbability * 0.1;

    // Convert to percentage and clamp between 5-95%
    return Math.max(5, Math.min(95, prediction * 100));
  }
}
