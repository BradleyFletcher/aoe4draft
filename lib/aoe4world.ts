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
}

export interface AutocompleteResponse {
  query: string;
  leaderboard: string;
  count: number;
  players: AOE4Player[];
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
}
