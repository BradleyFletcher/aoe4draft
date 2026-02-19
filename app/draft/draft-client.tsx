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
  isAllReady,
  setPlayerReady,
  getRequiredRoles,
  isHiddenBanStep,
  getOrInitHiddenPhase,
  applyHiddenBan,
  hasTeamCompletedHiddenBans,
  getRemainingHiddenBans,
  getAvailableForHiddenBan,
  type TeamKey,
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

// Atomic server-side action: reads current state, applies mutation, saves.
// Prevents race conditions where two clients overwrite each other's data.
async function sendDraftAction(
  seed: string,
  action: string,
  role: string,
  itemId?: string,
): Promise<{ ok: boolean; version?: number; pickedId?: string }> {
  if (!seed) return { ok: false };
  try {
    const res = await fetch("/api/draft/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, action, role, itemId }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: !!data.ok, version: data.version, pickedId: data.pickedId };
  } catch {
    return { ok: false };
  }
}

async function loadDraftFromServer(
  seed: string,
  role?: string,
): Promise<{
  state: DraftState;
  history: DraftState[];
  version: number;
} | null> {
  if (!seed) return null;
  try {
    let url = `/api/draft?seed=${encodeURIComponent(seed)}`;
    if (role) url += `&role=${encodeURIComponent(role)}`;
    const res = await fetch(url);
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
  const isSavingRef = useRef(false);
  const roleRef = useRef(role);
  roleRef.current = role;

  const saveAndSync = useCallback(
    async (s: string, state: DraftState, hist: DraftState[]) => {
      isSavingRef.current = true;
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
    loadDraftFromServer(
      seedParam,
      VALID_ROLE_RE.test(roleParam) ? roleParam : "spectator",
    ).then((saved) => {
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

  // Real-time updates via SSE, with polling fallback.
  // Uses roleRef to avoid stale closures — the SSE connection doesn't need to
  // reconnect when role changes, it just needs the latest role when fetching.
  useEffect(() => {
    if (!seed || draftState?.completed) return;

    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let fetchInFlight = false;

    const fetchLatest = async () => {
      // Only skip if we are actively saving (our own write is in flight)
      if (isSavingRef.current || fetchInFlight) return;
      fetchInFlight = true;
      try {
        const saved = await loadDraftFromServer(seed, roleRef.current);
        if (!cancelled && saved && saved.version > versionRef.current) {
          versionRef.current = saved.version;
          setDraftState(saved.state);
          setHistory(saved.history ?? []);
        }
      } finally {
        fetchInFlight = false;
      }
    };

    // Try SSE first
    const url = `/api/draft/stream?seed=${encodeURIComponent(seed)}`;
    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.version && data.version > versionRef.current) {
          fetchLatest();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE failed — fall back to polling
      es.close();
      if (!cancelled && !fallbackInterval) {
        fallbackInterval = setInterval(fetchLatest, 3000);
      }
    };

    return () => {
      cancelled = true;
      es.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [seed, draftState?.completed]);

  // Auto-initialise hidden ban phase when we reach hidden ban steps
  const hiddenInitRef = useRef(false);
  useEffect(() => {
    if (!draftState || draftState.completed) return;
    if (!isHiddenBanStep(draftState) || draftState.hiddenBanPhase) {
      hiddenInitRef.current = false;
      return;
    }
    if (role === "spectator") return;
    if (hiddenInitRef.current) return; // already sending
    hiddenInitRef.current = true;

    // Use server-side action to init — prevents race if both clients try at once
    sendDraftAction(seed, "init-hidden", role).then((result) => {
      if (result.ok && result.version) {
        loadDraftFromServer(seed, role).then((saved) => {
          if (saved && saved.version >= (result.version ?? 0)) {
            versionRef.current = saved.version;
            setDraftState(saved.state);
            setHistory(saved.history ?? []);
          }
          hiddenInitRef.current = false;
        });
      } else {
        hiddenInitRef.current = false;
      }
    });
  }, [draftState, role, seed]);

  // ── Server-driven auto-resolve ──────────────────────────────────────
  // When the draft reaches an auto step (e.g. random map pick), ONE client
  // asks the server to resolve it. The server picks a random item atomically,
  // saves the state, and returns the pickedId. All clients show a shuffle
  // animation and reveal the server-chosen result.
  //
  // Flow:
  //   1. Effect detects auto step → starts shuffle overlay → first non-spectator
  //      client sends "auto-resolve" to server (server deduplicates via no-op).
  //   2. Server returns { pickedId } → overlay transitions to "revealed".
  //   3. SSE notifies all clients → they fetch the advanced state → overlay
  //      shows the result and then dismisses.

  const autoResolveStepRef = useRef<number | null>(null);

  // 1) Detect auto step → start shuffle + ask server to resolve
  useEffect(() => {
    if (!draftState || draftState.completed || !isAutoStep(draftState)) {
      autoResolveStepRef.current = null;
      return;
    }
    if (randomOverlay) return; // already animating
    if (autoResolveStepRef.current === draftState.currentStepIndex) return;
    autoResolveStepRef.current = draftState.currentStepIndex;

    const step = getCurrentStep(draftState);
    if (!step?.auto) return;

    const available =
      step.target === "civ"
        ? getAvailableCivs(draftState)
        : getAvailableMaps(draftState);
    if (available.length === 0) return;

    const pool = available.map((id) =>
      step.target === "civ" ? getCivName(id) : getMapName(id),
    );

    // Show shuffling overlay immediately for all clients
    setRandomOverlay({
      phase: "shuffling",
      displayName: pool[0],
      finalName: "",
      finalId: "",
      pool,
      target: step.target,
    });

    // Any non-spectator client asks the server to resolve (server deduplicates)
    if (role !== "spectator") {
      sendDraftAction(seed, "auto-resolve", role).then((result) => {
        if (result.ok && result.pickedId) {
          const name =
            step.target === "civ"
              ? getCivName(result.pickedId)
              : getMapName(result.pickedId);
          // Transition to revealed — the shuffle effect will land on this
          setRandomOverlay((prev) =>
            prev
              ? { ...prev, finalId: result.pickedId!, finalName: name }
              : null,
          );
        }
        // Refresh state from server
        if (result.ok && result.version) {
          loadDraftFromServer(seed, roleRef.current).then((saved) => {
            if (saved && saved.version > versionRef.current) {
              versionRef.current = saved.version;
              setDraftState(saved.state);
              setHistory(saved.history ?? []);
            }
          });
        }
      });
    }
  }, [
    draftState?.currentStepIndex,
    draftState?.completed,
    randomOverlay,
    role,
  ]);

  // 2) Shuffle animation — spins through pool names, then lands on final
  useEffect(() => {
    if (!randomOverlay || randomOverlay.phase !== "shuffling") return;

    const { pool, finalId, finalName } = randomOverlay;
    const hasFinal = !!finalId; // server has responded with the result
    let tick = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function nextTick() {
      if (cancelled) return;
      tick++;

      // If we have the final result and enough ticks have passed, reveal
      if (hasFinal && tick >= 25) {
        setRandomOverlay((prev) =>
          prev ? { ...prev, phase: "revealed", displayName: finalName } : null,
        );
        return;
      }

      // Keep spinning — loop if we haven't got the result yet
      if (tick >= 60) tick = 0;

      const randomName = pool[Math.floor(Math.random() * pool.length)];
      setRandomOverlay((prev) =>
        prev ? { ...prev, displayName: randomName } : null,
      );
      const delay = hasFinal
        ? 80 + Math.pow(tick / 25, 2.5) * 500
        : 80 + Math.pow((tick % 30) / 30, 1.5) * 200;
      timeoutId = setTimeout(nextTick, delay);
    }

    timeoutId = setTimeout(nextTick, 80);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [randomOverlay?.phase, randomOverlay?.finalId]);

  // 3) After reveal, dismiss the overlay after a short delay
  useEffect(() => {
    if (!randomOverlay || randomOverlay.phase !== "revealed") return;

    const timeout = setTimeout(() => {
      setRandomOverlay(null);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [randomOverlay?.phase]);

  // 4) Fallback: if SSE delivers the state update (step advanced) while
  //    we're still shuffling without a finalId (spectator, or server was slow),
  //    look up what was picked and reveal it.
  useEffect(() => {
    if (!randomOverlay || !draftState) return;
    if (randomOverlay.phase !== "shuffling" || randomOverlay.finalId) return;
    // If the step has advanced past the auto step, the server already resolved it
    if (!isAutoStep(draftState)) {
      // Figure out what was picked by looking at the latest team data
      const stepIdx = autoResolveStepRef.current;
      if (stepIdx !== null && stepIdx < draftState.config.steps.length) {
        const resolvedStep = draftState.config.steps[stepIdx];
        const teamData =
          resolvedStep.team === "team1" ? draftState.team1 : draftState.team2;
        const picks =
          resolvedStep.target === "civ" ? teamData.civPicks : teamData.mapPicks;
        const lastPick = picks[picks.length - 1];
        if (lastPick) {
          const name =
            resolvedStep.target === "civ"
              ? getCivName(lastPick)
              : getMapName(lastPick);
          setRandomOverlay((prev) =>
            prev
              ? {
                  ...prev,
                  finalId: lastPick,
                  finalName: name,
                  phase: "revealed",
                  displayName: name,
                }
              : null,
          );
          return;
        }
      }
      // Couldn't determine — just dismiss
      setRandomOverlay(null);
    }
  }, [draftState?.currentStepIndex, randomOverlay]);

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

  const handleReady = async () => {
    if (!draftState || role === "spectator") return;
    // Optimistic local update
    const optimistic = setPlayerReady(draftState, role);
    setDraftState(optimistic);
    // Server-side atomic merge
    const result = await sendDraftAction(seed, "ready", role);
    if (result.ok && result.version) {
      const saved = await loadDraftFromServer(seed, role);
      if (saved && saved.version >= result.version) {
        versionRef.current = saved.version;
        setDraftState(saved.state);
        setHistory(saved.history ?? []);
      }
    }
  };

  const handleHiddenBan = async (itemId: string) => {
    if (!draftState || role === "spectator") return;
    const myTeam = getTeamFromRole(role) as TeamKey;
    if (!myTeam) return;
    if (hasTeamCompletedHiddenBans(draftState, myTeam)) return;

    const available = new Set(getAvailableForHiddenBan(draftState, myTeam));
    if (!available.has(itemId)) return;

    // Optimistic local update
    const optimistic = applyHiddenBan(draftState, myTeam, itemId);
    setDraftState(optimistic);
    // Server-side atomic merge — server reads authoritative state, applies ban, saves
    const result = await sendDraftAction(seed, "hidden-ban", role, itemId);
    if (result.ok && result.version) {
      const saved = await loadDraftFromServer(seed, role);
      if (saved && saved.version >= result.version) {
        versionRef.current = saved.version;
        setDraftState(saved.state);
        setHistory(saved.history ?? []);
      }
    }
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

  // Ready check: block drafting until all players have readied up
  if (
    !isAllReady(draftState) &&
    !draftState.completed &&
    draftState.currentStepIndex === 0
  ) {
    const requiredRoles = getRequiredRoles(draftState.config);
    const readyMap = draftState.readyPlayers ?? {};
    const iAmReady = role !== "spectator" && readyMap[role];
    const readyCount = requiredRoles.filter((r) => readyMap[r]).length;
    const config = draftState.config;

    return (
      <main className="min-h-screen px-4 pb-8 md:px-6">
        <div className="max-w-lg mx-auto pt-12">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
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
                {config.teamSize}v{config.teamSize} — Waiting for players
              </p>
            </div>
          </div>

          {/* Ready status card */}
          <div className="rounded-xl bg-card border border-border/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold">Player Ready Check</h2>
              <span className="text-xs text-muted-foreground">
                {readyCount}/{requiredRoles.length} ready
              </span>
            </div>

            {/* Team 1 */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-blue-400/60 font-semibold mb-2">
                {config.team1Name}
              </p>
              <div className="space-y-1.5">
                {config.team1Players.map((player, i) => {
                  const playerRole = `team1_p${i}`;
                  const isReady = readyMap[playerRole];
                  const isMe = role === playerRole;
                  return (
                    <div
                      key={playerRole}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isMe
                          ? "bg-blue-500/10 ring-1 ring-blue-500/20"
                          : "bg-secondary/30"
                      }`}
                    >
                      <span
                        className={
                          isMe
                            ? "font-semibold text-blue-300"
                            : "text-muted-foreground"
                        }
                      >
                        {player.name}
                        {isMe && (
                          <span className="text-[10px] ml-1.5 opacity-60">
                            (you)
                          </span>
                        )}
                      </span>
                      {isReady ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/20 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team 2 */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-red-400/60 font-semibold mb-2">
                {config.team2Name}
              </p>
              <div className="space-y-1.5">
                {config.team2Players.map((player, i) => {
                  const playerRole = `team2_p${i}`;
                  const isReady = readyMap[playerRole];
                  const isMe = role === playerRole;
                  return (
                    <div
                      key={playerRole}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        isMe
                          ? "bg-red-500/10 ring-1 ring-red-500/20"
                          : "bg-secondary/30"
                      }`}
                    >
                      <span
                        className={
                          isMe
                            ? "font-semibold text-red-300"
                            : "text-muted-foreground"
                        }
                      >
                        {player.name}
                        {isMe && (
                          <span className="text-[10px] ml-1.5 opacity-60">
                            (you)
                          </span>
                        )}
                      </span>
                      {isReady ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/20 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ready button or status */}
          {role === "spectator" ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Waiting for all players to ready up...
              </p>
            </div>
          ) : iAmReady ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">
                  You are ready — waiting for others...
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Button
                onClick={handleReady}
                size="lg"
                className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Ready
              </Button>
            </div>
          )}

          {/* Seed footer */}
          <div className="mt-8 pt-4 border-t border-border/30 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/40">
            <span>Seed:</span>
            <code className="font-mono bg-secondary/30 px-1.5 py-0.5 rounded text-muted-foreground/50 select-all">
              {seed}
            </code>
          </div>
        </div>
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

        {/* Turn Banner — hidden ban phase or normal */}
        {!draftState.completed &&
          currentStep &&
          (() => {
            const phase = draftState.hiddenBanPhase;
            if (phase) {
              const myTeamKey = getTeamFromRole(role) as TeamKey | null;
              const myDone = myTeamKey
                ? hasTeamCompletedHiddenBans(draftState, myTeamKey)
                : false;
              const remaining = myTeamKey
                ? getRemainingHiddenBans(draftState, myTeamKey)
                : 0;
              const targetLabel =
                phase.target === "civ" ? "civilization" : "map";

              return (
                <div className="mb-5 rounded-xl px-5 py-4 text-center animate-draft-slide-in bg-card border border-orange-500/25">
                  <p className="text-xs uppercase tracking-widest text-orange-400/60 font-semibold mb-1">
                    Simultaneous Hidden Bans
                  </p>
                  {role === "spectator" ? (
                    <p className="text-sm text-muted-foreground">
                      Both teams are secretly banning {targetLabel}s...
                    </p>
                  ) : myDone ? (
                    <p className="text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 inline-block mr-1 text-green-400" />
                      Your bans are locked in — waiting for opponent...
                    </p>
                  ) : (
                    <>
                      <p className="text-lg font-bold mb-0.5">
                        Ban {remaining} {targetLabel}
                        {remaining !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Your opponent cannot see your bans until both sides
                        finish
                      </p>
                    </>
                  )}
                </div>
              );
            }

            return (
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
            );
          })()}

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

        {/* Hidden Ban Selection Area — shown during simultaneous ban phase */}
        {!draftState.completed &&
          draftState.hiddenBanPhase &&
          role !== "spectator" &&
          (() => {
            const phase = draftState.hiddenBanPhase!;
            const myTeamKey = getTeamFromRole(role) as TeamKey;
            if (!myTeamKey) return null;
            if (hasTeamCompletedHiddenBans(draftState, myTeamKey)) return null;

            const available = new Set(
              getAvailableForHiddenBan(draftState, myTeamKey),
            );
            const myBans =
              myTeamKey === "team1" ? phase.team1Bans : phase.team2Bans;
            const targetLabel =
              phase.target === "civ" ? "Civilizations" : "Maps";

            return (
              <div>
                {myBans.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
                      Your hidden bans:
                    </span>
                    {myBans.map((id, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 ring-1 ring-red-500/20 text-xs font-medium text-red-400"
                      >
                        {phase.target === "civ"
                          ? getCivName(id)
                          : getMapName(id)}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-3">
                  {targetLabel}
                </p>
                {phase.target === "civ" ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {config.civPool.map((civId) => {
                      const civName = getCivName(civId);
                      const civFlag = getCivFlag(civId);
                      const isAvail = available.has(civId);
                      const alreadyBanned = myBans.includes(civId);
                      const clickable = isAvail && !alreadyBanned;

                      return (
                        <button
                          key={civId}
                          onClick={() => clickable && handleHiddenBan(civId)}
                          disabled={!clickable}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all ${
                            alreadyBanned
                              ? "bg-red-500/10 ring-1 ring-red-500/30"
                              : clickable
                                ? "bg-card ring-1 ring-border hover:ring-red-500/40 hover:scale-[1.02] cursor-pointer"
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
                                alreadyBanned
                                  ? "grayscale opacity-40 ring-2 ring-red-500/20"
                                  : !clickable
                                    ? "opacity-30 ring-2 ring-border/30"
                                    : "ring-2 ring-border"
                              }`}
                            />
                          )}
                          <p
                            className={`text-xs font-medium truncate w-full ${alreadyBanned ? "text-red-400/60" : !clickable ? "text-muted-foreground/40" : ""}`}
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
                      const isAvail = available.has(mapId);
                      const alreadyBanned = myBans.includes(mapId);
                      const clickable = isAvail && !alreadyBanned;

                      return (
                        <button
                          key={mapId}
                          onClick={() => clickable && handleHiddenBan(mapId)}
                          disabled={!clickable}
                          className={`p-3 rounded-xl text-left transition-all ${
                            alreadyBanned
                              ? "bg-red-500/10 ring-1 ring-red-500/30"
                              : clickable
                                ? "bg-card ring-1 ring-border hover:ring-red-500/40 hover:scale-[1.02] cursor-pointer"
                                : "bg-card/30 ring-1 ring-border/20"
                          }`}
                        >
                          <span
                            className={`text-xs font-medium truncate block ${alreadyBanned ? "text-red-400/60" : !clickable ? "text-muted-foreground/40" : ""}`}
                          >
                            {mapName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        {/* Selection Area — only shown when it's your turn (normal non-hidden steps) */}
        {!draftState.completed &&
          currentStep &&
          canInteract &&
          !draftState.hiddenBanPhase && (
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
                    const isPickedT1 =
                      draftState.team1.civPicks.includes(civId);
                    const isPickedT2 =
                      draftState.team2.civPicks.includes(civId);
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
                    const isPickedT1 =
                      draftState.team1.mapPicks.includes(mapId);
                    const isPickedT2 =
                      draftState.team2.mapPicks.includes(mapId);
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
