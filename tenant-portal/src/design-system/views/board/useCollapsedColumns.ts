"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { safeStorage } from "@/lib/safeStorage";

// Which columns this browser has collapsed, per route.
//
// `localStorage`, not `sessionStorage`: a collapsed stage is a working
// preference — "I am not looking at Won this week" — and a preference that
// forgets itself on every visit is one nobody sets twice. That is the opposite
// of `useScrollRestoration`, which is session-scoped because a scroll offset
// belongs to one visit.
//
// Keyed by route for the same reason the scroll offset is: five screens render
// a board, and a stage id that happened to repeat across two of them would
// otherwise arrive pre-collapsed on the second.
//
// **Why `useSyncExternalStore` rather than state restored in an effect.** The
// board is server-rendered, and localStorage does not exist there. Reading it
// while rendering makes every board with a collapsed stage a hydration
// mismatch; restoring it in an effect is a setState in an effect, which is the
// cascading-render pattern `react-hooks/set-state-in-effect` rejects. This
// hook is the API for exactly this shape: the server and the hydrating client
// both see nothing collapsed, and React re-renders once with the stored value.
// It also makes a second tab's change arrive here for free.

const KEY_PREFIX = "tenant_board_collapsed_";

// One frozen empty array, because `useSyncExternalStore` compares snapshots by
// identity: a fresh `[]` per call would schedule a render per render.
const NONE: readonly string[] = Object.freeze([]);

// Storage is the store. This only holds the last string read from it beside
// the array parsed out of that string, because `useSyncExternalStore` compares
// snapshots by identity and parsing afresh on every render would hand it a new
// array every time. Storage is still read on every snapshot, so site data
// cleared underneath us is picked up on the next one.
const cache = new Map<string, { raw: string | null; value: readonly string[] }>();
const listeners = new Set<() => void>();

function parse(raw: string | null): readonly string[] {
  if (!raw) return NONE;
  try {
    const value: unknown = JSON.parse(raw);
    // A hand-edited or half-written value is data, not a crash: anything that
    // is not an array of strings reads as "nothing collapsed".
    if (!Array.isArray(value)) return NONE;
    const ids = value.filter((id): id is string => typeof id === "string");
    return ids.length > 0 ? Object.freeze(ids) : NONE;
  } catch {
    return NONE;
  }
}

function snapshot(storageKey: string): readonly string[] {
  const raw = safeStorage.getItem(storageKey);
  const cached = cache.get(storageKey);
  if (cached && cached.raw === raw) return cached.value;
  const value = parse(raw);
  cache.set(storageKey, { raw, value });
  return value;
}

function notify() {
  for (const listener of listeners) listener();
}

// Another TAB writing the same key. The tab that wrote gets no event of its
// own — `toggle` notifies directly — and `event.key` is null when that tab
// cleared storage wholesale.
function onStorage(event: StorageEvent) {
  if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return;
  cache.clear();
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface CollapsedColumns {
  isCollapsed: (columnId: string) => boolean;
  toggle: (columnId: string) => void;
}

export function useCollapsedColumns(): CollapsedColumns {
  const pathname = usePathname();
  const storageKey = `${KEY_PREFIX}${pathname}`;

  const collapsed = useSyncExternalStore(
    subscribe,
    () => snapshot(storageKey),
    // The server has no storage, and neither does the first client render if
    // this is to hydrate cleanly.
    () => NONE,
  );

  const toggle = useCallback(
    (columnId: string) => {
      const current = snapshot(storageKey);
      const next = current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId];
      const serialized = JSON.stringify(next);
      safeStorage.setItem(storageKey, serialized);
      // Seeded with what storage now actually holds, not with what was asked
      // of it: where the write was refused that is `null`, and the cache then
      // carries the column collapsed for this session while still matching the
      // next read. A browser that blocks site data collapses a column, it just
      // forgets between visits.
      cache.set(storageKey, { raw: safeStorage.getItem(storageKey), value: Object.freeze(next) });
      notify();
    },
    [storageKey],
  );

  const isCollapsed = useCallback((columnId: string) => collapsed.includes(columnId), [collapsed]);

  return { isCollapsed, toggle };
}
