import { civilizations, type Civilization } from "@/data/civilizations";
import { maps, type GameMap } from "@/data/maps";

// O(1) lookup maps — built once at module load
const civById = new Map<string, Civilization>(
  civilizations.map((c) => [c.id, c]),
);
const mapById = new Map<string, GameMap>(maps.map((m) => [m.id, m]));
const civIds = new Set(civilizations.map((c) => c.id));
const mapIds = new Set(maps.map((m) => m.id));

export type DraftActionType = "ban" | "pick";
export type DraftActionTarget = "civ" | "map";
export type TeamKey = "team1" | "team2";
export type TeamSize = 1 | 2 | 3 | 4;
export type BanMode = "global" | "per-team";

export interface DraftStep {
  action: DraftActionType;
  target: DraftActionTarget;
  team: TeamKey;
  playerIndex?: number; // which player on the team (0-based). undefined = team-level (bans, map picks)
  auto?: boolean; // if true, this step is resolved automatically with a random pick from the available pool
  hidden?: boolean; // if true, this ban is part of a simultaneous hidden ban phase
}

// Tracks a simultaneous hidden ban phase where both teams ban at the same time
export interface HiddenBanPhase {
  startIndex: number; // index of first step in this phase
  team1Bans: string[]; // bans submitted by team1 (hidden from team2)
  team2Bans: string[]; // bans submitted by team2 (hidden from team1)
  team1Count: number; // how many bans team1 needs to submit
  team2Count: number; // how many bans team2 needs to submit
  target: DraftActionTarget; // civ or map
}

export interface TeamPlayer {
  name: string;
}

export interface DraftConfig {
  name: string;
  teamSize: TeamSize;
  banMode: BanMode;
  allowDuplicatePicks: boolean;
  civPool: string[];
  mapPool: string[];
  steps: DraftStep[];
  team1Name: string;
  team2Name: string;
  team1Players: TeamPlayer[];
  team2Players: TeamPlayer[];
}

export interface TeamDraftData {
  civBans: string[];
  civPicks: string[]; // indexed by playerIndex for picks
  mapBans: string[];
  mapPicks: string[];
}

export interface DraftState {
  config: DraftConfig;
  currentStepIndex: number;
  team1: TeamDraftData;
  team2: TeamDraftData;
  completed: boolean;
  readyPlayers?: Record<string, boolean>;
  hiddenBanPhase?: HiddenBanPhase | null; // active hidden ban phase, null when not in one
}

export function generateSeed(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let seed = "";
  for (let i = 0; i < 12; i++) {
    seed += chars[bytes[i] % chars.length];
  }
  return seed;
}

export function encodeDraftConfig(config: DraftConfig): string {
  return btoa(JSON.stringify(config));
}

export function decodeDraftConfig(encoded: string): DraftConfig | null {
  try {
    const parsed = JSON.parse(atob(encoded));
    return validateDraftConfig(parsed);
  } catch {
    return null;
  }
}

const VALID_TEAM_SIZES = new Set<number>([1, 2, 3, 4]);
const MAX_STEPS = 100;
const MAX_POOL_SIZE = 200;

