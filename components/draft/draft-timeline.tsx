"use client";

import {
  type DraftState,
  type DraftStep,
  getCivName,
  getCivFlag,
  getMapName,
  getStepActorName,
} from "@/lib/draft";
import Image from "next/image";

interface DraftTimelineProps {
  state: DraftState;
}

function getStepItemId(
  state: DraftState,
  stepIndex: number,
  step: DraftStep,
): string | null {
  const teamData = step.team === "team1" ? state.team1 : state.team2;
  let count = 0;
  for (let i = 0; i < stepIndex; i++) {
    const s = state.config.steps[i];
    if (
      s.action === step.action &&
      s.target === step.target &&
      s.team === step.team
    ) {
      count++;
    }
  }
  if (step.target === "civ") {
    return (
      (step.action === "ban" ? teamData.civBans : teamData.civPicks)[count] ??
      null
    );
  }
  return (
    (step.action === "ban" ? teamData.mapBans : teamData.mapPicks)[count] ??
    null
  );
}

export default function DraftTimeline({ state }: DraftTimelineProps) {
  const { config } = state;
  const currentIndex = state.currentStepIndex;

  // Group steps into phases for labels
  type Phase = { label: string; steps: { step: DraftStep; index: number }[] };
  const phases: Phase[] = [];
  let currentPhase: Phase | null = null;

  config.steps.forEach((step, i) => {
    const phaseLabel =
      step.action === "ban"
        ? step.target === "civ"
          ? "Civ Bans"
          : "Map Bans"
        : step.auto
          ? "Random"
          : step.target === "civ"
            ? "Civ Picks"
            : "Map Picks";

    if (!currentPhase || currentPhase.label !== phaseLabel) {
      currentPhase = { label: phaseLabel, steps: [] };
      phases.push(currentPhase);
    }
    currentPhase.steps.push({ step, index: i });
  });

  return (
    <div className="flex items-center gap-2">
      {phases.map((phase, pi) => (
        <div key={pi} className="flex-1 min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground/30 font-semibold mb-1 truncate">
            {phase.label}
          </p>
          <div className="flex items-center gap-[2px]">
            {phase.steps.map(({ step, index: i }) => {
              const isDone = i < currentIndex;
              const isCurrent = i === currentIndex && !state.completed;
              const isT1 = step.team === "team1";
              const isBan = step.action === "ban";
              const isMap = step.target === "map";
              const itemId = isDone ? getStepItemId(state, i, step) : null;
              const itemName = itemId
                ? isMap
                  ? getMapName(itemId)
                  : getCivName(itemId)
                : null;
              const itemFlag =
                itemId && !isMap ? getCivFlag(itemId) : undefined;
              const actorName = step.auto
                ? "Random"
                : getStepActorName(config, step);

              return (
                <div key={i} className="group relative flex-1">
                  <div
                    className={`h-2 w-full rounded-full transition-all group-hover:scale-y-150 ${
                      isCurrent
                        ? isBan
                          ? "bg-red-400 animate-pulse"
                          : step.auto
                            ? "bg-yellow-400 animate-pulse"
                            : "bg-green-400 animate-pulse"
                        : isDone
                          ? isBan
                            ? "bg-red-500/40"
                            : "bg-green-500/40"
                          : isT1
                            ? "bg-blue-500/15"
                            : "bg-red-500/15"
                    }`}
                  />

                  {/* Hover tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 pointer-events-none">
                    <div className="bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-[10px] whitespace-nowrap">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${isT1 ? "bg-blue-400" : "bg-red-400"}`}
                        />
                        <span className="font-semibold text-foreground">
                          {actorName}
                        </span>
                        <span
                          className={`uppercase font-bold tracking-wider ${
                            isBan
                              ? "text-red-400"
                              : step.auto
                                ? "text-yellow-400"
                                : "text-green-400"
                          }`}
                        >
                          {isBan ? "Ban" : "Pick"}
                        </span>
                      </div>
                      {isDone && itemName ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          {itemFlag && (
                            <Image
                              src={itemFlag}
                              alt={itemName}
                              width={48}
                              height={48}
                              className={`w-4 h-4 rounded-full object-cover ${isBan ? "grayscale opacity-60" : ""}`}
                            />
                          )}
                          <span
                            className={`font-medium ${isBan ? "line-through text-muted-foreground/60" : "text-foreground/80"}`}
                          >
                            {itemName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">
                          {isMap ? "Map" : "Civ"} —{" "}
                          {isCurrent ? "In progress" : "Pending"}
                        </span>
                      )}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
