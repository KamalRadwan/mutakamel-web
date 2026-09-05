// @vitest-environment jsdom

import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePrintableDisclosures } from "./usePrintableDisclosures";

let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];

/**
 * jsdom implements no `matchMedia`, and the hook's second notification channel
 * is exactly that — the one Safari and older WebKit answer on, because they
 * fire no print events at all.
 */
function stubPrintMediaQuery(): void {
  mediaListeners = [];
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      mediaListeners.push(listener);
    },
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      mediaListeners = mediaListeners.filter((entry) => entry !== listener);
    },
  }));
}

function printMedia(matches: boolean): void {
  act(() => {
    for (const listener of [...mediaListeners]) {
      listener({ matches } as MediaQueryListEvent);
    }
  });
}

function windowPrintEvent(type: "beforeprint" | "afterprint"): void {
  act(() => {
    window.dispatchEvent(new Event(type));
  });
}

describe("usePrintableDisclosures", () => {
  beforeEach(() => stubPrintMediaQuery());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * A browser that fires `beforeprint` *and* changes the print media — one
   * print, announced twice — is the supported case, not an exotic one. The
   * second announcement must not lose the record of what the first opened.
   */
  it("closes what it opened when one print is announced on both channels", () => {
    render(<PrintableGroup />);
    const chartValues = disclosure("chart-values");
    const readerOpened = disclosure("reader-opened");

    windowPrintEvent("beforeprint");
    expect(chartValues.open).toBe(true);

    printMedia(true);
    expect(chartValues.open).toBe(true);

    windowPrintEvent("afterprint");

    // The disclosure the reader had already expanded is still theirs.
    expect(chartValues.open).toBe(false);
    expect(readerOpened.open).toBe(true);
  });

  /**
   * The lazily rendered charts mount their exact-value tables while the print
   * is being prepared, so a disclosure can appear between the two
   * announcements. It has to be restored too.
   */
  it("also closes a disclosure that appeared between the two announcements", () => {
    render(<PrintableGroup />);
    const chartValues = disclosure("chart-values");

    windowPrintEvent("beforeprint");

    const late = document.createElement("details");
    late.append(document.createElement("summary"));
    screen.getByTestId("printable-root").append(late);

    printMedia(true);
    expect(late.open).toBe(true);

    windowPrintEvent("afterprint");
    expect(chartValues.open).toBe(false);
    expect(late.open).toBe(false);
  });

  /** Safari fires no print events, so the media query is the only channel. */
  it("restores on the media channel alone", () => {
    render(<PrintableGroup />);
    const chartValues = disclosure("chart-values");

    printMedia(true);
    expect(chartValues.open).toBe(true);

    printMedia(false);
    expect(chartValues.open).toBe(false);
  });

  it("restores when the printable region unmounts mid-print", () => {
    const view = render(<PrintableGroup />);
    const chartValues = disclosure("chart-values");

    windowPrintEvent("beforeprint");
    expect(chartValues.open).toBe(true);

    view.unmount();
    expect(chartValues.open).toBe(false);
  });
});

function disclosure(testId: string): HTMLDetailsElement {
  return screen.getByTestId(testId) as HTMLDetailsElement;
}

function PrintableGroup() {
  const containerRef = useRef<HTMLDivElement>(null);
  usePrintableDisclosures(containerRef);
  return (
    <div ref={containerRef} data-testid="printable-root">
      <details data-testid="chart-values">
        <summary>Exact values</summary>
        <p>1,204 tenants</p>
      </details>
      <details data-testid="reader-opened" open>
        <summary>All reported values</summary>
        <p>18 servers</p>
      </details>
    </div>
  );
}
