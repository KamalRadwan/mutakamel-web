"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Reports readiness only after every chart card has a non-zero layout box and
 * that layout has remained available across two animation frames. This gives
 * ResponsiveContainer a measurement frame and Recharts a render frame without
 * relying on an arbitrary timeout.
 */
export function useDashboardChartGroupReady(
  groupRef: RefObject<HTMLElement | null>,
  onReady?: () => void,
): void {
  useLayoutEffect(() => {
    if (!onReady) return;

    let disposed = false;
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const cancelFrames = () => {
      if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      firstFrame = null;
      secondFrame = null;
    };

    const hasMeasuredChartLayout = () => {
      const group = groupRef.current;
      if (!group || !hasArea(group)) return false;
      const cards = Array.from(
        group.querySelectorAll<HTMLElement>("[data-dashboard-chart-card]"),
      );
      return cards.length > 0 && cards.every(hasArea);
    };

    const scheduleReadinessCheck = () => {
      if (disposed || firstFrame !== null || secondFrame !== null) return;
      firstFrame = window.requestAnimationFrame(() => {
        firstFrame = null;
        secondFrame = window.requestAnimationFrame(() => {
          secondFrame = null;
          if (!disposed && hasMeasuredChartLayout()) onReady();
        });
      });
    };

    const group = groupRef.current;
    if (group && typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(scheduleReadinessCheck);
      resizeObserver.observe(group);
      group
        .querySelectorAll<HTMLElement>("[data-dashboard-chart-card]")
        .forEach((card) => resizeObserver?.observe(card));
    }
    window.addEventListener("resize", scheduleReadinessCheck);
    scheduleReadinessCheck();

    return () => {
      disposed = true;
      cancelFrames();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleReadinessCheck);
    };
  }, [groupRef, onReady]);
}

function hasArea(element: Element): boolean {
  const bounds = element.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0;
}
