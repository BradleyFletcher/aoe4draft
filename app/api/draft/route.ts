import { NextRequest, NextResponse } from "next/server";
import {
  readDraft,
  writeDraft,
  deleteDraft,
  isValidSeed,
  cleanupOldDrafts,
} from "@/lib/storage";
import { validateDraftConfig, redactHiddenBans } from "@/lib/draft";
import { publish } from "@/lib/draft-events";

// Simple in-memory rate limiter: max 600 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 600;
const RATE_WINDOW_MS = 60 * 1000;
let lastRateLimitPrune = 0;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Prune stale entries every 5 minutes to prevent unbounded growth
  if (now - lastRateLimitPrune > 5 * 60 * 1000) {
    lastRateLimitPrune = now;
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Periodic cleanup (runs at most once per hour, fire-and-forget)
let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup > 60 * 60 * 1000) {
    lastCleanup = now;
    cleanupOldDrafts().catch(() => {});
  }
}

// GET /api/draft?seed=XYZ
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const seed = req.nextUrl.searchParams.get("seed");
  if (!seed || !isValidSeed(seed)) {
    return NextResponse.json({ error: "Invalid seed" }, { status: 400 });
  }

  maybeCleanup();

  const data = await readDraft(seed);
  if (!data) {
    return NextResponse.json({ exists: false });
  }

  // Redact hidden bans based on the viewer's role
  const role = req.nextUrl.searchParams.get("role") ?? "spectator";
  if (data.state?.hiddenBanPhase) {
    data.state = redactHiddenBans(data.state, role);
  }

  return NextResponse.json({ exists: true, ...data });
}

// POST /api/draft
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Check content length before parsing
  const contentLength = parseInt(req.headers.get("content-length") ?? "0");
  if (contentLength > 512 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const body = await req.json();
    const { seed, state, history } = body;

    if (!seed || !isValidSeed(seed)) {
      return NextResponse.json({ error: "Invalid seed" }, { status: 400 });
    }

    if (!state || typeof state !== "object" || !state.config) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    // Validate the embedded config to prevent injection of arbitrary data
    if (!validateDraftConfig(state.config)) {
      return NextResponse.json(
        { error: "Invalid draft config" },
        { status: 400 },
      );
    }

    const result = await writeDraft(seed, state, history ?? []);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Notify all SSE clients watching this draft
    publish(seed, result.version);

    return NextResponse.json({ ok: true, version: result.version });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

// DELETE /api/draft?seed=XYZ
export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const seed = req.nextUrl.searchParams.get("seed");
  if (!seed || !isValidSeed(seed)) {
    return NextResponse.json({ error: "Invalid seed" }, { status: 400 });
  }

  await deleteDraft(seed);
  return NextResponse.json({ ok: true });
}
