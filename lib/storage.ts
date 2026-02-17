import { put, del, list } from "@vercel/blob";
import crypto from "crypto";

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB max per draft
const DRAFT_TTL_DAYS = 7; // auto-delete drafts older than 7 days
const BLOB_PREFIX = "drafts/";

// Strict seed format: 8-16 char alphanumeric uppercase
const SEED_REGEX = /^[A-Z0-9]{8,16}$/;

export function generateSecureSeed(): string {
  const bytes = crypto.randomBytes(8);
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

function getBlobPath(seed: string): string {
  return `${BLOB_PREFIX}${seed}.json`;
}

// Per-seed write lock to prevent concurrent read-then-write races
const writeLocks = new Map<string, Promise<void>>();

function withWriteLock<T>(seed: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(seed) ?? Promise.resolve();
  const result = prev.then(fn, fn);
  const voidChain = result.then(
    () => {},
    () => {},
  );
  writeLocks.set(seed, voidChain);
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

  try {
    // List blobs matching this seed's path to get the URL
    const { blobs } = await list({ prefix: getBlobPath(seed) });
    if (blobs.length === 0) return null;

    // Fetch the blob content by its URL
    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
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

  const payload = JSON.stringify({ state, history });
  if (Buffer.byteLength(payload, "utf-8") > MAX_PAYLOAD_BYTES) {
    return { ok: false, version: 0, error: "Payload too large" };
  }

  if (!state || typeof state !== "object" || !state.config) {
    return { ok: false, version: 0, error: "Invalid state structure" };
  }

  if (!Array.isArray(history)) {
    return { ok: false, version: 0, error: "History must be an array" };
  }

  return withWriteLock(seed, async () => {
    // Read existing version
    let currentVersion = 0;
    let createdAt = Date.now();
    const existing = await readDraft(seed);
    if (existing) {
      currentVersion = existing.version ?? 0;
      createdAt = existing.createdAt ?? createdAt;
    }

    const newVersion = currentVersion + 1;
    const data = {
      state,
      history,
      version: newVersion,
      createdAt,
      updatedAt: Date.now(),
    };

    await put(getBlobPath(seed), JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    return { ok: true, version: newVersion };
  });
}

export async function deleteDraft(seed: string): Promise<boolean> {
  if (!isValidSeed(seed)) return false;

  try {
    const { blobs } = await list({ prefix: getBlobPath(seed) });
    if (blobs.length > 0) {
      await del(blobs.map((b) => b.url));
    }
    return true;
  } catch {
    return false;
  }
}

// Clean up drafts older than DRAFT_TTL_DAYS
export async function cleanupOldDrafts(): Promise<number> {
  const cutoff = Date.now() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  try {
    let cursor: string | undefined;
    do {
      const result = await list({
        prefix: BLOB_PREFIX,
        cursor,
      });

      const expiredUrls: string[] = [];
      for (const blob of result.blobs) {
        // Fetch each blob to check updatedAt
        try {
          const res = await fetch(blob.url);
          if (res.ok) {
            const data = await res.json();
            if (data.updatedAt && data.updatedAt < cutoff) {
              expiredUrls.push(blob.url);
            }
          }
        } catch {
          // Corrupt blob, mark for deletion
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

  return deleted;
}

// List active drafts count (for monitoring)
export async function countActiveDrafts(): Promise<number> {
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
}
