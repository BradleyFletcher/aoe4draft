"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { civilizations } from "@/data/civilizations";
import { maps } from "@/data/maps";
import {
  type DraftState,
  type TeamKey,
  type DraftConfig,
  type TeamDraftData,
  decodeDraftConfig,
  createInitialDraftState,
  getCurrentStep,
  getAvailableCivs,
  getAvailableMaps,
  applyAction,
  getCivName,
  getCivFlag,
  getMapName,
  getStepActorName,
  getTeamFromRole,
} from "@/lib/draft";
import { ArrowLeft, RotateCcw, CheckCircle2, Undo2 } from "lucide-react";
import Link from "next/link";

function TeamPanel({
  teamKey,
  teamName,
  players,
  isActive,
  isMyTeam,
  myPlayerIndex,
  teamData,
  config,
}: {
  teamKey: TeamKey;
  teamName: string;
  players: { name: string }[];
  isActive: boolean;
  isMyTeam: boolean;
  myPlayerIndex: number | null;
  teamData: TeamDraftData;
  config: DraftConfig;
}) {
  const isT1 = teamKey === "team1";
  const hasCivPicks = teamData.civPicks.length > 0;
  const hasCivBans = teamData.civBans.length > 0;
  const hasMapPicks = teamData.mapPicks.length > 0;
  const hasMapBans = teamData.mapBans.length > 0;
  const hasAny = hasCivPicks || hasCivBans || hasMapPicks || hasMapBans;

  // Map each civ pick index to the playerIndex from the draft steps
  const civPickPlayerIndices: (number | undefined)[] = config.steps
    .filter(
      (s) => s.action === "pick" && s.target === "civ" && s.team === teamKey,
    )
    .map((s) => s.playerIndex);

  return (
    <div
      className={`rounded-xl p-4 transition-all ${
        isActive
          ? isT1
            ? "bg-blue-950/20 ring-2 ring-blue-500/50"
            : "bg-purple-950/20 ring-2 ring-purple-500/50"
          : "bg-card border border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-2 h-2 rounded-full ${isActive ? (isT1 ? "bg-blue-400 animate-pulse" : "bg-purple-400 animate-pulse") : "bg-muted-foreground/30"}`}
        />
        <h3
          className={`text-sm font-semibold ${isT1 ? "text-blue-400" : "text-purple-400"}`}
        >
          {teamName}
        </h3>
        {isMyTeam && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
            YOU
          </span>
        )}
      </div>

      {config.teamSize > 1 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {players.map((p, i) => (
            <span
              key={i}
              className={`text-[11px] px-1.5 py-0.5 rounded ${
                isMyTeam && myPlayerIndex === i
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {p.name}
              {isMyTeam && myPlayerIndex === i ? " (you)" : ""}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {hasCivPicks && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
              Picks
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {teamData.civPicks.map((id, i) => (
                <div
                  key={`${id}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 bg-green-500/10 rounded-lg ring-1 ring-green-500/20"
                >
                  {getCivFlag(id) && (
                    <img
                      src={getCivFlag(id)}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-green-500/30"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {getCivName(id)}
                    </p>
                    {config.teamSize > 1 &&
                      civPickPlayerIndices[i] !== undefined &&
                      players[civPickPlayerIndices[i]!] && (
                        <p className="text-[11px] text-muted-foreground">
                          {players[civPickPlayerIndices[i]!].name}
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasCivBans && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
              Bans
            </p>
            <div className="flex flex-wrap gap-2">
              {teamData.civBans.map((id, i) => (
                <div
                  key={`${id}-${i}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-red-500/10 rounded-lg ring-1 ring-red-500/20"
                >
                  {getCivFlag(id) && (
                    <img
                      src={getCivFlag(id)}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0 grayscale opacity-60"
                    />
                  )}
                  <span className="text-xs text-muted-foreground line-through">
                    {getCivName(id)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasMapPicks && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
              Map Picks
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teamData.mapPicks.map((id, i) => (
                <span
                  key={`${id}-${i}`}
                  className="px-3 py-1.5 bg-green-500/10 rounded-lg ring-1 ring-green-500/20 text-sm font-medium"
                >
                  {getMapName(id)}
                </span>
              ))}
            </div>
          </div>
        )}
        {hasMapBans && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
              Map Bans
            </p>
            <div className="flex flex-wrap gap-1.5">
              {teamData.mapBans.map((id, i) => (
                <span
                  key={`${id}-${i}`}
                  className="px-3 py-1.5 bg-red-500/10 rounded-lg ring-1 ring-red-500/20 text-xs text-muted-foreground line-through"
                >
                  {getMapName(id)}
                </span>
              ))}
            </div>
          </div>
        )}
        {!hasAny && (
          <p className="text-xs text-muted-foreground/50">No actions yet</p>
        )}
      </div>
    </div>
  );
}

async function saveDraftToServer(
  seed: string,
  state: DraftState,
  history: DraftState[],
) {
  if (!seed) return;
  try {
    await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, state, history }),
    });
  } catch {
    /* network error */
  }
}

async function loadDraftFromServer(seed: string): Promise<{
  state: DraftState;
  history: DraftState[];
  version: number;
} | null> {
  if (!seed) return null;
  try {
    const res = await fetch(`/api/draft?seed=${encodeURIComponent(seed)}`);
    const data = await res.json();
    if (data.exists && data.state) return data;
    return null;
  } catch {
    return null;
  }
}

async function deleteDraftFromServer(seed: string) {
  if (!seed) return;
  try {
    await fetch(`/api/draft?seed=${encodeURIComponent(seed)}`, {
      method: "DELETE",
    });
  } catch {
    /* ignore */
  }
}

function DraftContent() {
  const searchParams = useSearchParams();
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [history, setHistory] = useState<DraftState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>("spectator");
  const [seed, setSeed] = useState<string>("");

  const versionRef = useRef(0);
  const lastActionRef = useRef(0);

  useEffect(() => {
    const roleParam = searchParams.get("role") ?? "spectator";
    setRole(roleParam);

    const seedParam = searchParams.get("seed") ?? "";
    setSeed(seedParam);

    if (!seedParam) {
      setError("No draft seed found. Please use a valid draft link.");
      return;
    }

    // Load draft state from server (config is stored there)
    loadDraftFromServer(seedParam).then((saved) => {
      if (saved && saved.state && saved.state.config) {
        setDraftState(saved.state);
        setHistory(saved.history ?? []);
        versionRef.current = saved.version ?? 0;
      } else {
        // Fallback: try legacy config param in URL
        const configParam = searchParams.get("config");
        if (configParam) {
          const config = decodeDraftConfig(configParam);
          if (config) {
            const initial = createInitialDraftState(config);
            setDraftState(initial);
            setHistory([]);
            saveDraftToServer(seedParam, initial, []);
            return;
          }
        }
        setError(
          "Draft not found. It may have expired or the link is invalid.",
        );
      }
    });
  }, [searchParams]);

  // Poll server for updates from other players
  useEffect(() => {
    if (!seed) return;
    const interval = setInterval(async () => {
      // Skip polling for 3s after a local action to avoid race conditions
      if (Date.now() - lastActionRef.current < 3000) return;
      const saved = await loadDraftFromServer(seed);
      if (saved && saved.version > versionRef.current) {
        versionRef.current = saved.version;
        setDraftState(saved.state);
        setHistory(saved.history ?? []);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [seed]);

  const handleSelect = (itemId: string) => {
    if (!draftState) return;
    const currentStep = getCurrentStep(draftState);
    if (!currentStep) return;

    if (role === "spectator") return;

    const myTeam = getTeamFromRole(role);
    if (!myTeam || currentStep.team !== myTeam) return;

    if (currentStep.playerIndex !== undefined) {
      const myPlayerIndex = parseInt(role.split("_p")[1] ?? "-1");
      if (myPlayerIndex !== currentStep.playerIndex) return;
    }

    // Validate the item is actually available
    const available =
      currentStep.target === "civ"
        ? getAvailableCivs(draftState)
        : getAvailableMaps(draftState);
    if (!available.includes(itemId)) return;

    const newHistory = [...history, draftState];
    const newState = applyAction(draftState, itemId);
    setHistory(newHistory);
    setDraftState(newState);
    lastActionRef.current = Date.now();
    saveDraftToServer(seed, newState, newHistory).then(() => {
      // Sync version after save completes
      loadDraftFromServer(seed).then((saved) => {
        if (saved) versionRef.current = saved.version;
      });
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setDraftState(prev);
    lastActionRef.current = Date.now();
    saveDraftToServer(seed, prev, newHistory).then(() => {
      loadDraftFromServer(seed).then((saved) => {
        if (saved) versionRef.current = saved.version;
      });
    });
  };

  const handleReset = () => {
    if (!draftState) return;
    const fresh = createInitialDraftState(draftState.config);
    setDraftState(fresh);
    setHistory([]);
    lastActionRef.current = Date.now();
    deleteDraftFromServer(seed);
    versionRef.current = 0;
  };

  if (error) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          <p className="text-red-400 font-semibold mb-2">Error</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!draftState) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading draft...</p>
      </main>
    );
  }

  const currentStep = getCurrentStep(draftState);
  const availableCivs = getAvailableCivs(draftState);
  const availableMaps = getAvailableMaps(draftState);
  const config = draftState.config;
  const progress = draftState.completed
    ? 100
    : Math.round((draftState.currentStepIndex / config.steps.length) * 100);

  const myTeam = getTeamFromRole(role);
  const myPlayerIndex = role.includes("_p")
    ? parseInt(role.split("_p")[1])
    : null;

  const isMyTurn = (() => {
    if (role === "spectator" || !currentStep) return false;
    if (currentStep.team !== myTeam) return false;
    if (currentStep.playerIndex !== undefined && myPlayerIndex !== null) {
      return currentStep.playerIndex === myPlayerIndex;
    }
    return true;
  })();

  const isWaiting = role !== "spectator" && currentStep && !isMyTurn;
  const canInteract = role !== "spectator" && isMyTurn;

  const myDisplayName = (() => {
    if (role === "spectator") return "Spectator";
    if (!myTeam) return role;
    const team = myTeam === "team1" ? config.team1Players : config.team2Players;
    const teamName = myTeam === "team1" ? config.team1Name : config.team2Name;
    if (myPlayerIndex !== null && myPlayerIndex < team.length) {
      return team[myPlayerIndex].name;
    }
    return teamName;
  })();

  const actorName = currentStep ? getStepActorName(config, currentStep) : "";

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                {config.name}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {config.teamSize}v{config.teamSize} &middot; Step{" "}
                {Math.min(draftState.currentStepIndex + 1, config.steps.length)}
                /{config.steps.length}
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
              myTeam === "team1"
                ? "bg-blue-500/10 text-blue-400"
                : myTeam === "team2"
                  ? "bg-purple-500/10 text-purple-400"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {myDisplayName}
          </span>
        </div>

        {/* Progress */}
        <div className="w-full bg-secondary rounded-full h-1 mb-5">
          <div
            className="bg-primary h-1 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Turn Banner */}
        {!draftState.completed && currentStep && (
          <div
            className={`mb-5 rounded-xl px-5 py-4 text-center ${
              isMyTurn
                ? currentStep.action === "ban"
                  ? "bg-red-500/10 ring-1 ring-red-500/30"
                  : "bg-green-500/10 ring-1 ring-green-500/30"
                : "bg-card border border-border"
            }`}
          >
            {isMyTurn ? (
              <>
                <p className="text-lg font-bold mb-0.5">
                  {currentStep.action === "ban" ? "Ban" : "Pick"} a{" "}
                  {currentStep.target === "civ" ? "Civilization" : "Map"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your turn — select from below
                </p>
              </>
            ) : isWaiting ? (
              <p className="text-sm text-muted-foreground">
                Waiting for{" "}
                <span
                  className={
                    currentStep.team === "team1"
                      ? "text-blue-400 font-medium"
                      : "text-purple-400 font-medium"
                  }
                >
                  {actorName}
                </span>{" "}
                to {currentStep.action} a{" "}
                {currentStep.target === "civ" ? "civ" : "map"}...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span
                  className={
                    currentStep.team === "team1"
                      ? "text-blue-400 font-medium"
                      : "text-purple-400 font-medium"
                  }
                >
                  {actorName}
                </span>{" "}
                {currentStep.action === "ban" ? "bans" : "picks"} a{" "}
                {currentStep.target === "civ" ? "civ" : "map"}
              </p>
            )}
          </div>
        )}

        {draftState.completed && (
          <div className="mb-5 rounded-xl px-5 py-4 bg-green-500/10 ring-1 ring-green-500/30 text-center">
            <p className="text-sm font-semibold text-green-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Draft Complete
            </p>
          </div>
        )}

        {/* Team Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <TeamPanel
            teamKey="team1"
            teamName={config.team1Name}
            players={config.team1Players}
            isActive={!draftState.completed && currentStep?.team === "team1"}
            isMyTeam={myTeam === "team1"}
            myPlayerIndex={myTeam === "team1" ? myPlayerIndex : null}
            teamData={draftState.team1}
            config={config}
          />
          <TeamPanel
            teamKey="team2"
            teamName={config.team2Name}
            players={config.team2Players}
            isActive={!draftState.completed && currentStep?.team === "team2"}
            isMyTeam={myTeam === "team2"}
            myPlayerIndex={myTeam === "team2" ? myPlayerIndex : null}
            teamData={draftState.team2}
            config={config}
          />
        </div>

        {/* Selection Area */}
        {!draftState.completed && currentStep && (
          <div className={!canInteract ? "opacity-30 pointer-events-none" : ""}>
            {currentStep.target === "civ" ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {config.civPool.map((civId) => {
                  const civ = civilizations.find((c) => c.id === civId);
                  if (!civ) return null;
                  const isAvailable = availableCivs.includes(civId);
                  const isBanned =
                    draftState.team1.civBans.includes(civId) ||
                    draftState.team2.civBans.includes(civId);
                  const isPickedT1 = draftState.team1.civPicks.includes(civId);
                  const isPickedT2 = draftState.team2.civPicks.includes(civId);
                  const clickable = isAvailable && canInteract;

                  return (
                    <button
                      key={civId}
                      onClick={() => clickable && handleSelect(civId)}
                      disabled={!clickable}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all ${
                        clickable
                          ? currentStep.action === "ban"
                            ? "bg-card ring-1 ring-border hover:ring-red-500/60 hover:bg-red-500/10 cursor-pointer"
                            : "bg-card ring-1 ring-border hover:ring-green-500/60 hover:bg-green-500/10 cursor-pointer"
                          : isBanned
                            ? "opacity-20"
                            : isPickedT1 || isPickedT2
                              ? "opacity-30"
                              : "opacity-20"
                      }`}
                    >
                      {civ.flag && (
                        <img
                          src={civ.flag}
                          alt=""
                          className={`w-12 h-12 rounded-full object-cover shrink-0 ${
                            isBanned
                              ? "grayscale ring-2 ring-red-500/30"
                              : clickable
                                ? "ring-2 ring-border"
                                : "ring-2 ring-border"
                          }`}
                        />
                      )}
                      <div className="min-w-0 w-full">
                        <p className="text-xs font-medium truncate">
                          {civ.name}
                        </p>
                        {isBanned && (
                          <p className="text-[10px] text-red-400">Banned</p>
                        )}
                        {isPickedT1 && (
                          <p className="text-[10px] text-blue-400">
                            {config.team1Name}
                          </p>
                        )}
                        {isPickedT2 && (
                          <p className="text-[10px] text-purple-400">
                            {config.team2Name}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {config.mapPool.map((mapId) => {
                  const map = maps.find((m) => m.id === mapId);
                  if (!map) return null;
                  const isAvailable = availableMaps.includes(mapId);
                  const isBanned =
                    draftState.team1.mapBans.includes(mapId) ||
                    draftState.team2.mapBans.includes(mapId);
                  const isPickedT1 = draftState.team1.mapPicks.includes(mapId);
                  const isPickedT2 = draftState.team2.mapPicks.includes(mapId);
                  const clickable = isAvailable && canInteract;

                  return (
                    <button
                      key={mapId}
                      onClick={() => clickable && handleSelect(mapId)}
                      disabled={!clickable}
                      className={`p-2.5 rounded-xl text-left transition-all ${
                        clickable
                          ? currentStep.action === "ban"
                            ? "bg-card ring-1 ring-border hover:ring-red-500/60 hover:bg-red-500/10 cursor-pointer"
                            : "bg-card ring-1 ring-border hover:ring-green-500/60 hover:bg-green-500/10 cursor-pointer"
                          : isBanned
                            ? "opacity-20"
                            : isPickedT1 || isPickedT2
                              ? "opacity-30"
                              : "opacity-20"
                      }`}
                    >
                      <span className="text-xs font-medium truncate block">
                        {map.name}
                      </span>
                      {isBanned && (
                        <span className="text-[10px] text-red-400">Banned</span>
                      )}
                      {isPickedT1 && (
                        <span className="text-[10px] text-blue-400">
                          {config.team1Name}
                        </span>
                      )}
                      {isPickedT2 && (
                        <span className="text-[10px] text-purple-400">
                          {config.team2Name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="gap-1.5 text-xs h-8"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs h-8 text-muted-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function DraftPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading draft...</p>
        </main>
      }
    >
      <DraftContent />
    </Suspense>
  );
}
