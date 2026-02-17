"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { type DraftConfig } from "@/lib/draft";

type Stage = "input" | "team-select";

export default function SeedPage() {
  const [seedInput, setSeedInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("input");
  const [draftConfig, setDraftConfig] = useState<DraftConfig | null>(null);
  const [draftParams, setDraftParams] = useState<string>("");

  const parseSeedFromInput = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Full URL: extract seed param
    if (trimmed.includes("/draft?") || trimmed.includes("seed=")) {
      try {
        const url = trimmed.startsWith("http") ? new URL(trimmed) : null;
        const params = url
          ? url.searchParams
          : new URLSearchParams(
              trimmed.includes("?") ? trimmed.split("?")[1] : trimmed,
            );
        const seed = params.get("seed");
        if (seed) return seed;
      } catch {
        /* fall through */
      }
    }

    // Raw seed code (alphanumeric, 8-16 chars)
    if (/^[A-Z0-9]{8,16}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    return null;
  };

  const handleJoin = async () => {
    const seed = parseSeedFromInput(seedInput);
    if (!seed) {
      setError("Paste a draft link or seed code.");
      return;
    }

    try {
      const res = await fetch(`/api/draft?seed=${encodeURIComponent(seed)}`);
      const data = await res.json();
      if (!data.exists || !data.state?.config) {
        setError("Draft not found. It may have expired.");
        return;
      }
      setDraftConfig(data.state.config);
      setDraftParams(`seed=${seed}`);
      setStage("team-select");
    } catch {
      setError("Failed to load draft. Try again.");
    }
  };

  const handleRoleSelect = (role: string) => {
    window.location.href = `/draft?${draftParams}&role=${role}`;
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>

        {stage === "input" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Join Draft</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Paste the link shared by the admin.
              </p>
            </div>
            <div>
              <input
                type="text"
                value={seedInput}
                onChange={(e) => {
                  setSeedInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Paste draft link here..."
                className="w-full px-4 py-3 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm placeholder:text-muted-foreground/50 transition-colors"
                autoFocus
              />
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>
            <Button
              onClick={handleJoin}
              className="w-full h-12 font-semibold shadow-lg shadow-primary/20"
              size="lg"
            >
              Continue
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Need a link?{" "}
              <Link href="/admin" className="text-primary hover:underline">
                Create a draft
              </Link>
            </p>
          </div>
        )}

        {stage === "team-select" && draftConfig && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {draftConfig.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {draftConfig.teamSize}v{draftConfig.teamSize} — Choose your slot
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold mb-2">
                {draftConfig.team1Name}
              </p>
              {draftConfig.team1Players.map((player, i) => (
                <button
                  key={`t1_${i}`}
                  onClick={() => handleRoleSelect(`team1_p${i}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 ring-1 ring-blue-500/20 hover:ring-blue-500/40 transition-all text-sm group"
                >
                  <span className="font-medium">{player.name}</span>
                  <span className="text-blue-500/40 group-hover:text-blue-400 transition-colors">
                    →
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-2">
                {draftConfig.team2Name}
              </p>
              {draftConfig.team2Players.map((player, i) => (
                <button
                  key={`t2_${i}`}
                  onClick={() => handleRoleSelect(`team2_p${i}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 ring-1 ring-red-500/20 hover:ring-red-500/40 transition-all text-sm group"
                >
                  <span className="font-medium">{player.name}</span>
                  <span className="text-red-500/40 group-hover:text-red-400 transition-colors">
                    →
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => handleRoleSelect("spectator")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-card ring-1 ring-border hover:ring-muted-foreground/30 transition-all text-sm text-muted-foreground"
            >
              <Eye className="w-4 h-4" />
              <span>Spectator</span>
            </button>

            <button
              onClick={() => {
                setStage("input");
                setDraftConfig(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
