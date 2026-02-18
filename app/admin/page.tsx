"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { civilizations } from "@/data/civilizations";
import { maps } from "@/data/maps";
import {
  type DraftStep,
  type DraftConfig,
  type TeamSize,
  type TeamPlayer,
  type BanMode,
  generateSeed,
  PRESET_DRAFT_FORMATS,
} from "@/lib/draft";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  ArrowLeft,
  Shield,
  Crown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

const TEAM_SIZES: { value: TeamSize; label: string }[] = [
  { value: 1, label: "1v1" },
  { value: 2, label: "2v2" },
  { value: 3, label: "3v3" },
  { value: 4, label: "4v4" },
];

function makeDefaultPlayers(size: TeamSize, teamNum: 1 | 2): TeamPlayer[] {
  return Array.from({ length: size }, (_, i) => ({
    name: `Team ${teamNum} Player ${i + 1}`,
  }));
}

export default function AdminPage() {
  const [tournamentName, setTournamentName] = useState("AOE4 Tournament Draft");
  const [teamSize, setTeamSize] = useState<TeamSize>(1);
  const [banMode, setBanMode] = useState<BanMode>("global");
  const [allowDuplicatePicks, setAllowDuplicatePicks] = useState(false);
  const [randomOddMap, setRandomOddMap] = useState(true);
  const [team1Name, setTeam1Name] = useState("Team 1");
  const [team2Name, setTeam2Name] = useState("Team 2");
  const [team1Players, setTeam1Players] = useState<TeamPlayer[]>(
    makeDefaultPlayers(1, 1),
  );
  const [team2Players, setTeam2Players] = useState<TeamPlayer[]>(
    makeDefaultPlayers(1, 2),
  );
  const [selectedCivs, setSelectedCivs] = useState<Set<string>>(
    new Set(civilizations.map((c) => c.id)),
  );
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(
    new Set(maps.map((m) => m.id)),
  );
  const [steps, setSteps] = useState<DraftStep[]>(
    PRESET_DRAFT_FORMATS["default"].generate(1),
  );
  const [generatedSeed, setGeneratedSeed] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Hydrate from sessionStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    try {
      const seed = sessionStorage.getItem("draft_seed");
      const url = sessionStorage.getItem("draft_url");
      if (seed) setGeneratedSeed(seed);
      if (url) setGeneratedUrl(url);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [civFilter, setCivFilter] = useState<string>("all");
  const [mapFilter, setMapFilter] = useState<string>("all");

  const handleTeamSizeChange = (size: TeamSize) => {
    setTeamSize(size);
    setTeam1Players(makeDefaultPlayers(size, 1));
    setTeam2Players(makeDefaultPlayers(size, 2));
    if (size === 1) {
      setTeam1Name("Team 1");
      setTeam2Name("Team 2");
    }
    setSteps(PRESET_DRAFT_FORMATS["default"].generate(size));
    setGeneratedUrl(null);
    setGeneratedSeed(null);
    setGenerateError(null);
    try {
      sessionStorage.removeItem("draft_seed");
      sessionStorage.removeItem("draft_url");
    } catch {
      /* storage unavailable */
    }
  };

  const updatePlayer = (team: 1 | 2, index: number, name: string) => {
    const setter = team === 1 ? setTeam1Players : setTeam2Players;
    const players = team === 1 ? team1Players : team2Players;
    const next = [...players];
    next[index] = { name };
    setter(next);
  };

  const civExpansions = useMemo(() => {
    const exps = new Set(civilizations.map((c) => c.expansion ?? "Unknown"));
    return ["all", ...Array.from(exps)];
  }, []);

  const mapTypes = useMemo(() => {
    const types = new Set(maps.map((m) => m.type));
    return ["all", ...Array.from(types)];
  }, []);

  const filteredCivs = useMemo(() => {
    if (civFilter === "all") return civilizations;
    return civilizations.filter((c) => c.expansion === civFilter);
  }, [civFilter]);

  const filteredMaps = useMemo(() => {
    if (mapFilter === "all") return maps;
    return maps.filter((m) => m.type === mapFilter);
  }, [mapFilter]);

  const toggleCiv = (id: string) => {
    const next = new Set(selectedCivs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCivs(next);
  };

  const toggleMap = (id: string) => {
    const next = new Set(selectedMaps);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMaps(next);
  };

  const selectAllCivs = () =>
    setSelectedCivs(new Set(civilizations.map((c) => c.id)));
  const deselectAllCivs = () => setSelectedCivs(new Set());

  const selectAllMaps = () => setSelectedMaps(new Set(maps.map((m) => m.id)));
  const deselectAllMaps = () => setSelectedMaps(new Set());

  const addStep = () => {
    setSteps([...steps, { action: "ban", target: "civ", team: "team1" }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...steps];
    if (field === "team") {
      newSteps[index] = {
        ...newSteps[index],
        team: value as "team1" | "team2",
      };
    } else if (field === "action") {
      newSteps[index] = { ...newSteps[index], action: value as "ban" | "pick" };
    } else if (field === "target") {
      newSteps[index] = { ...newSteps[index], target: value as "civ" | "map" };
    } else if (field === "playerIndex") {
      newSteps[index] = {
        ...newSteps[index],
        playerIndex: value === "" ? undefined : parseInt(value),
      };
    }
    setSteps(newSteps);
  };

  const loadPreset = (presetKey: string) => {
    const preset = PRESET_DRAFT_FORMATS[presetKey];
    if (preset) {
      setSteps(preset.generate(teamSize));
      setGeneratedUrl(null);
      setGeneratedSeed(null);
      setGenerateError(null);
      try {
        sessionStorage.removeItem("draft_seed");
        sessionStorage.removeItem("draft_url");
      } catch {
        /* storage unavailable */
      }
    }
  };

  const handleGenerate = async () => {
    if (
      selectedCivs.size === 0 ||
      selectedMaps.size === 0 ||
      steps.length === 0
    ) {
      setGenerateError(
        "Please select at least one civilization, one map, and one draft step.",
      );
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const seed = generateSeed();
      // Apply or strip auto flag on the last odd map pick based on toggle
      const finalSteps = steps.map((s, i) => {
        const mapPickIndices = steps
          .map((st, idx) =>
            st.action === "pick" && st.target === "map" ? idx : -1,
          )
          .filter((idx) => idx >= 0);
        const isLastMapPick =
          mapPickIndices.length % 2 === 1 &&
          i === mapPickIndices[mapPickIndices.length - 1];
        if (isLastMapPick) {
          return { ...s, auto: randomOddMap ? true : undefined };
        }
        return { ...s, auto: undefined };
      });

      const config: DraftConfig = {
        name: tournamentName,
        teamSize,
        banMode,
        allowDuplicatePicks: teamSize > 1 ? allowDuplicatePicks : false,
        civPool: Array.from(selectedCivs),
        mapPool: Array.from(selectedMaps),
        steps: finalSteps,
        team1Name,
        team2Name,
        team1Players,
        team2Players,
      };

      // Save initial state to server so URLs only need the seed
      const initialState = {
        config,
        currentStepIndex: 0,
        team1: { civBans: [], civPicks: [], mapBans: [], mapPicks: [] },
        team2: { civBans: [], civPicks: [], mapBans: [], mapPicks: [] },
        completed: false,
      };
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, state: initialState, history: [] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGenerateError(
          data.error || "Failed to save draft to server. Please try again.",
        );
        return;
      }

      const data = await res.json();
      if (!data.ok) {
        setGenerateError("Failed to save draft to server. Please try again.");
        return;
      }

      const url = `${window.location.origin}/draft?seed=${seed}`;

      setGeneratedSeed(seed);
      setGeneratedUrl(url);
      try {
        sessionStorage.setItem("draft_seed", seed);
        sessionStorage.setItem("draft_url", url);
      } catch {
        /* storage unavailable */
      }
    } catch {
      setGenerateError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback: select the text in the input for manual copy
      setCopiedIndex(null);
    }
  };

  // Build invitation links for each player slot
  const invitationLinks = useMemo(() => {
    if (!generatedUrl) return [];
    const links: { label: string; role: string; color: string; url: string }[] =
      [];

    for (let i = 0; i < teamSize; i++) {
      links.push({
        label: team1Players[i]?.name || `Team 1 Player ${i + 1}`,
        role: `team1_p${i}`,
        color: "blue",
        url: `${generatedUrl}&role=team1_p${i}`,
      });
    }
    for (let i = 0; i < teamSize; i++) {
      links.push({
        label: team2Players[i]?.name || `Team 2 Player ${i + 1}`,
        role: `team2_p${i}`,
        color: "red",
        url: `${generatedUrl}&role=team2_p${i}`,
      });
    }
    links.push({
      label: "Spectator",
      role: "spectator",
      color: "gray",
      url: `${generatedUrl}&role=spectator`,
    });

    return links;
  }, [generatedUrl, teamSize, team1Players, team2Players]);

  const [showCivPool, setShowCivPool] = useState(false);
  const [showMapPool, setShowMapPool] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const inputClass =
    "w-full px-3 py-2.5 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm placeholder:text-muted-foreground/50 transition-colors";

  return (
    <main className="min-h-screen px-4 pb-8 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create Draft</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a ban/pick session and share links with players.
          </p>
        </div>

        {/* Step 1: Game Mode */}
        <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
          <h2 className="text-sm font-semibold mb-4">Game Mode</h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {TEAM_SIZES.map((ts) => (
              <button
                key={ts.value}
                onClick={() => handleTeamSizeChange(ts.value)}
                className={`py-3 rounded-lg font-bold text-base transition-all ${
                  teamSize === ts.value
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {ts.label}
              </button>
            ))}
          </div>

          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            Ban Mode
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setBanMode("global")}
              className={`py-2.5 px-3 rounded-lg text-sm text-left transition-all ${
                banMode === "global"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-semibold block">Global</span>
              <span className="text-[11px] opacity-70">
                Banned civs/maps removed for both teams
              </span>
            </button>
            <button
              onClick={() => setBanMode("per-team")}
              className={`py-2.5 px-3 rounded-lg text-sm text-left transition-all ${
                banMode === "per-team"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-semibold block">Per-Team</span>
              <span className="text-[11px] opacity-70">
                Your bans only affect the other team
              </span>
            </button>
          </div>

          <h3 className="text-xs font-semibold text-muted-foreground mb-2 mt-4">
            Odd Map Pick
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRandomOddMap(true)}
              className={`py-2.5 px-3 rounded-lg text-sm text-left transition-all ${
                randomOddMap
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-semibold block">Randomise</span>
              <span className="text-[11px] opacity-70">
                Last odd map pick is randomly selected
              </span>
            </button>
            <button
              onClick={() => setRandomOddMap(false)}
              className={`py-2.5 px-3 rounded-lg text-sm text-left transition-all ${
                !randomOddMap
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-semibold block">Manual</span>
              <span className="text-[11px] opacity-70">
                All map picks are chosen by teams
              </span>
            </button>
          </div>

          {teamSize > 1 && (
            <>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 mt-4">
                Duplicate Civ Picks
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAllowDuplicatePicks(false)}
                  className={`py-2.5 px-3 rounded-lg text-sm text-left transition-all ${
                    !allowDuplicatePicks
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-semibold block">Unique</span>
                  <span className="text-[11px] opacity-70">
                    Each civ can only be picked once per team
                  </span>
                </button>
                <button
                  onClick={() => setAllowDuplicatePicks(true)}
                  className={`py-2.5 px-3 rounded-lg text-sm text-left transition-all ${
                    allowDuplicatePicks
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-secondary/50 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-semibold block">Allow Duplicates</span>
                  <span className="text-[11px] opacity-70">
                    Teammates can pick the same civ
                  </span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* Step 2: Names */}
        <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
          <h2 className="text-sm font-semibold mb-4">Players</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              placeholder="Draft name"
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <input
                  type="text"
                  value={team1Name}
                  onChange={(e) => setTeam1Name(e.target.value)}
                  className={`${inputClass} !border-blue-800/60 focus:!ring-blue-500/40 focus:!border-blue-500/60`}
                />
                {teamSize > 1 &&
                  team1Players.map((p, i) => (
                    <input
                      key={i}
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePlayer(1, i, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      className={`${inputClass} !border-blue-900/40 !text-xs !py-2`}
                    />
                  ))}
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={team2Name}
                  onChange={(e) => setTeam2Name(e.target.value)}
                  className={`${inputClass} !border-red-800/60 focus:!ring-red-500/40 focus:!border-red-500/60`}
                />
                {teamSize > 1 &&
                  team2Players.map((p, i) => (
                    <input
                      key={i}
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePlayer(2, i, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      className={`${inputClass} !border-red-900/40 !text-xs !py-2`}
                    />
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* Step 3: Pools (collapsible) */}
        <section className="mb-6 rounded-xl bg-card border border-border/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Pools</h2>
            <span className="text-xs text-muted-foreground">
              All selected by default
            </span>
          </div>
          <div className="space-y-2">
            {/* Civ Pool */}
            <div className="rounded-lg bg-secondary/30 border border-border overflow-hidden">
              <button
                onClick={() => setShowCivPool(!showCivPool)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent/30 transition-colors"
              >
                <span className="font-medium">
                  Civilizations{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedCivs.size}/{civilizations.length})
                  </span>
                </span>
                {showCivPool ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {showCivPool && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="flex flex-wrap gap-1.5 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={selectAllCivs}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={deselectAllCivs}
                    >
                      None
                    </Button>
                    <span className="border-l border-border mx-0.5" />
                    {civExpansions
                      .filter((e) => e !== "all")
                      .map((exp) => (
                        <Button
                          key={exp}
                          size="sm"
                          variant={civFilter === exp ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() =>
                            setCivFilter(civFilter === exp ? "all" : exp)
                          }
                        >
                          {exp}
                        </Button>
                      ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {filteredCivs.map((civ) => (
                      <button
                        key={civ.id}
                        onClick={() => toggleCiv(civ.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg text-left transition-all ${selectedCivs.has(civ.id) ? "bg-accent border border-primary/30" : "opacity-35 hover:opacity-60 border border-transparent"}`}
                      >
                        {civ.flag && (
                          <img
                            src={civ.flag}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        )}
                        <span className="truncate text-xs font-medium">
                          {civ.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Map Pool */}
            <div className="rounded-lg bg-secondary/30 border border-border overflow-hidden">
              <button
                onClick={() => setShowMapPool(!showMapPool)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent/30 transition-colors"
              >
                <span className="font-medium">
                  Maps{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedMaps.size}/{maps.length})
                  </span>
                </span>
                {showMapPool ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {showMapPool && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="flex flex-wrap gap-1.5 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={selectAllMaps}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={deselectAllMaps}
                    >
                      None
                    </Button>
                    <span className="border-l border-border mx-0.5" />
                    {mapTypes
                      .filter((t) => t !== "all")
                      .map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant={mapFilter === type ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() =>
                            setMapFilter(mapFilter === type ? "all" : type)
                          }
                        >
                          {type}
                        </Button>
                      ))}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                    {filteredMaps.map((map) => (
                      <button
                        key={map.id}
                        onClick={() => toggleMap(map.id)}
                        className={`p-2 rounded-lg text-left transition-all text-xs ${selectedMaps.has(map.id) ? "bg-accent border border-primary/30" : "opacity-35 hover:opacity-60 border border-transparent"}`}
                      >
                        <span className="font-medium truncate block">
                          {map.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Draft Steps (Advanced) */}
            <div className="rounded-lg bg-secondary/30 border border-border overflow-hidden">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-accent/30 transition-colors"
              >
                <span className="font-medium">
                  Draft Order{" "}
                  <span className="text-muted-foreground font-normal">
                    ({steps.length} steps)
                  </span>
                </span>
                {showSteps ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {showSteps && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="flex flex-wrap gap-1.5 py-3">
                    <span className="text-xs text-muted-foreground mr-1 self-center">
                      Presets:
                    </span>
                    {Object.entries(PRESET_DRAFT_FORMATS).map(
                      ([key, preset]) => (
                        <Button
                          key={key}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => loadPreset(key)}
                        >
                          {preset.label}
                        </Button>
                      ),
                    )}
                  </div>
                  <div className="space-y-1 mb-3 max-h-[280px] overflow-y-auto">
                    {steps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1.5 p-1.5 bg-secondary/40 rounded text-xs"
                      >
                        <span className="text-muted-foreground w-5 text-center font-mono">
                          {index + 1}
                        </span>
                        <select
                          value={step.team}
                          onChange={(e) =>
                            updateStep(index, "team", e.target.value)
                          }
                          className="px-1.5 py-1 bg-input rounded border border-border text-xs"
                        >
                          <option value="team1">{team1Name}</option>
                          <option value="team2">{team2Name}</option>
                        </select>
                        <select
                          value={step.action}
                          onChange={(e) =>
                            updateStep(index, "action", e.target.value)
                          }
                          className="px-1.5 py-1 bg-input rounded border border-border text-xs"
                        >
                          <option value="ban">Ban</option>
                          <option value="pick">Pick</option>
                        </select>
                        <select
                          value={step.target}
                          onChange={(e) =>
                            updateStep(index, "target", e.target.value)
                          }
                          className="px-1.5 py-1 bg-input rounded border border-border text-xs"
                        >
                          <option value="civ">Civ</option>
                          <option value="map">Map</option>
                        </select>
                        {step.action === "pick" &&
                          step.target === "civ" &&
                          teamSize > 1 && (
                            <select
                              value={step.playerIndex ?? ""}
                              onChange={(e) =>
                                updateStep(index, "playerIndex", e.target.value)
                              }
                              className="px-1.5 py-1 bg-input rounded border border-border text-xs"
                            >
                              <option value="">Team</option>
                              {Array.from({ length: teamSize }, (_, i) => {
                                const players =
                                  step.team === "team1"
                                    ? team1Players
                                    : team2Players;
                                return (
                                  <option key={i} value={i}>
                                    {players[i]?.name || `P${i + 1}`}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                        <div className="flex-1" />
                        <span
                          className={`px-1.5 py-0.5 rounded ${step.action === "ban" ? "bg-red-900/40 text-red-400" : "bg-green-900/40 text-green-400"}`}
                        >
                          {step.action === "ban" ? (
                            <Shield className="w-3 h-3 inline" />
                          ) : (
                            <Crown className="w-3 h-3 inline" />
                          )}
                        </span>
                        <button
                          onClick={() => removeStep(index)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addStep}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Plus className="w-3 h-3" /> Add Step
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Step 4: Generate */}
        <section className="mb-6">
          <div>
            <Button
              onClick={handleGenerate}
              size="lg"
              disabled={isGenerating}
              className="w-full h-12 text-sm font-semibold shadow-lg shadow-primary/20"
            >
              {isGenerating ? "Generating..." : "Generate Draft Links"}
            </Button>
            {generateError && (
              <p className="text-xs text-red-400 mt-2 text-center">
                {generateError}
              </p>
            )}
          </div>
        </section>

        {/* Generated Links */}
        {generatedUrl && (
          <section className="mb-8 space-y-4">
            <div className="p-5 rounded-xl bg-card border border-border/50 space-y-5">
              <p className="text-xs text-muted-foreground font-mono">
                Seed: {generatedSeed}
              </p>

              {[
                {
                  label: team1Name,
                  color: "blue" as const,
                  links: invitationLinks.filter((l) => l.color === "blue"),
                },
                {
                  label: team2Name,
                  color: "red" as const,
                  links: invitationLinks.filter((l) => l.color === "red"),
                },
              ].map((group) => (
                <div key={group.color}>
                  <p
                    className={`text-xs font-semibold mb-2 ${group.color === "blue" ? "text-blue-400" : "text-red-400"}`}
                  >
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.links.map((link, i) => {
                      const idx = group.color === "red" ? teamSize + i : i;
                      return (
                        <div
                          key={link.role}
                          className="flex items-center gap-2"
                        >
                          <span className="text-xs text-muted-foreground w-24 truncate shrink-0">
                            {link.label}
                          </span>
                          <input
                            type="text"
                            readOnly
                            value={link.url}
                            className="flex-1 px-2.5 py-1.5 bg-input rounded-md border border-border text-[11px] font-mono truncate"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 h-7 text-xs gap-1"
                            onClick={() => handleCopy(link.url, idx)}
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedIndex === idx ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <p className="text-xs font-semibold mb-2 text-muted-foreground">
                  Spectator
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      invitationLinks.find((l) => l.role === "spectator")
                        ?.url ?? ""
                    }
                    className="flex-1 px-2.5 py-1.5 bg-input rounded-md border border-border text-[11px] font-mono truncate"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 text-xs gap-1"
                    onClick={() =>
                      handleCopy(
                        invitationLinks.find((l) => l.role === "spectator")
                          ?.url ?? "",
                        99,
                      )
                    }
                  >
                    {copiedIndex === 99 ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedIndex === 99 ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
