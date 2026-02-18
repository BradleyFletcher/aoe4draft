"use client";

import {
  type DraftState,
  type DraftStep,
  getCivName,
  getCivFlag,
  getMapName,
  getStepActorName,
} from "@/lib/draft";
import { Shield, Crown, Map, Dice5 } from "lucide-react";
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

  // Count how many steps of the same type/target/team precede this one
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
    const arr = step.action === "ban" ? teamData.civBans : teamData.civPicks;
    return arr[count] ?? null;
  } else {
    const arr = step.action === "ban" ? teamData.mapBans : teamData.mapPicks;
    return arr[count] ?? null;
  }
}

function StepIcon({
  action,
  target,
  auto,
}: {
  action: string;
  target: string;
  auto?: boolean;
}) {
  if (auto) return <Dice5 className="w-3 h-3" />;
  if (target === "map") return <Map className="w-3 h-3" />;
  if (action === "ban") return <Shield className="w-3 h-3" />;
  return <Crown className="w-3 h-3" />;
}

export default function DraftTimeline({ state }: DraftTimelineProps) {
  const { config } = state;
  const currentIndex = state.currentStepIndex;

  return (
    <div className="w-full pb-2">
      <div
        className="grid items-start gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${config.steps.length}, minmax(0, 1fr))`,
        }}
      >
        {config.steps.map((step, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex && !state.completed;
          const isFuture = i > currentIndex;
          const itemId = isDone ? getStepItemId(state, i, step) : null;
          const isT1 = step.team === "team1";
          const isBan = step.action === "ban";
          const isMap = step.target === "map";
          const label = getStepActorName(config, step);

          // Resolved display
          const itemName = itemId
            ? isMap
              ? getMapName(itemId)
              : getCivName(itemId)
            : null;
          const itemFlag = itemId && !isMap ? getCivFlag(itemId) : undefined;

          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-0.5 transition-all min-w-0 ${
                isCurrent ? "animate-timeline-pulse" : ""
              }`}
            >
              {/* Step number + type badge */}
              <div
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  isCurrent
                    ? "text-primary"
                    : isDone
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground/30"
                }`}
              >
                {i + 1}
              </div>

              {/* Main cell */}
              <div
                className={`relative aspect-square w-full max-w-[80px] mx-auto rounded-lg flex flex-col items-center justify-center gap-0.5 text-center transition-all border ${
                  isCurrent
                    ? isBan
                      ? "border-red-500/50 bg-red-500/10 animate-draft-glow-red"
                      : "border-green-500/50 bg-green-500/10 animate-draft-glow-green"
                    : isDone
                      ? isBan
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-green-500/20 bg-green-500/5"
                      : "border-border/40 bg-secondary/20"
                }`}
              >
                {isDone && itemFlag ? (
                  <div
                    className={`animate-draft-reveal ${isBan ? "grayscale opacity-50" : ""}`}
                  >
                    <Image
                      src={itemFlag}
                      alt={itemName ?? ""}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  </div>
                ) : isDone && itemName ? (
                  <span
                    className={`text-[10px] font-medium px-1 truncate max-w-full ${isBan ? "line-through text-muted-foreground/50" : ""}`}
                  >
                    {itemName}
                  </span>
                ) : (
                  <StepIcon
                    action={step.action}
                    target={step.target}
                    auto={step.auto}
                  />
                )}

                {/* Ban slash overlay */}
                {isDone && isBan && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-[3px] bg-red-500/70 rotate-[-20deg] rounded-full" />
                  </div>
                )}
              </div>

              {/* Team + action label */}
              <div className="flex flex-col items-center gap-0">
                <span
                  className={`text-[9px] font-semibold ${
                    isT1 ? "text-blue-400/70" : "text-red-400/70"
                  } ${isFuture ? "opacity-40" : ""}`}
                >
                  {step.auto ? "Random" : label}
                </span>
                <span
                  className={`text-[8px] uppercase tracking-wider ${
                    step.auto
                      ? "text-yellow-400/50"
                      : isBan
                        ? "text-red-400/50"
                        : "text-green-400/50"
                  } ${isFuture ? "opacity-30" : ""}`}
                >
                  {isBan ? "Ban" : "Pick"} {isMap ? "Map" : "Civ"}
                </span>
              </div>

              {/* Resolved name below */}
              {isDone && itemName && (
                <span
                  className={`text-[9px] font-medium truncate max-w-full ${isBan ? "text-muted-foreground/40 line-through" : "text-foreground/70"}`}
                >
                  {itemName}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
