import { describe, expect, it } from "vitest";
import type { DashboardGroup } from "@/types/dashboard";
import { inferGroupVisuals, unitOf } from "./infer-visuals";

const COPY = { snapshotLabel: "Current snapshot", periodLabel: "Selected period" };

function group(partial: Partial<DashboardGroup> & { key: string }): DashboardGroup {
  return {
    permission: "admin.reports.storage",
    available: true,
    asOf: "2026-06-30T09:00:00.000Z",
    snapshot: {},
    period: {},
    breakdowns: {},
    alerts: [],
    cards: [],
    ...partial,
  } as DashboardGroup;
}

describe("unitOf", () => {
  it("reads Core's field-suffix convention", () => {
    expect(unitOf("settlementTotalUsd")).toBe("usd");
    expect(unitOf("oldestCapacityMutationSeconds")).toBe("seconds");
    expect(unitOf("maximumBytes")).toBe("bytes");
    expect(unitOf("collectionRatio")).toBe("ratio");
    expect(unitOf("successRate")).toBe("ratio");
    expect(unitOf("boundedUtilization")).toBe("ratio");
    expect(unitOf("totalServers")).toBe("count");
  });
});

describe("inferGroupVisuals", () => {
  it("draws nothing for an unavailable projection", () => {
    const usage = {
      key: "usage",
      permission: "admin.reports.usage",
      available: false,
      asOf: "2026-06-30T09:00:00.000Z",
      reasonCode: "SOURCE_NOT_CONFIGURED",
      message: "No producer configured.",
      alerts: [],
      cards: [],
    } as unknown as DashboardGroup;

    expect(inferGroupVisuals(usage, COPY)).toEqual([]);
  });

  it("turns a small status breakdown into a donut and a large one into a ranked bar", () => {
    const [donut] = inferGroupVisuals(
      group({
        key: "tenants",
        breakdowns: { byStatus: { ACTIVE: 3, SUSPENDED: 1, DELETED: 7 } },
      }),
      COPY,
    );
    expect(donut).toMatchObject({ kind: "donut", unit: "count" });

    const wide = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [`CODE_${index}`, index + 1]),
    );
    const [bar] = inferGroupVisuals(
      group({ key: "payments", breakdowns: { failureReasons: wide } }),
      COPY,
    );
    expect(bar).toMatchObject({ kind: "bar" });
  });

  it("reads a map of objects as two series, splitting axes when the units differ", () => {
    const [wallets] = inferGroupVisuals(
      group({
        key: "wallets",
        breakdowns: {
          ledgerByDirection: {
            CREDIT: { count: 12, amountUsd: "480.0000" },
            DEBIT: { count: 5, amountUsd: "125.5000" },
          },
        },
      }),
      COPY,
    );

    expect(wallets).toMatchObject({
      kind: "dual-axis",
      unit: "count",
      secondaryUnit: "usd",
    });
    expect(wallets.data).toMatchObject({
      pairs: [
        { key: "CREDIT", primary: 12, secondary: 480 },
        { key: "DEBIT", primary: 5, secondary: 125.5 },
      ],
    });
  });

  it("compares a field reported in both the snapshot and the period", () => {
    const visuals = inferGroupVisuals(
      group({
        key: "billing",
        snapshot: { invoices: 40, collectedUsd: "900.0000" },
        period: { invoices: 6, collectedUsd: "120.0000" },
      }),
      COPY,
    );

    // Mixed units cannot share one axis, so no comparison is emitted.
    expect(visuals.find((visual) => visual.kind === "comparison")).toBeUndefined();

    const [comparison] = inferGroupVisuals(
      group({
        key: "billing",
        snapshot: { invoices: 40, overdueCount: 3 },
        period: { invoices: 6, overdueCount: 1 },
      }),
      COPY,
    );
    expect(comparison).toMatchObject({ kind: "comparison", unit: "count" });
    expect(comparison.data).toMatchObject({
      primaryLabel: "Current snapshot",
      secondaryLabel: "Selected period",
    });
  });

  it("gauges a ratio against its implicit ceiling of one", () => {
    const [gauge] = inferGroupVisuals(
      group({ key: "payments", snapshot: { successRatio: 0.92 } }),
      COPY,
    );
    expect(gauge).toMatchObject({
      kind: "gauge",
      unit: "ratio",
      data: { value: 0.92, maximum: 1 },
    });
  });

  it("gauges a nested sub-bag against its own declared maximum", () => {
    const visuals = inferGroupVisuals(
      group({
        key: "storage",
        snapshot: {
          byteUsage: {
            available: true,
            maximumBytes: "1000",
            utilizedBytes: "640",
            reservedBytes: "120",
            boundedUtilization: 0.64,
          },
        },
      }),
      COPY,
    );

    const byteGauge = visuals.find(
      (visual) => visual.kind === "gauge" && visual.unit === "bytes",
    );
    expect(byteGauge?.data).toEqual({ value: 640, maximum: 1000 });

    // Never a donut here: nothing guarantees these leaves sum to a whole.
    expect(visuals.some((visual) => visual.kind === "donut")).toBe(false);
  });

  it("ignores a non-numeric leaf instead of dropping the whole sub-bag", () => {
    const visuals = inferGroupVisuals(
      group({
        key: "storage",
        snapshot: { operations: { staleStagedRotations: 2, overdueActivatedRotations: 4 } },
      }),
      COPY,
    );
    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({ kind: "bar", unit: "count" });
  });

  it("caps gauges and total visuals so a tab cannot become a wall of dials", () => {
    const ratios = Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => [`metric${index}Ratio`, 0.5]),
    );
    const visuals = inferGroupVisuals(group({ key: "audit", snapshot: ratios }), COPY);

    expect(visuals.filter((visual) => visual.kind === "gauge")).toHaveLength(3);
    expect(visuals.length).toBeLessThanOrEqual(9);
  });

  it("reads an array of region rows as a ranked bar", () => {
    const [regions] = inferGroupVisuals(
      group({
        key: "tenants",
        breakdowns: {
          byCountry: [
            { key: "eg", countryName: "Egypt", count: 6, ratio: 0.6 },
            { key: "sa", countryName: "Saudi Arabia", count: 3, ratio: 0.3 },
            { key: "ae", countryName: "UAE", count: 1, ratio: 0.1 },
          ],
        },
      }),
      COPY,
    );

    expect(regions).toMatchObject({ kind: "donut" });
    expect(regions.data).toMatchObject({
      categories: [
        { key: "eg", label: "Egypt", value: 6 },
        { key: "sa", label: "Saudi Arabia", value: 3 },
        { key: "ae", label: "UAE", value: 1 },
      ],
    });
  });
});
