// @vitest-environment jsdom

import { createRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardChartGroupReady } from "./useDashboardChartGroupReady";

function ReadinessHarness({ onReady }: { onReady: () => void }) {
  const groupRef = createRef<HTMLDivElement>();
  useDashboardChartGroupReady(groupRef, onReady);
  return (
    <div ref={groupRef}>
      <div data-dashboard-chart-card />
      <div data-dashboard-chart-card />
      <div data-dashboard-chart-card />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDashboardChartGroupReady", () => {
  it("does not report mount as ready and waits for nonzero layout across two frames", () => {
    let hasLayout = false;
    const frameQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameQueue.push(callback);
      return frameQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          width: hasLayout ? 640 : 0,
          height: hasLayout ? 320 : 0,
          top: 0,
          right: hasLayout ? 640 : 0,
          bottom: hasLayout ? 320 : 0,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    const onReady = vi.fn();

    render(<ReadinessHarness onReady={onReady} />);
    runNextFrame(frameQueue);
    runNextFrame(frameQueue);
    expect(onReady).not.toHaveBeenCalled();

    hasLayout = true;
    act(() => window.dispatchEvent(new Event("resize")));
    runNextFrame(frameQueue);
    runNextFrame(frameQueue);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

function runNextFrame(queue: FrameRequestCallback[]): void {
  const callback = queue.shift();
  expect(callback).toBeDefined();
  act(() => callback?.(performance.now()));
}
