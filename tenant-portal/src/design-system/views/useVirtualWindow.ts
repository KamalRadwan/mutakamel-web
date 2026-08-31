"use client";

import { useCallback, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualRange {
  // Item indices, `end` exclusive.
  start: number;
  end: number;
  // Spacer sizes, in CSS pixels, standing in for the rows that are not
  // rendered so the scrollbar keeps the length of the whole list.
  paddingStart: number;
  paddingEnd: number;
}

interface VirtualWindowOptions {
  count: number;
  // Below this many items the list renders whole and nothing is windowed, so
  // a small list behaves exactly as it did before this existed.
  threshold: number;
  // Starting guess at one row's height including its gap, replaced by a real
  // measurement as soon as one row has been laid out.
  estimatedRowSize: number;
  // Items per visual row: 1 for a table, the grid's column count for a card
  // grid.
  itemsPerRow?: number;
  // Rows kept mounted beyond the viewport on each side. Focus and
  // find-in-page both benefit from a margin.
  overscan?: number;
}

// A vertical window over a uniform-pitch list, expressed as a slice plus two
// spacer sizes — the shape a `<tbody>` and a CSS grid can both consume without
// absolute positioning.
//
// `@tanstack/react-virtual` per DECISIONS.md#d9--virtualization--assumed-split-by-surface-on-2026-08-31,
// which covers the two surfaces that carry NO drag interaction: DataTable rows
// and the card grid. Board columns are a different decision (`react-window`)
// and a different task (2.8) — see BoardView.
//
// The un-measured first paint is a safe prefix of `threshold` items rather
// than the whole list: the scroll element is only known after the first
// commit, and rendering 400 cards for one frame is the thing this exists to
// prevent. A container that never lays out — SSR, jsdom — simply stays there.
export function useVirtualWindow({
  count,
  threshold,
  estimatedRowSize,
  itemsPerRow = 1,
  overscan = 4,
}: VirtualWindowOptions) {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [measuredRowSize, setMeasuredRowSize] = useState<number | null>(null);

  const perRow = Math.max(1, itemsPerRow);
  const isWindowed = count > threshold;
  const rowSize = measuredRowSize ?? estimatedRowSize;

  // React Compiler reports "Compilation Skipped: Use of incompatible library"
  // here and declines to memoize this hook: useVirtualizer returns functions
  // whose identity is deliberately unstable. That is the library D9 selected,
  // and the cost is bounded — the hook returns a plain data range, so nothing
  // downstream depends on those identities.
  const virtualizer = useVirtualizer({
    count: isWindowed ? Math.ceil(count / perRow) : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowSize,
    overscan,
  });

  const scrollRef = useCallback((element: HTMLElement | null) => setScrollElement(element), []);

  // One rendered item is enough to replace the estimate: rows are uniform in a
  // table by construction, and a CSS grid stretches every card in a row to a
  // common height.
  const itemRef = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const parent = element.parentElement;
    const gap = parent ? Number.parseFloat(getComputedStyle(parent).rowGap) : Number.NaN;
    const pitch = element.getBoundingClientRect().height + (Number.isFinite(gap) ? gap : 0);
    if (pitch > 0) setMeasuredRowSize((current) => (current === pitch ? current : pitch));
  }, []);

  return { scrollRef, itemRef, range: resolveRange(virtualizer, count, threshold, perRow, isWindowed) };
}

function resolveRange(
  virtualizer: ReturnType<typeof useVirtualizer<HTMLElement, Element>>,
  count: number,
  threshold: number,
  perRow: number,
  isWindowed: boolean,
): VirtualRange | null {
  if (!isWindowed) return null;

  const rows = virtualizer.getVirtualItems();
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return { start: 0, end: threshold, paddingStart: 0, paddingEnd: 0 };

  return {
    start: first.index * perRow,
    end: Math.min(count, (last.index + 1) * perRow),
    paddingStart: first.start,
    paddingEnd: Math.max(0, virtualizer.getTotalSize() - last.end),
  };
}