export function validateDraftConfig(obj: unknown): DraftConfig | null {
  if (!obj || typeof obj !== "object") return null;
  const c = obj as Record<string, unknown>;

  if (typeof c.name !== "string" || c.name.length > 200) return null;
  if (!VALID_TEAM_SIZES.has(c.teamSize as number)) return null;
  // Default banMode to "global" for backwards compatibility
  if (c.banMode === undefined) c.banMode = "global";
  if (c.banMode !== "global" && c.banMode !== "per-team") return null;
  // Default allowDuplicatePicks to false for backwards compatibility
  if (c.allowDuplicatePicks === undefined) c.allowDuplicatePicks = false;
  if (typeof c.allowDuplicatePicks !== "boolean") return null;

  if (!Array.isArray(c.civPool) || c.civPool.length > MAX_POOL_SIZE)
    return null;
  if (
    !c.civPool.every(
      (id: unknown) => typeof id === "string" && civIds.has(id as string),
    )
  )
    return null;

  if (!Array.isArray(c.mapPool) || c.mapPool.length > MAX_POOL_SIZE)
    return null;
  if (
    !c.mapPool.every(
      (id: unknown) => typeof id === "string" && mapIds.has(id as string),
    )
  )
    return null;

  if (
    !Array.isArray(c.steps) ||
    c.steps.length === 0 ||
    c.steps.length > MAX_STEPS
  )
    return null;
  const validActions = new Set(["ban", "pick"]);
  const validTargets = new Set(["civ", "map"]);
  const validTeams = new Set(["team1", "team2"]);
  for (const s of c.steps as Record<string, unknown>[]) {
    if (!validActions.has(s.action as string)) return null;
    if (!validTargets.has(s.target as string)) return null;
    if (!validTeams.has(s.team as string)) return null;
    if (
      s.playerIndex !== undefined &&
      (typeof s.playerIndex !== "number" ||
        s.playerIndex < 0 ||
        s.playerIndex >= (c.teamSize as number))
    )
      return null;
    if (s.hidden !== undefined && typeof s.hidden !== "boolean") return null;
    if (s.auto !== undefined && typeof s.auto !== "boolean") return null;
  }

  if (typeof c.team1Name !== "string" || typeof c.team2Name !== "string")
    return null;
  if (!Array.isArray(c.team1Players) || !Array.isArray(c.team2Players))
    return null;
  if (
    c.team1Players.length !== (c.teamSize as number) ||
    c.team2Players.length !== (c.teamSize as number)
  )
    return null;
  const validPlayer = (p: unknown) =>
    p &&
    typeof p === "object" &&
    typeof (p as Record<string, unknown>).name === "string";
  if (!c.team1Players.every(validPlayer) || !c.team2Players.every(validPlayer))
    return null;

  return c as unknown as DraftConfig;
}

export function createInitialDraftState(config: DraftConfig): DraftState {
  return {
    config,
    currentStepIndex: 0,
    team1: { civBans: [], civPicks: [], mapBans: [], mapPicks: [] },
    team2: { civBans: [], civPicks: [], mapBans: [], mapPicks: [] },
    completed: false,
    readyPlayers: {},
  };
}

export function getRequiredRoles(config: DraftConfig): string[] {
  const roles: string[] = [];
  for (let i = 0; i < config.teamSize; i++) {
    roles.push(`team1_p${i}`);
    roles.push(`team2_p${i}`);
  }
  return roles;
}

export function isAllReady(state: DraftState): boolean {
  const required = getRequiredRoles(state.config);
  if (!state.readyPlayers) return false;
  return required.every((role) => state.readyPlayers?.[role] === true);
}

export function setPlayerReady(state: DraftState, role: string): DraftState {
  const newState = structuredClone(state);
  if (!newState.readyPlayers) newState.readyPlayers = {};
  newState.readyPlayers[role] = true;
  return newState;
}

export function getCurrentStep(state: DraftState): DraftStep | null {
  if (state.currentStepIndex >= state.config.steps.length) return null;
  return state.config.steps[state.currentStepIndex];
}

export function getTeamData(state: DraftState, team: TeamKey): TeamDraftData {
  return team === "team1" ? state.team1 : state.team2;
}

export function getTeamPlayers(
  config: DraftConfig,
  team: TeamKey,
): TeamPlayer[] {
  return team === "team1" ? config.team1Players : config.team2Players;
}

export function getTeamName(config: DraftConfig, team: TeamKey): string {
  return team === "team1" ? config.team1Name : config.team2Name;
}

