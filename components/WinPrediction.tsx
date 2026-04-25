import { useEffect, useState } from "react";
import { AOE4WorldAPI, type HeadToHeadStats } from "@/lib/aoe4world";

interface WinPredictionProps {
  player1: {
    name: string;
    profileId: number;
    rating: number;
  } | null;
  player2: {
    name: string;
    profileId: number;
    rating: number;
  } | null;
  gameMode?: "rm_solo" | "rm_team";
}

export default function WinPrediction({
  player1,
  player2,
  gameMode = "rm_solo",
}: WinPredictionProps) {
  const [loading, setLoading] = useState(false);
  const [h2h1v1, setH2h1v1] = useState<HeadToHeadStats | null>(null);
  const [h2hTeam, setH2hTeam] = useState<HeadToHeadStats | null>(null);
  const [prediction, setPrediction] = useState<number | null>(null);

  useEffect(() => {
    if (!player1 || !player2) {
      setH2h1v1(null);
      setH2hTeam(null);
      setPrediction(null);
      return;
    }

    const fetchHeadToHead = async () => {
      setLoading(true);
      try {
        // Fetch ALL games between the two players
        const allGames = await AOE4WorldAPI.getHeadToHeadGames(
          player1.profileId,
          player2.profileId,
          undefined, // No filter = all games
        );

        // Filter for 1v1 games (rm_1v1 or qm_1v1)
        const games1v1 = allGames.filter(
          (game) => game.kind === "rm_1v1" || game.kind === "qm_1v1",
        );

        const stats1v1 = AOE4WorldAPI.calculateHeadToHeadStats(
          games1v1,
          player1.profileId,
          player2.profileId,
        );
        setH2h1v1(stats1v1);

        // Filter for team games (2v2, 3v3, 4v4)
        const teamGames = allGames.filter(
          (game) => game.kind !== "rm_1v1" && game.kind !== "qm_1v1",
        );

        const statsTeam = AOE4WorldAPI.calculateHeadToHeadStats(
          teamGames,
          player1.profileId,
          player2.profileId,
        );
        setH2hTeam(statsTeam);

        // Use combined stats for prediction
        const combinedStats = {
          totalGames: stats1v1.totalGames + statsTeam.totalGames,
          player1Wins: stats1v1.player1Wins + statsTeam.player1Wins,
          player2Wins: stats1v1.player2Wins + statsTeam.player2Wins,
          winRate:
            stats1v1.totalGames + statsTeam.totalGames > 0
              ? ((stats1v1.player1Wins + statsTeam.player1Wins) /
                  (stats1v1.totalGames + statsTeam.totalGames)) *
                100
              : 50,
        };

        const winPrediction = AOE4WorldAPI.calculateWinPrediction(
          player1.rating,
          player2.rating,
          combinedStats.totalGames > 0 ? combinedStats : undefined,
        );

        setPrediction(winPrediction);
      } catch (error) {
        console.error("Failed to fetch head-to-head data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHeadToHead();
  }, [player1, player2, gameMode]);

  if (!player1 || !player2) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="text-center text-sm text-muted-foreground">
          Calculating win prediction...
        </div>
      </div>
    );
  }

  if (prediction === null) {
    return null;
  }

  const player1Chance = prediction;
  const player2Chance = 100 - prediction;

  return (
    <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-border/50 rounded-lg p-3 space-y-3">
      <h3 className="font-semibold text-sm text-center text-muted-foreground/80">
        Win Prediction
      </h3>

      {/* Prediction Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span>{player1.name}</span>
          <span>{player2.name}</span>
        </div>
        <div className="relative h-6 bg-secondary/50 rounded-md overflow-hidden border border-border/30">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400/80 to-blue-500/80 transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${player1Chance}%` }}
          >
            {player1Chance > 20 && (
              <span className="text-xs font-bold text-white drop-shadow">
                {player1Chance.toFixed(0)}%
              </span>
            )}
          </div>
          <div
            className="absolute right-0 top-0 h-full bg-gradient-to-l from-red-400/80 to-red-500/80 transition-all duration-500 flex items-center justify-start pl-2"
            style={{ width: `${player2Chance}%` }}
          >
            {player2Chance > 20 && (
              <span className="text-xs font-bold text-white drop-shadow">
                {player2Chance.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Head-to-Head Records - Always show breakdown */}
      <div className="border-t border-border/50 pt-2 space-y-2">
        <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider text-center">
          Head-to-Head
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* 1v1 Stats */}
          <div className="text-center bg-secondary/20 rounded-md p-2 border border-border/30">
            <div className="text-[10px] text-muted-foreground/60 mb-1 font-medium">
              1v1
            </div>
            {h2h1v1 && h2h1v1.totalGames > 0 ? (
              <>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="text-lg font-bold text-blue-400">
                    {h2h1v1.player1Wins}
                  </div>
                  <div className="text-muted-foreground/30 text-xs">-</div>
                  <div className="text-lg font-bold text-red-400">
                    {h2h1v1.player2Wins}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {h2h1v1.totalGames} game{h2h1v1.totalGames !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground/40 py-1">—</div>
            )}
          </div>

          {/* Team Stats */}
          <div className="text-center bg-secondary/20 rounded-md p-2 border border-border/30">
            <div className="text-[10px] text-muted-foreground/60 mb-1 font-medium">
              Team
            </div>
            {h2hTeam && h2hTeam.totalGames > 0 ? (
              <>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="text-lg font-bold text-blue-400">
                    {h2hTeam.player1Wins}
                  </div>
                  <div className="text-muted-foreground/30 text-xs">-</div>
                  <div className="text-lg font-bold text-red-400">
                    {h2hTeam.player2Wins}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {h2hTeam.totalGames} game{h2hTeam.totalGames !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground/40 py-1">—</div>
            )}
          </div>
        </div>

        {/* Info message if no opponent games found */}
        {(h2h1v1?.totalGames || 0) + (h2hTeam?.totalGames || 0) === 0 && (
          <div className="text-center text-[10px] text-muted-foreground/50 italic mt-1">
            Players have not faced each other as opponents
          </div>
        )}
      </div>
    </div>
  );
}
