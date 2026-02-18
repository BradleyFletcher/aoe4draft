"use client";

import { type DraftState } from "@/lib/draft";

interface DraftTimelineProps {
  state: DraftState;
}

export default function DraftTimeline({ state }: DraftTimelineProps) {
  const { config } = state;
  const currentIndex = state.currentStepIndex;
  const total = config.steps.length;

  return (
    <div className="flex items-center gap-[3px]">
      {config.steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex && !state.completed;
        const isT1 = step.team === "team1";
        const isBan = step.action === "ban";

        return (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${
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
            title={`${i + 1}/${total} — ${step.team === "team1" ? config.team1Name : config.team2Name} ${step.action} ${step.target}${step.auto ? " (random)" : ""}`}
          />
        );
      })}
    </div>
  );
}