export function getAvailableCivs(state: DraftState): string[] {
  const step = getCurrentStep(state);
  const isPerTeam = state.config.banMode === "per-team";

  if (step?.action === "ban") {
    const allPicked = new Set([
      ...state.team1.civPicks,
      ...state.team2.civPicks,
    ]);
    // Global: can't ban anything already banned by either team
    // Per-team: can only see your own bans as used (other team can ban the same civ)
    const bannedSet = isPerTeam
      ? new Set(getTeamData(state, step.team).civBans)
      : new Set([...state.team1.civBans, ...state.team2.civBans]);
    return state.config.civPool.filter(
      (id) => !allPicked.has(id) && !bannedSet.has(id),
    );
  }

  // When picking:
  // Global mode: all bans from both teams are excluded for everyone
  // Per-team mode: only the OTHER team's bans affect you (your own bans don't restrict you)
  //
  // A single player can NEVER pick the same civ twice (always enforced).
  // allowDuplicatePicks controls whether different players on the same team
  // can share a civ:
  //   false (Unique) = once a civ is picked by any teammate, it's locked for the whole team
  //   true (Allow Duplicates) = teammates can pick the same civ, but each player still can't repeat
  const allowDupes = state.config.allowDuplicatePicks;
  let myPicks = new Set<string>();
  if (step && step.playerIndex !== undefined) {
    // Always block civs THIS specific player has already picked
    let pickCount = 0;
    for (const s of state.config.steps.slice(0, state.currentStepIndex)) {
      if (s.action === "pick" && s.target === "civ" && s.team === step.team) {
        if (s.playerIndex === step.playerIndex) {
          const civId = getTeamData(state, step.team).civPicks[pickCount];
          if (civId) myPicks.add(civId);
        }
        pickCount++;
      }
    }
    // If duplicates NOT allowed, also block all team picks
    if (!allowDupes) {
      for (const id of getTeamData(state, step.team).civPicks) {
        myPicks.add(id);
      }
    }
  } else if (step) {
    // Team-level pick (no playerIndex) — always block all team picks
    myPicks = new Set(getTeamData(state, step.team).civPicks);
  }

  if (isPerTeam && step) {
    const otherTeam = step.team === "team1" ? "team2" : "team1";
    const otherBans = new Set(getTeamData(state, otherTeam).civBans);
    return state.config.civPool.filter(
      (id) => !otherBans.has(id) && !myPicks.has(id),
    );
  }

  const allBanned = new Set([...state.team1.civBans, ...state.team2.civBans]);
  return state.config.civPool.filter(
    (id) => !allBanned.has(id) && !myPicks.has(id),
  );
}

export function getAvailableMaps(state: DraftState): string[] {
  const step = getCurrentStep(state);
  const isPerTeam = state.config.banMode === "per-team";
  const allPicked = new Set([...state.team1.mapPicks, ...state.team2.mapPicks]);

  if (step?.action === "ban") {
    // Global: can't ban anything already banned by either team
    // Per-team: only your own bans are excluded (other team can ban the same map)
    const bannedSet = isPerTeam
      ? new Set(getTeamData(state, step.team).mapBans)
      : new Set([...state.team1.mapBans, ...state.team2.mapBans]);
    return state.config.mapPool.filter(
      (id) => !allPicked.has(id) && !bannedSet.has(id),
    );
  }

  // When picking:
  // Global mode: all bans excluded
  // Per-team mode: only the other team's bans affect you
  if (isPerTeam && step) {
    const otherTeam = step.team === "team1" ? "team2" : "team1";
    const otherBans = new Set(getTeamData(state, otherTeam).mapBans);
    return state.config.mapPool.filter(
      (id) => !allPicked.has(id) && !otherBans.has(id),
    );
  }

  const allBanned = new Set([...state.team1.mapBans, ...state.team2.mapBans]);
  return state.config.mapPool.filter(
    (id) => !allPicked.has(id) && !allBanned.has(id),
  );
}

export function isAutoStep(state: DraftState): boolean {
  const step = getCurrentStep(state);
  return !!step?.auto;
}

export function resolveAutoStep(state: DraftState): {
  state: DraftState;
  pickedId: string | null;
} {
  const step = getCurrentStep(state);
  if (!step?.auto) return { state, pickedId: null };

  const available =
    step.target === "civ" ? getAvailableCivs(state) : getAvailableMaps(state);
  if (available.length === 0) return { state, pickedId: null };

  const randomId = available[Math.floor(Math.random() * available.length)];
  return { state: applyAction(state, randomId), pickedId: randomId };
}

