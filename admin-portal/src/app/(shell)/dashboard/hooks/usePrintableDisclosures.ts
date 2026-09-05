"use client";

import { useEffect } from "react";

/**
 * Opens collapsed disclosures while the page is being printed.
 *
 * Every chart keeps its exact values in a `<details>`, and so does each
 * group's "all reported values" table. A closed `<details>` prints as its
 * summary line alone, so a PDF exported from a group tab carried charts and
 * no numbers behind them — which is the opposite of what the design system's
 * chart contract asks for, and useless if a chart failed to draw.
 *
 * The overview solved this with a separate always-mounted print block. That
 * does not generalise: it duplicates every table into the DOM twice. Opening
 * the real ones for the duration of the print keeps a single source of truth
 * and covers the browser's own Ctrl+P as well as the export button, because
 * `beforeprint` fires for both.
 */
export function usePrintableDisclosures(
  containerRef: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only disclosures this hook opened are closed again, so one the reader
    // had already expanded stays expanded after printing.
    //
    // The set accumulates rather than being replaced. One print is announced
    // on both channels in a browser that has both, and replacing the record
    // meant the second announcement found everything already open and tracked
    // nothing — so restoring closed nothing and the page stayed expanded after
    // the print or its cancellation. Accumulating is also what covers a
    // disclosure that mounts between the two announcements, which a lazily
    // drawn chart's exact-value table does.
    const opened = new Set<HTMLDetailsElement>();

    const expand = () => {
      const root = containerRef.current;
      if (!root) return;
      for (const details of root.querySelectorAll("details")) {
        if (details.open) continue;
        details.open = true;
        opened.add(details);
      }
    };

    // The print cycle ends here, on whichever channel reports it first, so the
    // record is cleared once and the next cycle starts from nothing.
    const restore = () => {
      for (const details of opened) details.open = false;
      opened.clear();
    };

    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);

    // Safari and older WebKit fire no print events; the media query does.
    const query = window.matchMedia?.("print");
    const onMediaChange = (event: MediaQueryListEvent) =>
      event.matches ? expand() : restore();
    query?.addEventListener?.("change", onMediaChange);

    return () => {
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
      query?.removeEventListener?.("change", onMediaChange);
      restore();
    };
  }, [containerRef]);
}
