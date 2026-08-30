"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type DashboardPrintChartGroup = "operations" | "billing";
export type DashboardPrintFallbackReason =
  | "charts-unavailable"
  | "readiness-timeout";

export const DASHBOARD_PRINT_READINESS_TIMEOUT_MS = 5_000;

interface UseDashboardPrintOptions {
  hasLazyCharts: boolean;
  preloadLazyCharts?: () => Promise<unknown>;
  readinessTimeoutMs?: number;
}

interface DashboardPrintCoordinator {
  forceRenderCharts: boolean;
  isPreparingPrint: boolean;
  chartsReady: boolean;
  printFallbackReason: DashboardPrintFallbackReason | null;
  readinessCycle: number;
  markChartGroupReady: (group: DashboardPrintChartGroup) => void;
  requestPrint: () => void;
}

const INITIAL_READINESS: Record<DashboardPrintChartGroup, boolean> = {
  operations: false,
  billing: false,
};

/**
 * Coordinates the dashboard's explicit print action with its lazy chart
 * chunks. Printing starts only after both below-fold groups have committed.
 */
export function useDashboardPrint({
  hasLazyCharts,
  preloadLazyCharts,
  readinessTimeoutMs = DASHBOARD_PRINT_READINESS_TIMEOUT_MS,
}: UseDashboardPrintOptions): DashboardPrintCoordinator {
  const [forceRenderCharts, setForceRenderCharts] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [readiness, setReadiness] = useState(INITIAL_READINESS);
  const [readinessCycle, setReadinessCycle] = useState(0);
  const [printFallbackReason, setPrintFallbackReason] =
    useState<DashboardPrintFallbackReason | null>(null);
  const printStartedRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const readinessWatchdogRef = useRef<number | null>(null);

  const clearReadinessWatchdog = useCallback(() => {
    if (readinessWatchdogRef.current === null) return;
    window.clearTimeout(readinessWatchdogRef.current);
    readinessWatchdogRef.current = null;
  }, []);

  const printExactValueFallback = useCallback(
    (
      requestGeneration: number,
      reason: DashboardPrintFallbackReason,
    ) => {
      if (
        requestGeneration !== requestGenerationRef.current ||
        printStartedRef.current
      ) {
        return;
      }

      clearReadinessWatchdog();
      printStartedRef.current = true;
      flushSync(() => {
        setReadiness({ ...INITIAL_READINESS });
        setForceRenderCharts(false);
        setIsPreparingPrint(false);
        setPrintFallbackReason(reason);
      });
      window.print();
    },
    [clearReadinessWatchdog],
  );

  const markChartGroupReady = useCallback(
    (group: DashboardPrintChartGroup) => {
      setReadiness((current) =>
        current[group] ? current : { ...current, [group]: true },
      );
    },
    [],
  );

  const requestPrint = useCallback(() => {
    const requestGeneration = ++requestGenerationRef.current;
    clearReadinessWatchdog();
    setPrintFallbackReason(null);

    if (!hasLazyCharts) {
      printStartedRef.current = true;
      window.print();
      return;
    }

    setReadiness({ ...INITIAL_READINESS });
    setReadinessCycle((cycle) => cycle + 1);
    setForceRenderCharts(false);
    printStartedRef.current = false;
    setIsPreparingPrint(true);
    readinessWatchdogRef.current = window.setTimeout(
      () =>
        printExactValueFallback(requestGeneration, "readiness-timeout"),
      readinessTimeoutMs,
    );

    if (!preloadLazyCharts) {
      setForceRenderCharts(true);
      return;
    }

    void Promise.resolve()
      .then(preloadLazyCharts)
      .then(() => {
        if (
          requestGeneration === requestGenerationRef.current &&
          !printStartedRef.current
        ) {
          setForceRenderCharts(true);
        }
      })
      .catch(() =>
        printExactValueFallback(requestGeneration, "charts-unavailable"),
      );
  }, [
    clearReadinessWatchdog,
    hasLazyCharts,
    preloadLazyCharts,
    printExactValueFallback,
    readinessTimeoutMs,
  ]);

  useEffect(() => {
    if (
      !isPreparingPrint ||
      printStartedRef.current ||
      !readiness.operations ||
      !readiness.billing
    ) {
      return;
    }

    clearReadinessWatchdog();
    printStartedRef.current = true;
    setIsPreparingPrint(false);
    window.print();
  }, [
    clearReadinessWatchdog,
    isPreparingPrint,
    readiness.billing,
    readiness.operations,
  ]);

  useEffect(() => {
    const handleBeforePrint = () => {
      if (printStartedRef.current) return;

      requestGenerationRef.current += 1;
      clearReadinessWatchdog();
      printStartedRef.current = true;

      // Native Ctrl+P/browser-menu printing cannot be delayed while dynamic
      // chunks and Recharts measure. Commit the print mode synchronously: the
      // always-mounted exact-data fallback becomes printable immediately and
      // lazy placeholders are hidden. Native printing never depends on chart
      // chunks or their layout-readiness callbacks.
      flushSync(() => {
        setReadiness({ ...INITIAL_READINESS });
        setReadinessCycle((cycle) => cycle + 1);
        setForceRenderCharts(false);
        setIsPreparingPrint(false);
        setPrintFallbackReason(null);
      });
    };
    const handleAfterPrint = () => {
      requestGenerationRef.current += 1;
      clearReadinessWatchdog();
      printStartedRef.current = false;
      setIsPreparingPrint(false);
      setForceRenderCharts(false);
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      requestGenerationRef.current += 1;
      clearReadinessWatchdog();
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [clearReadinessWatchdog]);

  return {
    forceRenderCharts,
    isPreparingPrint,
    chartsReady: readiness.operations && readiness.billing,
    printFallbackReason,
    readinessCycle,
    markChartGroupReady,
    requestPrint,
  };
}