// Detect the hidden ban phase starting at a given step index.
// A hidden phase is a contiguous run of hidden ban steps (same target, same action=ban).
export function detectHiddenBanPhase(
  config: DraftConfig,
  startIndex: number,
): HiddenBanPhase | null {
  const step = config.steps[startIndex];
  if (!step?.hidden || step.action !== "ban") return null;

  let team1Count = 0;
  let team2Count = 0;
  const target = step.target;

  for (let i = startIndex; i < config.steps.length; i++) {
    const s = config.steps[i];
    if (!s.hidden || s.action !== "ban" || s.target !== target) break;
    if (s.team === "team1") team1Count++;
    else team2Count++;
  }

  if (team1Count === 0 || team2Count === 0) return null;

  return {
    startIndex,
    team1Bans: [],
    team2Bans: [],
    team1Count,
    team2Count,
    target,
  };
}

// Check if the current step is a hidden ban phase that needs initialisation
export function isHiddenBanStep(state: DraftState): boolean {
  const step = getCurrentStep(state);
  return !!step?.hidden && step.action === "ban";
}

// Get or initialise the active hidden ban phase
export function getOrInitHiddenPhase(state: DraftState): DraftState {
  if (state.hiddenBanPhase) return state;
  const phase = detectHiddenBanPhase(state.config, state.currentStepIndex);
  if (!phase) return state;
  const newState = structuredClone(state);
  newState.hiddenBanPhase = phase;
  return newState;
}

// Apply a hidden ban for a specific team
export function applyHiddenBan(
  state: DraftState,
  team: TeamKey,
  itemId: string,
): DraftState {
  if (!state.hiddenBanPhase) return state;
  const phase = state.hiddenBanPhase;

  const newState = structuredClone(state);
  const newPhase = { ...newState.hiddenBanPhase! };

  if (team === "team1") {
    if (newPhase.team1Bans.length >= newPhase.team1Count) return state;
    newPhase.team1Bans = [...newPhase.team1Bans, itemId];
  } else {
    if (newPhase.team2Bans.length >= newPhase.team2Count) return state;
    newPhase.team2Bans = [...newPhase.team2Bans, itemId];
  }

  newState.hiddenBanPhase = newPhase;

  // Check if both teams have completed their bans — if so, reveal
  if (
    newPhase.team1Bans.length >= newPhase.team1Count &&
    newPhase.team2Bans.length >= newPhase.team2Count
  ) {
    return revealHiddenBans(newState);
  }

  return newState;
}

// Reveal hidden bans: move them into the regular team data arrays and advance the step index
function revealHiddenBans(state: DraftState): DraftState {
  const phase = state.hiddenBanPhase;
  if (!phase) return state;

  const newState = structuredClone(state);
  const target = phase.target;

  // Push bans into team data in step order
  const totalSteps = phase.team1Count + phase.team2Count;
  let t1Idx = 0;
  let t2Idx = 0;
  for (let i = 0; i < totalSteps; i++) {
    const step = newState.config.steps[phase.startIndex + i];
    if (!step) break;
    const teamData = step.team === "team1" ? newState.team1 : newState.team2;
    const bans = step.team === "team1" ? phase.team1Bans : phase.team2Bans;
    const idx = step.team === "team1" ? t1Idx++ : t2Idx++;
    const banId = bans[idx];
    if (banId) {
      if (target === "civ") {
        teamData.civBans.push(banId);
      } else {
        teamData.mapBans.push(banId);
      }
    }
  }

  newState.currentStepIndex = phase.startIndex + totalSteps;
  newState.hiddenBanPhase = null;

  if (newState.currentStepIndex >= newState.config.steps.length) {
    newState.completed = true;
  }

  return newState;
}

// Check if a team has completed their hidden bans for the current phase
export function hasTeamCompletedHiddenBans(
  state: DraftState,
  team: TeamKey,
): boolean {
  const phase = state.hiddenBanPhase;
  if (!phase) return false;
  if (team === "team1") return phase.team1Bans.length >= phase.team1Count;
  return phase.team2Bans.length >= phase.team2Count;
}

// Get how many hidden bans a team still needs to submit
export function getRemainingHiddenBans(
  state: DraftState,
  team: TeamKey,
): number {
  const phase = state.hiddenBanPhase;
  if (!phase) return 0;
  if (team === "team1") return phase.team1Count - phase.team1Bans.length;
  return phase.team2Count - phase.team2Bans.length;
}

