"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { safeSessionStorage } from "@/lib/safeStorage";

function restore(element: HTMLElement, storageKey: string) {
  const raw = safeSessionStorage.getItem(storageKey);
  if (raw === null) return;
  const [x, y] = raw.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
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
  const storageKey = `tenant_scroll_${pathname}:${viewName}`;

  // A callback ref with a React 19 cleanup, not an effect over a ref object:
  // the container is mounted conditionally (loading, error and empty each
  // replace it), so "does the node exist yet" is not answerable from an
  // effect that runs once on mount.
  return useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      restore(element, storageKey);

      function persist() {
        if (!element) return;
        safeSessionStorage.setItem(storageKey, `${element.scrollLeft},${element.scrollTop}`);
      }

      element.addEventListener("scroll", persist, { passive: true });
      return () => {
        persist();
        element.removeEventListener("scroll", persist);
      };
    },
    [storageKey],
  );
}
