"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  type DraftState,
  decodeDraftConfig,
  createInitialDraftState,
  getCurrentStep,
  getAvailableCivs,
  getAvailableMaps,
  applyAction,
  isAutoStep,
  getCivName,
  getCivFlag,
  getMapName,
  getStepActorName,
  getTeamFromRole,
  getTeamPlayers,
  getTeamName,
} from "@/lib/draft";
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Undo2,
  Swords,
  Dice5,
} from "lucide-react";
import Link from "next/link";
import TeamPanel from "@/components/draft/team-panel";
import DraftTimeline from "@/components/draft/draft-timeline";

// Validate role format: team1_p0-3, team2_p0-3, or spectator
const VALID_ROLE_RE = /^(team[12]_p[0-3]|spectator)$/;

async function saveDraftToServer(
  seed: string,
  state: DraftState,
  history: DraftState[],
): Promise<{ ok: boolean; version?: number }> {
  if (!seed) return { ok: false };
  try {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, state, history }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: !!data.ok, version: data.version };
  } catch {
    return { ok: false };
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
    if (!res.ok) return null;
    const data = await res.json();
    if (data.exists && data.state) return data;
    return null;
  } catch {
    return null;
  }
}

function DraftContent() {
  const searchParams = useSearchParams();
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [history, setHistory] = useState<DraftState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>("spectator");
  const [seed, setSeed] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Randomisation overlay state
  const [randomOverlay, setRandomOverlay] = useState<{
    phase: "shuffling" | "revealed";
    displayName: string;
    finalName: string;
    finalId: string;
    pool: string[];
    target: "civ" | "map";
  } | null>(null);

  const versionRef = useRef(0);
  const lastActionRef = useRef(0);
  const isSavingRef = useRef(false);

  const saveAndSync = useCallback(
    async (s: string, state: DraftState, hist: DraftState[]) => {
      isSavingRef.current = true;
      lastActionRef.current = Date.now();
      try {
        const result = await saveDraftToServer(s, state, hist);
        if (!result.ok) {
          setSaveError(
            "Failed to save — your action may not be visible to others.",
          );
          return;
        }
        setSaveError(null);
        if (result.version) {
          versionRef.current = result.version;
        }
      } finally {
        isSavingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    const roleParam = searchParams.get("role") ?? "spectator";
    setRole(VALID_ROLE_RE.test(roleParam) ? roleParam : "spectator");

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

  // Poll server for updates from other players (stop when completed)
  useEffect(() => {
    if (!seed || draftState?.completed) return;
    const interval = setInterval(async () => {
      // Skip polling while a save is in flight or within 3s of a local action
      if (isSavingRef.current) return;
      if (Date.now() - lastActionRef.current < 3000) return;
      const saved = await loadDraftFromServer(seed);
      if (saved && saved.version > versionRef.current) {
        versionRef.current = saved.version;
        setDraftState(saved.state);
        setHistory(saved.history ?? []);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [seed, draftState?.completed]);

  // Auto-resolve steps marked as auto (e.g. odd map pick randomised from pool)
  useEffect(() => {
    if (!draftState || draftState.completed || !isAutoStep(draftState)) return;
    if (randomOverlay) return; // already animating

    const step = getCurrentStep(draftState);
    if (!step?.auto) return;

    const available =
      step.target === "civ"
        ? getAvailableCivs(draftState)
        : getAvailableMaps(draftState);
    if (available.length === 0) return;

    // Pre-compute the result
    const finalId = available[Math.floor(Math.random() * available.length)];
    const finalName =
      step.target === "civ" ? getCivName(finalId) : getMapName(finalId);
    const pool = available.map((id) =>
      step.target === "civ" ? getCivName(id) : getMapName(id),
    );

    // Start the shuffle animation after a dramatic pause
    const startTimeout = setTimeout(() => {
      setRandomOverlay({
        phase: "shuffling",
        displayName: pool[0],
        finalName,
        finalId,
        pool,
        target: step.target,
      });
    }, 1200);

    return () => clearTimeout(startTimeout);
  }, [draftState, randomOverlay]);

  // Run the shuffle animation cycle with recursive setTimeout for true deceleration
  useEffect(() => {
    if (!randomOverlay || randomOverlay.phase !== "shuffling") return;

    const { pool, finalName } = randomOverlay;
    const totalTicks = 30;
    let tick = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function nextTick() {
      if (cancelled) return;
      tick++;
      if (tick >= totalTicks) {
        // Land on the final result
        setRandomOverlay((prev) =>
          prev ? { ...prev, phase: "revealed", displayName: finalName } : null,
        );
        return;
      }
      // Pick a random name from the pool
      const randomName = pool[Math.floor(Math.random() * pool.length)];
      setRandomOverlay((prev) =>
        prev ? { ...prev, displayName: randomName } : null,
      );
      // Starts fast (80ms), exponentially slows to ~500ms at the end
      const delay = 80 + Math.pow(tick / totalTicks, 2.5) * 500;
      timeoutId = setTimeout(nextTick, delay);
    }

    // Kick off the first tick
    timeoutId = setTimeout(nextTick, 80);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [randomOverlay?.phase]);

  // After reveal, apply the action
  useEffect(() => {
    if (!randomOverlay || randomOverlay.phase !== "revealed" || !draftState)
      return;

    const timeout = setTimeout(() => {
      const { finalId } = randomOverlay;
      const newHistory = [...history, draftState];
      const newState = applyAction(draftState, finalId);
      setHistory(newHistory);
      setDraftState(newState);
      // Only non-spectators save to server
      if (role !== "spectator") {
        saveAndSync(seed, newState, newHistory);
      }
      // Dismiss overlay after a moment
      setTimeout(() => setRandomOverlay(null), 1000);
    }, 2500); // hold the reveal for 2.5s

    return () => clearTimeout(timeout);
  }, [
    randomOverlay?.phase,
    randomOverlay?.finalId,
    draftState,
    history,
    role,
    seed,
    saveAndSync,
  ]);

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
    const availableSet = new Set(
      currentStep.target === "civ"
        ? getAvailableCivs(draftState)
        : getAvailableMaps(draftState),
    );
    if (!availableSet.has(itemId)) return;

    const newHistory = [...history, draftState];
    const newState = applyAction(draftState, itemId);
    setHistory(newHistory);
    setDraftState(newState);
    saveAndSync(seed, newState, newHistory);
  };

  const handleUndo = () => {
    if (role === "spectator" || history.length === 0) return;
    const prev = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setDraftState(prev);
    saveAndSync(seed, prev, newHistory);
  };

  const handleReset = () => {
    if (!draftState || role === "spectator") return;
    const fresh = createInitialDraftState(draftState.config);
    setDraftState(fresh);
    setHistory([]);
    saveAndSync(seed, fresh, []);
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
        <p className="text-muted-foreground animate-pulse">Loading draft...</p>
      </main>
    );
  }

  const currentStep = getCurrentStep(draftState);
  const availableCivSet = new Set(getAvailableCivs(draftState));
  const availableMapSet = new Set(getAvailableMaps(draftState));
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

  const canInteract = role !== "spectator" && isMyTurn;

  const myDisplayName = (() => {
    if (role === "spectator") return "Spectator";
    if (!myTeam) return role;
    const players = getTeamPlayers(config, myTeam);
    if (myPlayerIndex !== null && myPlayerIndex < players.length) {
      return players[myPlayerIndex].name;
    }
    return getTeamName(config, myTeam);
  })();

  return (
    <main className="min-h-screen px-4 pb-8 md:px-6">
      {/* Randomisation Overlay */}
      {randomOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6 p-10 rounded-2xl bg-card border border-border shadow-2xl shadow-yellow-500/10 max-w-md w-full mx-4">
            <Dice5
              className={`w-10 h-10 text-yellow-400 ${
                randomOverlay.phase === "shuffling" ? "animate-spin" : ""
              }`}
            />
            <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Randomising{" "}
              {randomOverlay.target === "civ" ? "Civilization" : "Map"}
            </p>
            <div
              className={`text-3xl font-bold tracking-tight text-center transition-all duration-150 min-h-[2.5rem] ${
                randomOverlay.phase === "revealed"
                  ? "text-yellow-400 scale-110"
                  : "text-foreground"
              }`}
            >
              {randomOverlay.displayName}
            </div>
            {randomOverlay.phase === "revealed" && (
              <div className="flex items-center gap-2 text-sm text-green-400 font-semibold animate-in zoom-in duration-300">
                <CheckCircle2 className="w-4 h-4" />
                Selected!
              </div>
            )}
            {randomOverlay.phase === "shuffling" && (
              <div className="w-48 h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-yellow-400/60 rounded-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
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
                {config.teamSize}v{config.teamSize}
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium ${
              myTeam === "team1"
                ? "bg-blue-500/10 text-blue-300"
                : myTeam === "team2"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {myDisplayName}
          </span>
        </div>

        {/* Timeline + Progress */}
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
              Timeline
            </p>
            <p className="text-[10px] text-muted-foreground/40 font-medium">
              {Math.min(draftState.currentStepIndex + 1, config.steps.length)}/
              {config.steps.length}
            </p>
          </div>
          <DraftTimeline state={draftState} />
        </div>

        {/* Turn Banner */}
        {!draftState.completed && currentStep && (
          <div
            className={`mb-5 rounded-xl px-5 py-4 text-center animate-draft-slide-in ${
              currentStep.auto
                ? "bg-card border border-yellow-500/20"
                : isMyTurn
                  ? currentStep.action === "ban"
                    ? "bg-card border border-red-500/25"
                    : "bg-card border border-green-500/25"
                  : "bg-card border border-border"
            }`}
          >
            {currentStep.auto ? (
              <p className="text-sm font-semibold text-yellow-400 animate-pulse">
                Randomising{" "}
                {currentStep.target === "civ" ? "civilization" : "map"}...
              </p>
            ) : isMyTurn ? (
              <>
                <p className="text-lg font-bold mb-0.5">
                  {currentStep.action === "ban" ? "Ban" : "Pick"} a{" "}
                  {currentStep.target === "civ" ? "Civilization" : "Map"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your turn — select from below
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for{" "}
                <span
                  className={`font-semibold ${currentStep.team === "team1" ? "text-blue-400" : "text-red-400"}`}
                >
                  {getStepActorName(draftState.config, currentStep)}
                </span>{" "}
                to {currentStep.action} a{" "}
                {currentStep.target === "civ" ? "civilization" : "map"}...
              </p>
            )}
          </div>
        )}

        {draftState.completed && (
          <div className="mb-5 rounded-xl px-5 py-4 bg-card border border-green-500/20 text-center">
            <p className="text-sm font-semibold text-green-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Draft Complete
            </p>
          </div>
        )}

        {saveError && (
          <div className="mb-4 rounded-lg px-4 py-2.5 bg-card border border-red-500/20 text-center">
            <p className="text-xs text-red-400">{saveError}</p>
          </div>
        )}

        {/* Team Panels with center hub */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_1fr] gap-4 mb-6 items-start">
          <TeamPanel
            teamKey="team1"
            teamName={config.team1Name}
            players={config.team1Players}
            isActive={!draftState.completed && currentStep?.team === "team1"}
            isMyTeam={myTeam === "team1"}
            myPlayerIndex={myTeam === "team1" ? myPlayerIndex : null}
            activePlayerIndex={
              !draftState.completed && currentStep?.team === "team1"
                ? (currentStep?.playerIndex ?? null)
                : null
            }
            teamData={draftState.team1}
            config={config}
          />

          {/* Center Hub — VS + Random Map */}
          <div className="hidden lg:flex flex-col items-center justify-start pt-4 gap-3">
            {/* VS badge */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-4 bg-gradient-to-b from-transparent to-border" />
              <div className="w-12 h-12 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-lg">
                <Swords className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground/40 uppercase">
                VS
              </span>
              <div className="w-px h-4 bg-gradient-to-b from-border to-transparent" />
            </div>

            {/* Random Map section */}
            {(() => {
              const autoMapSteps = config.steps.filter(
                (s) => s.action === "pick" && s.target === "map" && s.auto,
              );
              if (autoMapSteps.length === 0) return null;
              const t1ManualCount = config.steps.filter(
                (s) =>
                  s.action === "pick" &&
                  s.target === "map" &&
                  s.team === "team1" &&
                  !s.auto,
              ).length;
              const t2ManualCount = config.steps.filter(
                (s) =>
                  s.action === "pick" &&
                  s.target === "map" &&
                  s.team === "team2" &&
                  !s.auto,
              ).length;
              const autoResults: string[] = [];
              if (draftState.team1.mapPicks.length > t1ManualCount) {
                autoResults.push(
                  ...draftState.team1.mapPicks.slice(t1ManualCount),
                );
              }
              if (draftState.team2.mapPicks.length > t2ManualCount) {
                autoResults.push(
                  ...draftState.team2.mapPicks.slice(t2ManualCount),
                );
              }
              const hasAutoResult = autoResults.length > 0;
              const isPending = !hasAutoResult && !draftState.completed;

              return (
                <div className="w-full rounded-xl bg-card border border-border/50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Dice5 className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                      Decider Map
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    {autoMapSteps.map((_, i) => {
                      const mapId = autoResults[i];
                      const filled = !!mapId;
                      return (
                        <span
                          key={i}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                            filled
                              ? "bg-yellow-500/5 ring-1 ring-yellow-500/20 text-yellow-400 animate-draft-reveal"
                              : isPending
                                ? "ring-1 ring-yellow-500/10 text-yellow-400/30 animate-pulse"
                                : "ring-1 ring-border/15 text-muted-foreground/25"
                          }`}
                        >
                          {filled ? getMapName(mapId) : "?"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <TeamPanel
            teamKey="team2"
            teamName={config.team2Name}
            players={config.team2Players}
            isActive={!draftState.completed && currentStep?.team === "team2"}
            isMyTeam={myTeam === "team2"}
            myPlayerIndex={myTeam === "team2" ? myPlayerIndex : null}
            activePlayerIndex={
              !draftState.completed && currentStep?.team === "team2"
                ? (currentStep?.playerIndex ?? null)
                : null
            }
            teamData={draftState.team2}
            config={config}
          />
        </div>

        {/* Selection Area — only shown when it's your turn */}
        {!draftState.completed && currentStep && canInteract && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-3">
              {currentStep.target === "civ" ? "Civilizations" : "Maps"}
            </p>
            {currentStep.target === "civ" ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {config.civPool.map((civId) => {
                  const civName = getCivName(civId);
                  const civFlag = getCivFlag(civId);
                  const isAvailable = availableCivSet.has(civId);
                  const isBannedByAny =
                    draftState.team1.civBans.includes(civId) ||
                    draftState.team2.civBans.includes(civId);
                  // In per-team mode, only show as banned if it's actually unavailable
                  const isBanned = isBannedByAny && !isAvailable;
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
                            ? "bg-card ring-1 ring-border hover:ring-red-500/40 hover:scale-[1.02] cursor-pointer"
                            : "bg-card ring-1 ring-border hover:ring-green-500/40 hover:scale-[1.02] cursor-pointer"
                          : isBanned
                            ? "bg-card/40 ring-1 ring-red-500/10"
                            : isPickedT1 || isPickedT2
                              ? "bg-card/40 ring-1 ring-border/30"
                              : "bg-card/30 ring-1 ring-border/20"
                      }`}
                    >
                      {civFlag && (
                        <Image
                          src={civFlag}
                          alt={civName}
                          width={96}
                          height={96}
                          className={`w-12 h-12 rounded-full object-cover shrink-0 ${
                            isBanned
                              ? "grayscale opacity-40 ring-2 ring-red-500/20"
                              : isPickedT1 || isPickedT2
                                ? "opacity-50 ring-2 ring-border/50"
                                : !clickable
                                  ? "opacity-30 ring-2 ring-border/30"
                                  : "ring-2 ring-border"
                          }`}
                        />
                      )}
                      <p
                        className={`text-xs font-medium truncate w-full ${isBanned ? "text-muted-foreground/40" : ""}`}
                      >
                        {civName}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {config.mapPool.map((mapId) => {
                  const mapName = getMapName(mapId);
                  const isAvailable = availableMapSet.has(mapId);
                  const isBannedByAny =
                    draftState.team1.mapBans.includes(mapId) ||
                    draftState.team2.mapBans.includes(mapId);
                  const isBanned = isBannedByAny && !isAvailable;
                  const isPickedT1 = draftState.team1.mapPicks.includes(mapId);
                  const isPickedT2 = draftState.team2.mapPicks.includes(mapId);
                  const clickable = isAvailable && canInteract;

                  return (
                    <button
                      key={mapId}
                      onClick={() => clickable && handleSelect(mapId)}
                      disabled={!clickable}
                      className={`p-3 rounded-xl text-left transition-all ${
                        clickable
                          ? currentStep.action === "ban"
                            ? "bg-card ring-1 ring-border hover:ring-red-500/40 hover:scale-[1.02] cursor-pointer"
                            : "bg-card ring-1 ring-border hover:ring-green-500/40 hover:scale-[1.02] cursor-pointer"
                          : isBanned
                            ? "bg-card/40 ring-1 ring-red-500/10"
                            : isPickedT1 || isPickedT2
                              ? "bg-card/40 ring-1 ring-border/30"
                              : "bg-card/30 ring-1 ring-border/20"
                      }`}
                    >
                      <span
                        className={`text-xs font-medium truncate block ${isBanned ? "text-muted-foreground/40" : ""}`}
                      >
                        {mapName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Controls — hidden for spectators */}
        {/* Footer with seed */}
        <div className="mt-8 pt-4 border-t border-border/30 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/40">
          <span>Seed:</span>
          <code className="font-mono bg-secondary/30 px-1.5 py-0.5 rounded text-muted-foreground/50 select-all">
            {seed}
          </code>
        </div>

        {role !== "spectator" && (
          <div className="mt-4 flex justify-center gap-2">
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
        )}
      </div>
    </main>
  );
}

export default function DraftPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8 flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse">
            Loading draft...
          </p>
        </main>
      }
    >
      <DraftContent />
    </Suspense>
  );
}
