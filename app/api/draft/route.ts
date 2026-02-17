import { NextRequest, NextResponse } from "next/server";
import {
  readDraft,
  writeDraft,
  deleteDraft,
  isValidSeed,
  cleanupOldDrafts,
} from "@/lib/storage";

// Simple in-memory rate limiter: max 60 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
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

// Periodic cleanup (runs at most once per hour)
let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup > 60 * 60 * 1000) {
    lastCleanup = now;
    try {
      cleanupOldDrafts();
    } catch {
      /* ignore */
    }
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

  const data = readDraft(seed);
  if (!data) {
    return NextResponse.json({ exists: false });
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

    if (!state) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    const result = writeDraft(seed, state, history ?? []);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

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

  deleteDraft(seed);
  return NextResponse.json({ ok: true });
}
