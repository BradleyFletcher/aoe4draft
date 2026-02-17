import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data", "drafts");
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB max per draft file
const DRAFT_TTL_DAYS = 7; // auto-delete drafts older than 7 days

// Strict seed format: 12-char alphanumeric uppercase
const SEED_REGEX = /^[A-Z0-9]{8,16}$/;

export function generateSecureSeed(): string {
  // 8 bytes = 16 hex chars, then take first 12 uppercase alphanumeric
  const bytes = crypto.randomBytes(8);
  const hex = bytes.toString("hex").toUpperCase();
  // Map to alphanumeric (avoid ambiguous chars like 0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let seed = "";
  for (let i = 0; i < 12; i++) {
    seed += chars[bytes[i % bytes.length] % chars.length];
  }
  return seed;
}

export function isValidSeed(seed: string): boolean {
  return SEED_REGEX.test(seed);
}

// Shard into subdirectories by first 2 chars: data/drafts/AB/ABCD1234.json
function getShardDir(seed: string): string {
  return path.join(DATA_DIR, seed.substring(0, 2));
}

function getFilePath(seed: string): string {
  return path.join(getShardDir(seed), `${seed}.json`);
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Per-seed write lock to prevent concurrent read-then-write races
const writeLocks = new Map<string, Promise<void>>();

function withWriteLock<T>(seed: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(seed) ?? Promise.resolve();
  const result = prev.then(fn, fn);
  // Store a void version of the chain so the map only holds void promises
  const voidChain = result.then(
    () => {},
    () => {},
  );
  writeLocks.set(seed, voidChain);
  // Clean up when this is still the latest chain (prevents unbounded growth)
  voidChain.then(() => {
    if (writeLocks.get(seed) === voidChain) writeLocks.delete(seed);
  });
  return result;
}

export async function readDraft(seed: string): Promise<{
  state: any;
  history: any[];
  version: number;
  createdAt: number;
  updatedAt: number;
} | null> {
  if (!isValidSeed(seed)) return null;

  const filePath = getFilePath(seed);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeDraft(
  seed: string,
  state: any,
  history: any[],
): Promise<{ ok: boolean; version: number; error?: string }> {
  if (!isValidSeed(seed)) {
    return { ok: false, version: 0, error: "Invalid seed format" };
  }

  // Validate payload size
  const payload = JSON.stringify({ state, history });
  if (Buffer.byteLength(payload, "utf-8") > MAX_PAYLOAD_BYTES) {
    return { ok: false, version: 0, error: "Payload too large" };
  }

  // Basic structure validation
  if (!state || typeof state !== "object" || !state.config) {
    return { ok: false, version: 0, error: "Invalid state structure" };
  }

  if (!Array.isArray(history)) {
    return { ok: false, version: 0, error: "History must be an array" };
  }

  // Serialize writes per seed to prevent version race conditions
  return withWriteLock(seed, async () => {
    const shardDir = getShardDir(seed);
    ensureDir(shardDir);
    const filePath = getFilePath(seed);

    // Read existing version
    let currentVersion = 0;
    let createdAt = Date.now();
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const existing = JSON.parse(raw);
      currentVersion = existing.version ?? 0;
      createdAt = existing.createdAt ?? createdAt;
    } catch {
      /* fresh file */
    }

    const newVersion = currentVersion + 1;
    const data = {
      state,
      history,
      version: newVersion,
      createdAt,
      updatedAt: Date.now(),
    };

    await fs.writeFile(filePath, JSON.stringify(data));
    return { ok: true, version: newVersion };
  });
}

export async function deleteDraft(seed: string): Promise<boolean> {
  if (!isValidSeed(seed)) return false;

  const filePath = getFilePath(seed);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

// Clean up drafts older than DRAFT_TTL_DAYS
export async function cleanupOldDrafts(): Promise<number> {
  if (!existsSync(DATA_DIR)) return 0;

  const cutoff = Date.now() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  try {
    const shards = await fs.readdir(DATA_DIR);
    for (const shard of shards) {
      const shardPath = path.join(DATA_DIR, shard);
      const stat = await fs.stat(shardPath);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(shardPath);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(shardPath, file);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(raw);
          if (data.updatedAt && data.updatedAt < cutoff) {
            await fs.unlink(filePath);
            deleted++;
          }
        } catch {
          // Corrupt file, delete it
          await fs.unlink(filePath).catch(() => {});
          deleted++;
        }
      }

      // Remove empty shard directories
      const remaining = await fs.readdir(shardPath);
      if (remaining.length === 0) {
        await fs.rmdir(shardPath);
      }
    }
  } catch {
    /* ignore cleanup errors */
  }

  return deleted;
}

// List active drafts count (for monitoring)
export async function countActiveDrafts(): Promise<number> {
  if (!existsSync(DATA_DIR)) return 0;

  let count = 0;
  try {
    const shards = await fs.readdir(DATA_DIR);
    for (const shard of shards) {
      const shardPath = path.join(DATA_DIR, shard);
      const stat = await fs.stat(shardPath);
      if (!stat.isDirectory()) continue;
      const files = await fs.readdir(shardPath);
      count += files.filter((f) => f.endsWith(".json")).length;
    }
  } catch {
    /* ignore */
  }

  return count;
}