// Get available items for hidden banning (excludes own hidden bans already submitted)
export function getAvailableForHiddenBan(
  state: DraftState,
  team: TeamKey,
): string[] {
  const phase = state.hiddenBanPhase;
  if (!phase) return [];

  const myHiddenBans = new Set(
    team === "team1" ? phase.team1Bans : phase.team2Bans,
  );

  if (phase.target === "civ") {
    const allPicked = new Set([
      ...state.team1.civPicks,
      ...state.team2.civPicks,
    ]);
    const allBanned = new Set([...state.team1.civBans, ...state.team2.civBans]);
    return state.config.civPool.filter(
      (id) => !allPicked.has(id) && !allBanned.has(id) && !myHiddenBans.has(id),
    );
  } else {
    const allPicked = new Set([
      ...state.team1.mapPicks,
      ...state.team2.mapPicks,
    ]);
    const allBanned = new Set([...state.team1.mapBans, ...state.team2.mapBans]);
    return state.config.mapPool.filter(
      (id) => !allPicked.has(id) && !allBanned.has(id) && !myHiddenBans.has(id),
    );
  }
}

// Redact hidden bans from the state for a specific viewer role.
// The opponent's actual ban IDs are replaced with "__hidden__" placeholders so
// the array length (and thus hasTeamCompletedHiddenBans) is preserved, but the
// content is hidden.
export function redactHiddenBans(
  state: DraftState,
  viewerRole: string,
): DraftState {
  if (!state.hiddenBanPhase) return state;

  const viewerTeam = getTeamFromRole(viewerRole);
  const newState = structuredClone(state);
  const phase = newState.hiddenBanPhase!;

  const redact = (bans: string[]) => bans.map(() => "__hidden__");

  if (viewerTeam === "team1") {
    phase.team2Bans = redact(phase.team2Bans);
  } else if (viewerTeam === "team2") {
    phase.team1Bans = redact(phase.team1Bans);
  } else {
    // Spectators see counts but not content
    phase.team1Bans = redact(phase.team1Bans);
    phase.team2Bans = redact(phase.team2Bans);
  }

  return newState;
}

export function applyAction(state: DraftState, itemId: string): DraftState {
  const step = getCurrentStep(state);
  if (!step) return state;

  const newState = structuredClone(state);
  const teamData = step.team === "team1" ? newState.team1 : newState.team2;

  if (step.target === "civ") {
    if (step.action === "ban") {
      teamData.civBans.push(itemId);
    } else {
      teamData.civPicks.push(itemId);
    }
  } else {
    if (step.action === "ban") {
      teamData.mapBans.push(itemId);
    } else {
      teamData.mapPicks.push(itemId);
    }
  }

  newState.currentStepIndex += 1;
  if (newState.currentStepIndex >= newState.config.steps.length) {
    newState.completed = true;
  }

  return newState;
}

export function getCivName(id: string): string {
  return civById.get(id)?.name ?? id;
}

export function getCivFlag(id: string): string | undefined {
  return civById.get(id)?.flag;
}

export function getMapName(id: string): string {
  return mapById.get(id)?.name ?? id;
}

export function getStepActorName(config: DraftConfig, step: DraftStep): string {
  const players = getTeamPlayers(config, step.team);
  if (step.playerIndex !== undefined && step.playerIndex < players.length) {
    return players[step.playerIndex].name;
  }
  return getTeamName(config, step.team);
}

export function getStepActorLabel(
  config: DraftConfig,
  step: DraftStep,
): string {
  const teamLabel = step.team === "team1" ? "T1" : "T2";
  if (step.playerIndex !== undefined) {
    return `${teamLabel}P${step.playerIndex + 1}`;
  }
  return teamLabel;
}

// Get the team key from a role string
export function getTeamFromRole(role: string): TeamKey | null {
  if (role.startsWith("team1")) return "team1";
  if (role.startsWith("team2")) return "team2";
  return null;
}

export interface PresetGenerateOptions {
  hiddenBans?: boolean;
}

export interface PresetDraftFormat {
  label: string;
  description: string;
  generate: (
    teamSize: TeamSize,
    options?: PresetGenerateOptions,
  ) => DraftStep[];
}

