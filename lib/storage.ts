import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import crypto from "crypto";
import { put, del, list, head } from "@vercel/blob";

const DATA_DIR = path.join(process.cwd(), "data", "drafts");
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB max per draft
const DRAFT_TTL_DAYS = 7; // auto-delete drafts older than 7 days
const BLOB_PREFIX = "drafts/";

// Use Blob storage in production (Vercel), filesystem locally
const USE_BLOB = process.env.VERCEL === "1";

// Strict seed format: 8-16 char alphanumeric uppercase
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

function getBlobPath(seed: string): string {
  return `${BLOB_PREFIX}${seed}.json`;
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

  if (USE_BLOB) {
    try {
      const blobInfo = await head(getBlobPath(seed));
      // Try downloadUrl first (has ?download=1 param)
      const res = await fetch(blobInfo.downloadUrl, {
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(
          `[readDraft] Blob fetch failed: ${res.status} ${res.statusText}`,
        );
        return null;
      }
      const text = await res.text();
      return JSON.parse(text);
    } catch (err: any) {
      console.error(`[readDraft] Error:`, err?.message || err);
      return null;
    }
  } else {
    const filePath = getFilePath(seed);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
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
    let currentVersion = 0;
    let createdAt = Date.now();

    if (USE_BLOB) {
      // For Blob, check if it exists without fetching content (avoids 403)
      try {
        const blobInfo = await head(getBlobPath(seed));
        // Blob exists - we can't read the version without fetching (403 issue)
        // So we use allowOverwrite to overwrite and increment version optimistically
        currentVersion = 1; // Assume version 1+ for existing blobs
      } catch {
        // Blob doesn't exist yet, start at version 0
        currentVersion = 0;
      }
    } else {
      // For filesystem, read existing version normally
      const existing = await readDraft(seed);
      if (existing) {
        currentVersion = existing.version ?? 0;
        createdAt = existing.createdAt ?? createdAt;
      }
    }

    const newVersion = currentVersion + 1;
    const data = {
      state,
      history,
      version: newVersion,
      createdAt,
      updatedAt: Date.now(),
    };

    if (USE_BLOB) {
      try {
        await put(getBlobPath(seed), JSON.stringify(data), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
          allowOverwrite: true, // Allow overwriting existing blobs
        });
      } catch (err: any) {
        console.error("[writeDraft] Blob put failed:", err?.message || err);
        return {
          ok: false,
          version: 0,
          error: "Blob storage error: " + (err?.message || "unknown"),
        };
      }
    } else {
      const shardDir = getShardDir(seed);
      ensureDir(shardDir);
      const filePath = getFilePath(seed);
      await fs.writeFile(filePath, JSON.stringify(data));
    }

    return { ok: true, version: newVersion };
  });
}

export async function deleteDraft(seed: string): Promise<boolean> {
  if (!isValidSeed(seed)) return false;

  if (USE_BLOB) {
    try {
      const blobInfo = await head(getBlobPath(seed));
      await del(blobInfo.url);
      return true;
    } catch {
      return true; // Already deleted or doesn't exist
    }
  } else {
    const filePath = getFilePath(seed);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Clean up drafts older than DRAFT_TTL_DAYS
export async function cleanupOldDrafts(): Promise<number> {
  const cutoff = Date.now() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  if (USE_BLOB) {
    try {
      let cursor: string | undefined;
      do {
        const result = await list({ prefix: BLOB_PREFIX, cursor });
        const expiredUrls: string[] = [];
        for (const blob of result.blobs) {
          try {
            const res = await fetch(blob.downloadUrl);
            if (res.ok) {
              const data = await res.json();
              if (data.updatedAt && data.updatedAt < cutoff) {
                expiredUrls.push(blob.url);
              }
            }
          } catch {
            expiredUrls.push(blob.url);
          }
        }
        if (expiredUrls.length > 0) {
          await del(expiredUrls);
          deleted += expiredUrls.length;
        }
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
    } catch {
      /* ignore cleanup errors */
    }
  } else {
    if (!existsSync(DATA_DIR)) return 0;
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
            await fs.unlink(filePath).catch(() => {});
            deleted++;
          }
        }

        const remaining = await fs.readdir(shardPath);
        if (remaining.length === 0) {
          await fs.rmdir(shardPath);
        }
      }
    } catch {
      /* ignore cleanup errors */
    }
  }

  return deleted;
}

// List active drafts count (for monitoring)
export async function countActiveDrafts(): Promise<number> {
  if (USE_BLOB) {
    try {
      let count = 0;
      let cursor: string | undefined;
      do {
        const result = await list({ prefix: BLOB_PREFIX, cursor });
        count += result.blobs.length;
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
      return count;
    } catch {
      return 0;
    }
  } else {
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
}
