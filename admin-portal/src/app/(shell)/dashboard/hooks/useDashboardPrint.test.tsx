// @vitest-environment jsdom

import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_PRINT_READINESS_TIMEOUT_MS,
  useDashboardPrint,
} from "./useDashboardPrint";

function NativePrintHarness() {
  const coordinator = useDashboardPrint({ hasLazyCharts: true });
  return (
    <>
      <div data-testid="chart-area" className={coordinator.chartsReady ? "" : "print:hidden"}>
        {coordinator.forceRenderCharts ? "chart render requested" : "lazy placeholder"}
      </div>
      <div
        data-testid="print-fallback"
        className={coordinator.chartsReady ? "hidden" : "hidden print:block"}
      >
        Exact dashboard values
      </div>
    </>
  );
}

describe("useDashboardPrint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for both lazy chart groups before opening print", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useDashboardPrint({ hasLazyCharts: true }),
    );

    act(() => result.current.requestPrint());

    expect(result.current.forceRenderCharts).toBe(true);
    expect(result.current.isPreparingPrint).toBe(true);
    expect(print).not.toHaveBeenCalled();

    act(() => result.current.markChartGroupReady("operations"));
    expect(print).not.toHaveBeenCalled();

    act(() => result.current.markChartGroupReady("billing"));

    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.isPreparingPrint).toBe(false);

    act(() => {
      vi.advanceTimersByTime(DASHBOARD_PRINT_READINESS_TIMEOUT_MS);
    });
    expect(print).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(result.current.isPreparingPrint).toBe(false);
  });

  it("prints immediately when the current dashboard view has no lazy groups", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useDashboardPrint({ hasLazyCharts: false }),
    );

    act(() => result.current.requestPrint());

    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.isPreparingPrint).toBe(false);
  });

  it("synchronously exposes exact print DOM and hides lazy placeholders for native printing", () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<NativePrintHarness />);

    window.dispatchEvent(new Event("beforeprint"));

    expect(screen.getByTestId("chart-area")).toHaveTextContent(
      "lazy placeholder",
    );
    expect(screen.getByTestId("chart-area")).toHaveClass("print:hidden");
    expect(screen.getByTestId("print-fallback")).toHaveClass("print:block");
    expect(screen.getByTestId("print-fallback")).toHaveTextContent(
      "Exact dashboard values",
    );
  });

  it("falls back to exact values when chart preloading rejects", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const preloadLazyCharts = vi
      .fn()
      .mockRejectedValue(new Error("chart chunk unavailable"));
    const { result } = renderHook(() =>
      useDashboardPrint({ hasLazyCharts: true, preloadLazyCharts }),
    );

    act(() => result.current.requestPrint());
    expect(result.current.isPreparingPrint).toBe(true);

    await flushMicrotasks();

    expect(preloadLazyCharts).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.isPreparingPrint).toBe(false);
    expect(result.current.forceRenderCharts).toBe(false);
    expect(result.current.chartsReady).toBe(false);
    expect(result.current.printFallbackReason).toBe("charts-unavailable");
  });

  it("uses a bounded exact-value fallback when chart readiness never arrives", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const preloadLazyCharts = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDashboardPrint({ hasLazyCharts: true, preloadLazyCharts }),
    );

    act(() => result.current.requestPrint());
    await flushMicrotasks();
    expect(result.current.forceRenderCharts).toBe(true);
    expect(result.current.isPreparingPrint).toBe(true);

    act(() => {
      vi.advanceTimersByTime(DASHBOARD_PRINT_READINESS_TIMEOUT_MS - 1);
    });
    expect(print).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(print).toHaveBeenCalledTimes(1);
    expect(result.current.isPreparingPrint).toBe(false);
    expect(result.current.forceRenderCharts).toBe(false);
    expect(result.current.chartsReady).toBe(false);
    expect(result.current.printFallbackReason).toBe("readiness-timeout");
  });
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
