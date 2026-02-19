// Simple in-memory pub/sub for draft update notifications.
// When a draft is saved, we notify all connected SSE clients for that seed.
//
// Uses globalThis to ensure the listeners Map is shared across all module
// instances — critical in Next.js dev mode where hot reloading can create
// separate module scopes for different API routes.

type Listener = (version: number) => void;
type ListenerMap = Map<string, Set<Listener>>;

const GLOBAL_KEY = "__draft_event_listeners__" as const;

function getListeners(): ListenerMap {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, Set<Listener>>();
  }
  return g[GLOBAL_KEY] as ListenerMap;
}

export function subscribe(seed: string, listener: Listener): () => void {
  const listeners = getListeners();
  if (!listeners.has(seed)) {
    listeners.set(seed, new Set());
  }
  listeners.get(seed)!.add(listener);

  return () => {
    const set = listeners.get(seed);
    if (set) {
      set.delete(listener);
      if (set.size === 0) listeners.delete(seed);
    }
  };
}

export function publish(seed: string, version: number): void {
  const set = getListeners().get(seed);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(version);
    } catch {
      // ignore errors in listeners
    }
  }
}
