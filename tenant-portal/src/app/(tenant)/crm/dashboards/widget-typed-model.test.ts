import { describe, expect, it } from "vitest";
import { distributionBins, hierarchyNodes, hierarchyTree, rankedRows, scorecardRows, waterfallSteps } from "./widget-typed-model";
import { parseWidgetResult } from "./dashboard-run-contract";
import { widgetTableModel } from "./widget-view";
describe("current typed geometry boundaries", () => {
  it("uses leaves once and rejects cycles, dangling parents, and incomplete parent totals", () => {
    const nodes = [{ id: "p", label: "Pipeline", depth: 0, value: 100 }, { id: "a", parentId: "p", label: "A", depth: 1, value: 40 }, { id: "b", parentId: "p", label: "B", depth: 1, value: 60 }];
    expect(hierarchyTree(nodes)?.[0].children?.map((node) => node.value)).toEqual([40, 60]);
    expect(hierarchyTree([{ ...nodes[0], value: 110 }, ...nodes.slice(1)])).toBeNull();
    expect(hierarchyTree([{ ...nodes[0], parentId: "b" }, ...nodes.slice(1)])).toBeNull();
    expect(hierarchyTree([{ ...nodes[1], parentId: "missing" }])).toBeNull();
    expect(hierarchyNodes({ nodes: [{ ...nodes[0], value: "100" }] })).toBeNull();
  });
  it("keeps server cumulative waterfall values and ordering without recomputing financial totals", () => {
    const steps = waterfallSteps({ steps: [{ key: "d", label: "Decrease", order: 2, kind: "DELTA", value: -40, cumulativeValue: 60 }, { key: "s", label: "Opening", order: 1, kind: "START", value: 100, cumulativeValue: 100 }] });
    expect(steps?.map((row) => row.cumulativeValue)).toEqual([100, 60]);
    expect(waterfallSteps({ steps: [{ key: "x", label: "Invalid", order: 0, kind: "DELTA", value: NaN, cumulativeValue: 2 }] })).toBeNull();
  });
  it("accepts zero bin counts and current lower/upper bounds but never manufactures numeric counts", () => {
    const bin = { key: "b", label: "0–10", order: 0, kind: "STANDARD", lowerBound: 0, upperBound: 10, count: 0 };
    expect(distributionBins({ bins: [bin] })?.[0]).toEqual(bin);
    expect(distributionBins({ bins: [{ ...bin, count: "0" }] })).toBeNull();
  });
  it("preserves mixed-unit ranked measures and explicit server scorecard status", () => {
    const primary = { key: "value", label: "Won", value: 100, unit: "MONEY", currencyCode: "EGP", references: [{ key: "t", label: "Target", kind: "TARGET", value: 80, unit: "MONEY", currencyCode: "EGP" }] };
    expect(rankedRows({ rows: [{ id: "u1", label: "Owner", rank: 2, primaryMeasure: primary, secondaryMeasures: [{ key: "r", label: "Rate", value: 25, unit: "PERCENT" }] }] })?.[0].secondaryMeasures[0].unit).toBe("PERCENT");
    expect(scorecardRows({ rows: [{ id: "s", label: "Score", status: "UNKNOWN", measures: [primary] }] })?.[0].status).toBe("UNKNOWN");
    expect(scorecardRows({ rows: [{ id: "s", label: "Score", status: "GOOD", measures: [primary] }] })).toBeNull();
    const result = parseWidgetResult({ widgetId: "preview", shape: "ROWS", series: [], result: { shape: "ROWS", rowKind: "RANKED", rows: [{ id: "u1", label: "Owner", rank: 2, primaryMeasure: primary, secondaryMeasures: [] }] }, meta: { warnings: [] } });
    const table = widgetTableModel(result, { label: "Owner", value: "Value", typed: { rank: "Rank", measure: "Measure", referenceKind: "Reference", TARGET: "Target" } });
    expect(table.rows.map((row) => row.cells[1])).toEqual([{ kind: "money", value: 100, currency: "EGP" }, { kind: "money", value: 80, currency: "EGP" }]);
    expect(table.columns.map((column) => column.label)).toContain("Reference");
  });
});
