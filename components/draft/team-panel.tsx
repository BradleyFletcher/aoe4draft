"use client";

import {
  type DraftConfig,
  type TeamKey,
  type TeamDraftData,
  getCivName,
  getCivFlag,
  getMapName,
} from "@/lib/draft";
import { Shield, Map as MapIcon } from "lucide-react";
import Image from "next/image";

interface TeamPanelProps {
  teamKey: TeamKey;
  teamName: string;
  players: { name: string }[];
  isActive: boolean;
  isMyTeam: boolean;
  myPlayerIndex: number | null;
  activePlayerIndex: number | null;
  teamData: TeamDraftData;
  config: DraftConfig;
}

export default function TeamPanel({
  teamKey,
  teamName,
  players,
  isActive,
  isMyTeam,
  myPlayerIndex,
  activePlayerIndex,
  teamData,
  config,
}: TeamPanelProps) {
  const isT1 = teamKey === "team1";

  // Build a per-player view: for each player, find their civ pick(s)
  const civPickSteps = config.steps.filter(
    (s) => s.action === "pick" && s.target === "civ" && s.team === teamKey,
  );
  const civBanSteps = config.steps.filter(
    (s) => s.action === "ban" && s.target === "civ" && s.team === teamKey,
  );
  const mapPickSteps = config.steps.filter(
    (s) =>
      s.action === "pick" &&
      s.target === "map" &&
      s.team === teamKey &&
      !s.auto,
  );
  const mapBanSteps = config.steps.filter(
    (s) => s.action === "ban" && s.target === "map" && s.team === teamKey,
  );

  // Group civ picks by player index
  const playerCivs: Map<number, string[]> = new Map();
  civPickSteps.forEach((step, i) => {
    const pIdx = step.playerIndex ?? 0;
    if (!playerCivs.has(pIdx)) playerCivs.set(pIdx, []);
    const civId = teamData.civPicks[i];
    if (civId) playerCivs.get(pIdx)!.push(civId);
  });

  // Count expected picks per player
  const playerExpectedPicks: Map<number, number> = new Map();
  civPickSteps.forEach((step) => {
    const pIdx = step.playerIndex ?? 0;
    playerExpectedPicks.set(pIdx, (playerExpectedPicks.get(pIdx) ?? 0) + 1);
  });

  // Collect all bans
  const allBans: { id: string | null; type: "civ" | "map" }[] = [
    ...Array.from({ length: civBanSteps.length }, (_, i) => ({
      id: teamData.civBans[i] ?? null,
      type: "civ" as const,
    })),
    ...Array.from({ length: mapBanSteps.length }, (_, i) => ({
      id: teamData.mapBans[i] ?? null,
      type: "map" as const,
    })),
  ];

  return (
    <div
      className={`rounded-xl p-4 transition-all ${
        isActive
          ? isT1
            ? "bg-card border border-blue-500/30"
            : "bg-card border border-red-500/30"
          : "bg-card border border-border/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            isActive
              ? isT1
                ? "bg-blue-400 animate-pulse"
                : "bg-red-400 animate-pulse"
              : "bg-muted-foreground/30"
          }`}
        />
        <h3
          className={`font-bold text-lg tracking-tight ${
            isT1 ? "text-blue-400" : "text-red-400"
          }`}
        >
          {teamName}
        </h3>
        {isMyTeam && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
            YOU
          </span>
        )}
      </div>

      {/* Players with their civ flags */}
      <div className="space-y-2 mb-4">
        {players.map((player, pIdx) => {
          const civs = playerCivs.get(pIdx) ?? [];
          const expected = playerExpectedPicks.get(pIdx) ?? 1;
          const isMe = isMyTeam && myPlayerIndex === pIdx;
          const isActivePlayer = activePlayerIndex === pIdx;

          return (
            <div
              key={pIdx}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActivePlayer
                  ? isT1
                    ? "ring-1 ring-blue-400/40 bg-blue-500/8 animate-pulse"
                    : "ring-1 ring-red-400/40 bg-red-500/8 animate-pulse"
                  : isMe
                    ? isT1
                      ? "ring-1 ring-blue-500/20 bg-blue-500/5"
                      : "ring-1 ring-red-500/20 bg-red-500/5"
                    : "ring-1 ring-border/10"
              }`}
            >
              {/* Civ flag(s) or placeholder */}
              <div className="flex -space-x-2 shrink-0">
                {civs.length > 0
                  ? civs.map((civId, ci) => {
                      const flag = getCivFlag(civId);
                      return flag ? (
                        <Image
                          key={ci}
                          src={flag}
                          alt={getCivName(civId)}
                          width={88}
                          height={88}
                          className={`w-11 h-11 rounded-full object-cover ring-2 ring-background animate-draft-reveal ${
                            ci > 0 ? "" : ""
                          }`}
                        />
                      ) : (
                        <div
                          key={ci}
                          className="w-11 h-11 rounded-full bg-secondary/30 ring-2 ring-background flex items-center justify-center animate-draft-reveal"
                        >
                          <span className="text-[10px] font-medium text-muted-foreground/60 truncate px-0.5">
                            {getCivName(civId).slice(0, 3)}
                          </span>
                        </div>
                      );
                    })
                  : Array.from({ length: expected }).map((_, ci) => (
                      <div
                        key={ci}
                        className={`w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center ring-2 ring-background ${
                          isT1 ? "border-blue-500/15" : "border-red-500/15"
                        }`}
                      >
                        <span className="text-[10px] text-muted-foreground/20">
                          ?
                        </span>
                      </div>
                    ))}
              </div>

              {/* Player name + civ name */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold truncate ${isMe ? (isT1 ? "text-blue-300" : "text-red-300") : ""}`}
                >
                  {player.name}
                  {isMe ? " (you)" : ""}
                </p>
                {civs.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/60 truncate">
                    {civs.map((id) => getCivName(id)).join(", ")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Map Picks */}
      {mapPickSteps.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapIcon className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
              Maps
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: mapPickSteps.length }).map((_, i) => {
              const id = teamData.mapPicks[i];
              const filled = !!id;
              return (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filled
                      ? isT1
                        ? "bg-blue-500/5 ring-1 ring-blue-500/15 animate-draft-reveal"
                        : "bg-red-500/5 ring-1 ring-red-500/15 animate-draft-reveal"
                      : "ring-1 ring-border/15 text-muted-foreground/25"
                  }`}
                >
                  {filled ? getMapName(id) : "—"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Bans — compact row */}
      {allBans.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
              Bans
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allBans.map((ban, i) => {
              const filled = !!ban.id;
              const isCiv = ban.type === "civ";
              const flag = filled && isCiv ? getCivFlag(ban.id!) : undefined;
              const name = filled
                ? isCiv
                  ? getCivName(ban.id!)
                  : getMapName(ban.id!)
                : null;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
                    filled
                      ? "bg-red-500/5 ring-1 ring-red-500/15 animate-draft-ban"
                      : "ring-1 ring-border/10"
                  }`}
                >
                  {filled && flag ? (
                    <Image
                      src={flag}
                      alt={name ?? ""}
                      width={48}
                      height={48}
                      className="w-[18px] h-[18px] rounded-full object-cover shrink-0 grayscale opacity-40"
                    />
                  ) : !filled ? (
                    <div className="w-[18px] h-[18px] rounded-full border border-dashed border-red-500/15 shrink-0" />
                  ) : null}
                  <span
                    className={`text-[11px] ${
                      filled
                        ? "text-muted-foreground/50 line-through"
                        : "text-muted-foreground/20"
                    }`}
                  >
                    {name ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
