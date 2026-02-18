import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DATA_DIR = path.join(process.cwd(), "data", "drafts");
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB max per draft
const DRAFT_TTL_DAYS = 7; // auto-delete drafts older than 7 days
const FIRESTORE_COLLECTION = "drafts";

// Use Firestore in production (when Firebase creds available), filesystem locally
const USE_FIRESTORE = !!process.env.FIREBASE_PROJECT_ID;

// Initialize Firebase Admin SDK
let db: ReturnType<typeof getFirestore> | null = null;
if (USE_FIRESTORE) {
  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    console.error("[Firebase] Init failed:", err);
  }
}

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

// Filesystem helpers
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

  if (USE_FIRESTORE && db) {
    try {
      const docRef = db.collection(FIRESTORE_COLLECTION).doc(seed);
      const doc = await docRef.get();
      if (!doc.exists) return null;
      return doc.data() as any;
    } catch (err: any) {
      console.error(`[readDraft] Firestore error:`, err?.message || err);
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
    let currentVersion = 0;
    let createdAt = Date.now();

    if (USE_FIRESTORE && db) {
      // For Firestore, read existing version
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

      try {
        await db.collection(FIRESTORE_COLLECTION).doc(seed).set(data);
        return { ok: true, version: newVersion };
      } catch (err: any) {
        console.error("[writeDraft] Firestore error:", err?.message || err);
        return {
          ok: false,
          version: 0,
          error: "Firestore error: " + (err?.message || "unknown"),
        };
      }
    } else {
      // For filesystem, read existing version
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

      const shardDir = getShardDir(seed);
      ensureDir(shardDir);
      const filePath = getFilePath(seed);
      await fs.writeFile(filePath, JSON.stringify(data));
      return { ok: true, version: newVersion };
    }
  });
}

export async function deleteDraft(seed: string): Promise<boolean> {
  if (!isValidSeed(seed)) return false;

  if (USE_FIRESTORE && db) {
    try {
      await db.collection(FIRESTORE_COLLECTION).doc(seed).delete();
      return true;
    } catch {
      return false;
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

  if (USE_FIRESTORE && db) {
    try {
      const snapshot = await db
        .collection(FIRESTORE_COLLECTION)
        .where("updatedAt", "<", cutoff)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleted++;
      });

      if (deleted > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.error("[cleanupOldDrafts] Firestore error:", err);
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
  if (USE_FIRESTORE && db) {
    try {
      const snapshot = await db.collection(FIRESTORE_COLLECTION).count().get();
      return snapshot.data().count;
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