function generateCivPicks(
  teamSize: TeamSize,
  picksPerPlayer: number,
): DraftStep[] {
  const steps: DraftStep[] = [];
  for (let round = 0; round < picksPerPlayer; round++) {
    for (let p = 0; p < teamSize; p++) {
      steps.push({
        action: "pick",
        target: "civ",
        team: "team1",
        playerIndex: p,
      });
      steps.push({
        action: "pick",
        target: "civ",
        team: "team2",
        playerIndex: p,
      });
    }
  }
  return steps;
}

export const PRESET_DRAFT_FORMATS: Record<string, PresetDraftFormat> = {
  default: {
    label: "Default",
    description:
      "1 map ban/team, 3 maps (last random), 2 civ bans/team, 3 civ picks/player",
    generate: (teamSize, options) => {
      const h = options?.hiddenBans ? true : undefined;
      const steps: DraftStep[] = [];
      // 1 map ban per team
      steps.push({ action: "ban", target: "map", team: "team1", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team2", hidden: h });
      // 3 map picks (T1, T2, random)
      steps.push({ action: "pick", target: "map", team: "team1" });
      steps.push({ action: "pick", target: "map", team: "team2" });
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // 2 civ bans per team
      for (let i = 0; i < 2; i++) {
        steps.push({ action: "ban", target: "civ", team: "team1", hidden: h });
        steps.push({ action: "ban", target: "civ", team: "team2", hidden: h });
      }
      // 3 civ picks per player
      steps.push(...generateCivPicks(teamSize, 3));
      return steps;
    },
  },
  bans: {
    label: "Bans",
    description:
      "2 map bans/team, 1 map pick (random), civ bans, 1 civ pick/player",
    generate: (teamSize, options) => {
      const h = options?.hiddenBans ? true : undefined;
      const steps: DraftStep[] = [];
      // 2 map bans per team
      steps.push({ action: "ban", target: "map", team: "team1", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team2", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team1", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team2", hidden: h });
      // 1 map pick (random)
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // Civ bans
      const civBansPerTeam = teamSize === 1 ? 3 : 2;
      for (let i = 0; i < civBansPerTeam; i++) {
        steps.push({ action: "ban", target: "civ", team: "team1", hidden: h });
        steps.push({ action: "ban", target: "civ", team: "team2", hidden: h });
      }
      // 1 civ pick per player
      steps.push(...generateCivPicks(teamSize, 1));
      return steps;
    },
  },
  "no-bans": {
    label: "No Bans",
    description: "1 map pick (random), 1 civ pick/player",
    generate: (teamSize) => {
      const steps: DraftStep[] = [];
      // 1 map pick (random)
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // 1 civ pick per player
      steps.push(...generateCivPicks(teamSize, 1));
      return steps;
    },
  },
  "bo3-bans": {
    label: "BO3 Bans",
    description:
      "2 map bans/team, 3 map picks (last random), civ bans, 3 civ picks/player",
    generate: (teamSize, options) => {
      const h = options?.hiddenBans ? true : undefined;
      const steps: DraftStep[] = [];
      // 2 map bans per team
      steps.push({ action: "ban", target: "map", team: "team1", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team2", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team1", hidden: h });
      steps.push({ action: "ban", target: "map", team: "team2", hidden: h });
      // 3 map picks (T1, T2, random)
      steps.push({ action: "pick", target: "map", team: "team1" });
      steps.push({ action: "pick", target: "map", team: "team2" });
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // Civ bans
      const civBansPerTeam = teamSize === 1 ? 3 : 2;
      for (let i = 0; i < civBansPerTeam; i++) {
        steps.push({ action: "ban", target: "civ", team: "team1", hidden: h });
        steps.push({ action: "ban", target: "civ", team: "team2", hidden: h });
      }
      // 3 civ picks per player
      steps.push(...generateCivPicks(teamSize, 3));
      return steps;
    },
  },
  "bo3-no-bans": {
    label: "BO3 No Bans",
    description: "3 map picks (last random), 3 civ picks/player",
    generate: (teamSize) => {
      const steps: DraftStep[] = [];
      // 3 map picks (T1, T2, random)
      steps.push({ action: "pick", target: "map", team: "team1" });
      steps.push({ action: "pick", target: "map", team: "team2" });
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // 3 civ picks per player
      steps.push(...generateCivPicks(teamSize, 3));
      return steps;
    },
  },
};
