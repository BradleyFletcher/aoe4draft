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
  hidden?: boolean; // if true, this ban/pick is part of a simultaneous hidden phase
}

// Tracks a simultaneous hidden phase where both teams act at the same time
export interface HiddenBanPhase {
  startIndex: number; // index of first step in this phase
  team1Bans: string[]; // submissions by team1 (hidden from team2)
  team2Bans: string[]; // submissions by team2 (hidden from team1)
  team1Count: number; // how many submissions team1 needs
  team2Count: number; // how many submissions team2 needs
  target: DraftActionTarget; // civ or map
  action: DraftActionType; // ban or pick
}

export interface TeamPlayer {
  name: string;
}

export interface DraftConfig {
  name: string;
  teamSize: TeamSize;
  banMode: BanMode;
  allowDuplicatePicks: boolean;
  uniqueCivsAcrossTeams: boolean; // Prevent both teams from picking the same civ
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
  civPicks: string[];
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
  hiddenBanPhase?: HiddenBanPhase | null; // active hidden phase, null when not in one
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
const MAX_STEPS = 300;
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

// Helper to combine data from both teams into a single set
function combineTeamData<T>(team1: T[], team2: T[]): Set<T> {
  return new Set([...team1, ...team2]);
}

// Helper to get all picks/bans from both teams, including hidden phase
function getAllTeamItems(
  state: DraftState,
  target: "civ" | "map",
  type: "bans" | "picks",
): Set<string> {
  const team1Items =
    target === "civ"
      ? type === "bans"
        ? state.team1.civBans
        : state.team1.civPicks
      : type === "bans"
        ? state.team1.mapBans
        : state.team1.mapPicks;
  const team2Items =
    target === "civ"
      ? type === "bans"
        ? state.team2.civBans
        : state.team2.civPicks
      : type === "bans"
        ? state.team2.mapBans
        : state.team2.mapPicks;

  const combined = combineTeamData(team1Items, team2Items);

  // Include hidden phase items if applicable
  if (state.hiddenBanPhase && state.hiddenBanPhase.target === target) {
    if (type === "bans" || state.hiddenBanPhase.action === "pick") {
      state.hiddenBanPhase.team1Bans.forEach((id) => combined.add(id));
      state.hiddenBanPhase.team2Bans.forEach((id) => combined.add(id));
    }
  }

  return combined;
}

// Helper to filter a pool by excluding items from sets
function filterPool<T>(pool: T[], excludeSets: Set<T>[]): T[] {
  return pool.filter((item) => !excludeSets.some((set) => set.has(item)));
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
  if (!step) return [];
  const isPerTeam = state.config.banMode === "per-team";

  if (step.action === "ban") {
    // Exclude civs already picked
    const allPicked = getAllTeamItems(state, "civ", "picks");
    // Global: can't ban anything already banned by either team
    // Per-team: can only see your own bans as used
    const bannedSet = isPerTeam
      ? new Set(getTeamData(state, step.team).civBans)
      : getAllTeamItems(state, "civ", "bans");
    return filterPool(state.config.civPool, [allPicked, bannedSet]);
  }

  // Picking: exclude bans and already-picked civs
  const allowDupes = state.config.allowDuplicatePicks;
  const uniqueAcrossTeams = state.config.uniqueCivsAcrossTeams;

  // Collect picks that should block this player
  let blocked = new Set<string>();
  if (step.playerIndex !== undefined) {
    // Walk steps up to current to find THIS player's picks
    let pickIdx = 0;
    const teamPicks = getTeamData(state, step.team).civPicks;
    for (const s of state.config.steps.slice(0, state.currentStepIndex)) {
      if (s.action !== "pick" || s.target !== "civ" || s.team !== step.team)
        continue;
      if (s.playerIndex === step.playerIndex && pickIdx < teamPicks.length) {
        blocked.add(teamPicks[pickIdx]);
      }
      pickIdx++;
    }
    // If duplicates NOT allowed, block all team picks
    if (!allowDupes) {
      for (const id of getTeamData(state, step.team).civPicks) {
        blocked.add(id);
      }
    }
    // If unique across teams, block other team's picks too
    if (uniqueAcrossTeams) {
      const otherTeam = step.team === "team1" ? "team2" : "team1";
      const otherTeamPicks = getTeamData(state, otherTeam).civPicks;
      for (const id of otherTeamPicks) {
        blocked.add(id);
      }
      // Also include hidden phase picks from other team
      if (
        state.hiddenBanPhase &&
        state.hiddenBanPhase.target === "civ" &&
        state.hiddenBanPhase.action === "pick"
      ) {
        const otherHiddenPicks =
          otherTeam === "team1"
            ? state.hiddenBanPhase.team1Bans
            : state.hiddenBanPhase.team2Bans;
        for (const id of otherHiddenPicks) {
          blocked.add(id);
        }
      }
    }
  } else {
    blocked = new Set(getTeamData(state, step.team).civPicks);
    // If unique across teams, block other team's picks too
    if (uniqueAcrossTeams) {
      const otherTeam = step.team === "team1" ? "team2" : "team1";
      const otherTeamPicks = getTeamData(state, otherTeam).civPicks;
      for (const id of otherTeamPicks) {
        blocked.add(id);
      }
      // Also include hidden phase picks from other team
      if (
        state.hiddenBanPhase &&
        state.hiddenBanPhase.target === "civ" &&
        state.hiddenBanPhase.action === "pick"
      ) {
        const otherHiddenPicks =
          otherTeam === "team1"
            ? state.hiddenBanPhase.team1Bans
            : state.hiddenBanPhase.team2Bans;
        for (const id of otherHiddenPicks) {
          blocked.add(id);
        }
      }
    }
  }

  // Determine which bans to apply
  if (isPerTeam) {
    const otherTeam = step.team === "team1" ? "team2" : "team1";
    const otherBans = getAllTeamItems(state, "civ", "bans");
    // Filter out this team's bans from the combined set
    const myBans = new Set(getTeamData(state, step.team).civBans);
    const otherOnlyBans = new Set(
      [...otherBans].filter((id) => !myBans.has(id)),
    );
    return filterPool(state.config.civPool, [otherOnlyBans, blocked]);
  }

  const allBanned = getAllTeamItems(state, "civ", "bans");
  return filterPool(state.config.civPool, [allBanned, blocked]);
}

export function getAvailableMaps(state: DraftState): string[] {
  const step = getCurrentStep(state);
  const isPerTeam = state.config.banMode === "per-team";
  const allPicked = getAllTeamItems(state, "map", "picks");

  if (step?.action === "ban") {
    // Global: can't ban anything already banned by either team
    // Per-team: only your own bans are excluded (other team can ban the same map)
    const bannedSet = isPerTeam
      ? new Set(getTeamData(state, step.team).mapBans)
      : getAllTeamItems(state, "map", "bans");
    return filterPool(state.config.mapPool, [allPicked, bannedSet]);
  }

  // When picking:
  // Global mode: all bans excluded
  // Per-team mode: only the other team's bans affect you
  if (isPerTeam && step) {
    const otherTeam = step.team === "team1" ? "team2" : "team1";
    const allBans = getAllTeamItems(state, "map", "bans");
    // Filter out this team's bans from the combined set
    const myBans = new Set(getTeamData(state, step.team).mapBans);
    const otherOnlyBans = new Set([...allBans].filter((id) => !myBans.has(id)));
    return filterPool(state.config.mapPool, [allPicked, otherOnlyBans]);
  }

  const allBanned = getAllTeamItems(state, "map", "bans");
  return filterPool(state.config.mapPool, [allPicked, allBanned]);
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

// Detect a hidden phase starting at a given step index.
// A hidden phase is a contiguous run of hidden steps with the same target and action.
export function detectHiddenPhase(
  config: DraftConfig,
  startIndex: number,
): HiddenBanPhase | null {
  const step = config.steps[startIndex];
  if (!step?.hidden) return null;

  const target = step.target;
  let team1Count = 0;
  let team2Count = 0;

  for (let i = startIndex; i < config.steps.length; i++) {
    const s = config.steps[i];
    if (!s.hidden || s.target !== target || s.action !== step.action) break;
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
    action: step.action,
  };
}

// Check if the current step is a hidden phase that needs initialisation
export function isHiddenBanStep(state: DraftState): boolean {
  const step = getCurrentStep(state);
  return !!step?.hidden;
}

// Get or initialise the active hidden phase
export function getOrInitHiddenPhase(state: DraftState): DraftState {
  if (state.hiddenBanPhase) return state;
  const phase = detectHiddenPhase(state.config, state.currentStepIndex);
  if (!phase) return state;
  const newState = structuredClone(state);
  newState.hiddenBanPhase = phase;
  return newState;
}

// Submit a hidden-phase item (ban or pick) for a specific team
export function applyHiddenBan(
  state: DraftState,
  team: TeamKey,
  itemId: string,
): DraftState {
  if (!state.hiddenBanPhase) return state;

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

  // Check if both teams have completed — if so, reveal
  if (
    newPhase.team1Bans.length >= newPhase.team1Count &&
    newPhase.team2Bans.length >= newPhase.team2Count
  ) {
    return revealHiddenPhase(newState);
  }

  return newState;
}

// Reveal hidden phase: move submissions into the regular team data arrays and advance step index
function revealHiddenPhase(state: DraftState): DraftState {
  const phase = state.hiddenBanPhase;
  if (!phase) return state;

  let newState = structuredClone(state);

  // Push items into team data in step order
  const totalSteps = phase.team1Count + phase.team2Count;
  let t1Idx = 0;
  let t2Idx = 0;
  for (let i = 0; i < totalSteps; i++) {
    const step = newState.config.steps[phase.startIndex + i];
    if (!step) break;
    const teamData = step.team === "team1" ? newState.team1 : newState.team2;
    const items = step.team === "team1" ? phase.team1Bans : phase.team2Bans;
    const idx = step.team === "team1" ? t1Idx++ : t2Idx++;
    const itemId = items[idx];
    if (itemId) {
      if (step.target === "civ") {
        if (step.action === "ban") teamData.civBans.push(itemId);
        else teamData.civPicks.push(itemId);
      } else {
        if (step.action === "ban") teamData.mapBans.push(itemId);
        else teamData.mapPicks.push(itemId);
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

// Check if a team has completed their submissions for the current hidden phase
export function hasTeamCompletedHiddenBans(
  state: DraftState,
  team: TeamKey,
): boolean {
  const phase = state.hiddenBanPhase;
  if (!phase) return false;
  if (team === "team1") return phase.team1Bans.length >= phase.team1Count;
  return phase.team2Bans.length >= phase.team2Count;
}

// Get how many items a team still needs to submit in the current hidden phase
export function getRemainingHiddenBans(
  state: DraftState,
  team: TeamKey,
): number {
  const phase = state.hiddenBanPhase;
  if (!phase) return 0;
  if (team === "team1") return phase.team1Count - phase.team1Bans.length;
  return phase.team2Count - phase.team2Bans.length;
}

// Get available items for hidden phase submission (excludes own submissions already made)
export function getAvailableForHiddenBan(
  state: DraftState,
  team: TeamKey,
): string[] {
  const phase = state.hiddenBanPhase;
  if (!phase) return [];

  const mySubmissions = new Set(
    team === "team1" ? phase.team1Bans : phase.team2Bans,
  );

  // Figure out what the team still needs to submit: find the next unsubmitted step
  const submitted =
    team === "team1" ? phase.team1Bans.length : phase.team2Bans.length;
  let count = 0;
  let nextStep: DraftStep | null = null;
  for (
    let i = phase.startIndex;
    i < phase.startIndex + phase.team1Count + phase.team2Count;
    i++
  ) {
    const s = state.config.steps[i];
    if (!s || s.team !== team) continue;
    if (count === submitted) {
      nextStep = s;
      break;
    }
    count++;
  }
  if (!nextStep) return [];

  if (phase.target === "civ") {
    const allPicked = new Set([
      ...state.team1.civPicks,
      ...state.team2.civPicks,
    ]);
    const allBanned = new Set([...state.team1.civBans, ...state.team2.civBans]);
    return state.config.civPool.filter(
      (id) =>
        !allPicked.has(id) && !allBanned.has(id) && !mySubmissions.has(id),
    );
  } else {
    const allPicked = new Set([
      ...state.team1.mapPicks,
      ...state.team2.mapPicks,
    ]);
    const allBanned = new Set([...state.team1.mapBans, ...state.team2.mapBans]);
    return state.config.mapPool.filter(
      (id) =>
        !allPicked.has(id) && !allBanned.has(id) && !mySubmissions.has(id),
    );
  }
}

// Redact hidden phase submissions from the state for a specific viewer role.
// The opponent's actual IDs are replaced with "__hidden__" placeholders so
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

  const redact = (items: string[]) => items.map(() => "__hidden__");

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

  let newState = structuredClone(state);
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

export function getMapImage(id: string): string | undefined {
  return mapById.get(id)?.image;
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

// Helper: add civ ban + civ pick steps for each player
function addCivSteps(
  steps: DraftStep[],
  teamSize: TeamSize,
  civBansPerTeam: number,
  hidden?: true,
) {
  // Civ bans
  for (let b = 0; b < civBansPerTeam; b++) {
    steps.push({ action: "ban", target: "civ", team: "team1", hidden });
    steps.push({ action: "ban", target: "civ", team: "team2", hidden });
  }
  // Civ picks (1 per player per team)
  for (let p = 0; p < teamSize; p++) {
    steps.push({
      action: "pick",
      target: "civ",
      team: "team1",
      playerIndex: p,
      hidden,
    });
    steps.push({
      action: "pick",
      target: "civ",
      team: "team2",
      playerIndex: p,
      hidden,
    });
  }
}

export const PRESET_DRAFT_FORMATS: Record<string, PresetDraftFormat> = {
  default: {
    label: "Default",
    description:
      "1 map ban/team, 3 maps (last random), 2 civ bans/team, 1 civ pick/player",
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
      // Civ bans + picks
      addCivSteps(steps, teamSize, 2, h);
      return steps;
    },
  },
  bans: {
    label: "Bans",
    description:
      "2 map bans/team, 1 map (random), civ bans + 1 civ pick/player",
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
      // Civ bans + picks
      const civBansPerTeam = teamSize === 1 ? 3 : 2;
      addCivSteps(steps, teamSize, civBansPerTeam, h);
      return steps;
    },
  },
  "no-bans": {
    label: "No Bans",
    description: "1 map (random), 1 civ pick/player, no bans",
    generate: (teamSize) => {
      const steps: DraftStep[] = [];
      // 1 map pick (random)
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // Civ picks only (no bans)
      addCivSteps(steps, teamSize, 0);
      return steps;
    },
  },
  "bo3-bans": {
    label: "BO3 Bans",
    description:
      "2 map bans/team, 3 maps (last random), civ bans + 1 civ pick/player",
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
      // Civ bans + picks
      const civBansPerTeam = teamSize === 1 ? 3 : 2;
      addCivSteps(steps, teamSize, civBansPerTeam, h);
      return steps;
    },
  },
  "bo3-no-bans": {
    label: "BO3 No Bans",
    description: "3 maps (last random), 1 civ pick/player, no bans",
    generate: (teamSize) => {
      const steps: DraftStep[] = [];
      // 3 map picks (T1, T2, random)
      steps.push({ action: "pick", target: "map", team: "team1" });
      steps.push({ action: "pick", target: "map", team: "team2" });
      steps.push({ action: "pick", target: "map", team: "team1", auto: true });
      // Civ picks only (no bans)
      addCivSteps(steps, teamSize, 0);
      return steps;
    },
  },
};
