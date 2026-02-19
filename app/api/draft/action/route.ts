import { NextRequest, NextResponse } from "next/server";
import { modifyDraft, isValidSeed } from "@/lib/storage";
import type { DraftRecord } from "@/lib/storage";
import {
  setPlayerReady,
  getOrInitHiddenPhase,
  applyHiddenBan,
  isHiddenBanStep,
  isAutoStep,
  resolveAutoStep,
  getTeamFromRole,
  type DraftState,
  type TeamKey,
} from "@/lib/draft";
import { publish } from "@/lib/draft-events";

// POST /api/draft/action
// Atomic server-side operations: reads current state, applies a mutation, and
// writes — all inside a per-seed write lock. This prevents race conditions
// where two clients overwrite each other's data (e.g. simultaneous hidden bans).
//
// Body: { seed, action, role, itemId? }
// Actions:
//   "ready"        — mark a player as ready
//   "init-hidden"  — initialise the hidden ban phase
//   "hidden-ban"   — submit a hidden ban (requires itemId)
//   "auto-resolve" — server picks a random item for an auto step (e.g. odd map)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seed, action, role, itemId } = body;

    if (!seed || !isValidSeed(seed)) {
      return NextResponse.json({ error: "Invalid seed" }, { status: 400 });
    }
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }
    if (!role || typeof role !== "string") {
      return NextResponse.json({ error: "Missing role" }, { status: 400 });
    }

    // Validate action-specific params before entering the lock
    if (action === "hidden-ban") {
      if (!itemId || typeof itemId !== "string") {
        return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
      }
      const team = getTeamFromRole(role);
      if (!team) {
        return NextResponse.json(
          { error: "Invalid role for ban" },
          { status: 400 },
        );
      }
    }

    // Closure variable to capture extra data from the mutation
    let pickedId: string | null = null;

    // Atomic read-modify-write inside the per-seed write lock
    const result = await modifyDraft(
      seed,
      (record: DraftRecord): DraftState => {
        let state = record.state;

        switch (action) {
          case "ready":
            return setPlayerReady(state, role);

          case "init-hidden":
            if (!isHiddenBanStep(state) || state.hiddenBanPhase) {
              return state;
            }
            return getOrInitHiddenPhase(state);

          case "hidden-ban": {
            const team = getTeamFromRole(role) as TeamKey;
            if (!state.hiddenBanPhase && isHiddenBanStep(state)) {
              state = getOrInitHiddenPhase(state);
            }
            if (!state.hiddenBanPhase) return state;
            return applyHiddenBan(state, team, itemId);
          }

          case "auto-resolve": {
            if (!isAutoStep(state)) return state; // not at an auto step — no-op
            const resolved = resolveAutoStep(state);
            pickedId = resolved.pickedId;
            return resolved.state;
          }

          default:
            return state;
        }
      },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Notify SSE clients
    publish(seed, result.version);

    return NextResponse.json({
      ok: true,
      version: result.version,
      ...(pickedId ? { pickedId } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
