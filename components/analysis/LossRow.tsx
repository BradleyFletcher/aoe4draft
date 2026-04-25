import { ChevronDown, ChevronUp } from "lucide-react";
import type { Game } from "@/lib/aoe4world";
import { titleCase, formatDuration } from "./helpers";

export function LossRow({
  game,
  myCiv,
  oppCiv,
  ratingDiff,
  expanded,
  onToggle,
}: {
  game: Game;
  myCiv: string;
  oppCiv: string;
  ratingDiff: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(game.started_at).toLocaleDateString();
  const minutes = Math.floor(game.duration / 60);
  return (
    <div className="rounded-lg bg-background/40 border border-border/40 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-background/60 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-md bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-sm font-bold">
            L
          </div>
          <div>
            <div className="text-xs font-medium">
              {titleCase(myCiv)} {oppCiv && <span className="text-muted-foreground">vs {titleCase(oppCiv)}</span>}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {game.map} • {date} • {formatDuration(game.duration)}
              {ratingDiff !== 0 && (
                <span className="text-red-400 ml-1">
                  ({ratingDiff > 0 ? "+" : ""}
                  {ratingDiff})
                </span>
              )}
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border/40 p-3 space-y-2 bg-background/30">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                Duration
              </div>
              <div className="font-medium">{formatDuration(game.duration)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">
                Rating Change
              </div>
              <div className="font-medium text-red-400">{ratingDiff}</div>
            </div>
          </div>
          <div className="text-xs space-y-1 pt-2 border-t border-border/30">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Analysis
            </div>
            <div>
              •{" "}
              {minutes > 30
                ? "Long macro game — may indicate struggle with late-game composition"
                : minutes > 15
                  ? "Mid-length game — likely lost to timing attack or tech transition"
                  : "Short game — early aggression or rush loss"}
            </div>
            <div>
              • Rating loss of {Math.abs(ratingDiff)}{" "}
              {Math.abs(ratingDiff) > 15
                ? "— significant, opponent may have been lower rated"
                : "— expected loss"}
            </div>
            {oppCiv && (
              <div>
                • {titleCase(myCiv)} vs {titleCase(oppCiv)} — review this matchup
              </div>
            )}
            <div>• Map: {game.map} — check your map-specific strategy</div>
          </div>
        </div>
      )}
    </div>
  );
}
