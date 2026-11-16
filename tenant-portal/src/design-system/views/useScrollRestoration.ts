"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { safeSessionStorage } from "@/lib/safeStorage";

const STORAGE_KEY = "tenant_scroll";
const MAX_ENTRIES = 50;
const PERSIST_DELAY_MS = 150;

function readOffsets() {
  const offsets = new Map<string, [number, number]>();
  const raw = safeSessionStorage.getItem(STORAGE_KEY);
  if (raw === null) return offsets;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return offsets;
    for (const [key, value] of Object.entries(parsed)) {
      if (
        Array.isArray(value) && value.length === 2 &&
        typeof value[0] === "number" && Number.isFinite(value[0]) &&
        typeof value[1] === "number" && Number.isFinite(value[1])
      ) {
        offsets.set(key, [value[0], value[1]]);
      }
    }
  } catch {
    // Malformed session data must not prevent mounting a scroll container.
  }
  return offsets;
}

function restore(element: HTMLElement, storageKey: string) {
  const offset = readOffsets().get(storageKey);
  if (!offset) return;
  const [x, y] = offset;
  // Stored raw: under RTL scrollLeft is browser-dependent in sign, and a raw
  // value round-trips correctly inside the browser that wrote it.
  element.scrollLeft = x;
  element.scrollTop = y;
}

// Restores the scroll offset of a container the browser cannot restore by
// itself. Next restores the PAGE scroll on a back-navigation, which is what
// the table view rides on — do not intercept it with a manual scrollTo(0).
// What Next does not cover is a board that scrolls sideways inside its own
// row, or a windowed list that scrolls inside a fixed-height box: return to
// one of those from a detail screen and you land at the start every time.
//
// Session-scoped on purpose — an offset is a property of this visit, not a
// durable preference — and keyed by route so two workspaces never restore
// each other's position. Storage goes through safeSessionStorage and survives
// a throwing or absent sessionStorage.
export function useScrollRestoration(viewName: string) {
  const pathname = usePathname();
  const storageKey = `${pathname}:${viewName}`;

  // A callback ref with a React 19 cleanup, not an effect over a ref object:
  // the container is mounted conditionally (loading, error and empty each
  // replace it), so "does the node exist yet" is not answerable from an
  // effect that runs once on mount.
  return useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      restore(element, storageKey);
      let timer: ReturnType<typeof setTimeout> | undefined;

      function persist() {
        if (!element) return;
        // Merge at flush time so other mounted views keep their latest offsets.
        const offsets = readOffsets();
        offsets.delete(storageKey);
        offsets.set(storageKey, [element.scrollLeft, element.scrollTop]);
        const entries = [...offsets].slice(-MAX_ENTRIES);
        safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
      }

      function schedulePersist() {
        if (timer !== undefined) return;
        timer = setTimeout(() => {
          timer = undefined;
          persist();
        }, PERSIST_DELAY_MS);
      }

      element.addEventListener("scroll", schedulePersist, { passive: true });
      return () => {
        element.removeEventListener("scroll", schedulePersist);
        clearTimeout(timer);
        persist();
      };
    },
    [storageKey],
  );
}
