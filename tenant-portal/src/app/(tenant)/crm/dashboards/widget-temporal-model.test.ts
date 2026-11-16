import { describe, expect, it } from "vitest";
import { civilDay, flowData, intervalData } from "./widget-temporal-model";
import { parseWidgetResult } from "./dashboard-run-contract";
const series = (points: unknown[]) => parseWidgetResult({ widgetId: "preview", series: [{ key: "s", points }], meta: {} }).series;
describe("time and graph geometry source boundaries", () => {
  it("retains actual offset instants, zero durations, and chronological order", () => {
    const values = intervalData(series([{ key: "b", value: 0, start: "2026-10-01T02:00:00+02:00", end: "2026-10-01T02:00:00+02:00" }, { key: "a", value: 0, start: "2026-09-30T23:00:00Z", end: "2026-10-01T00:00:00Z" }]));
    expect(values?.map((row) => row.key)).toEqual(["a", "b"]);
    expect(values?.[1].start).toBe(Date.parse("2026-10-01T00:00:00Z"));
    expect(intervalData(series([{ key: "a", value: 0, start: "2026-10-01T00:00:00", end: "2026-10-01T01:00:00" }]))).toBeNull();
    expect(intervalData(series([{ key: "a", value: 0, start: "2026-10-02T00:00:00Z", end: "2026-10-01T01:00:00Z" }]))).toBeNull();
  });
  it("uses civil dates without browser-zone shifts and rejects invalid dates", () => {
    expect(civilDay("2026-10-01")).toBe(Date.parse("2026-10-01T00:00:00Z"));
    expect(civilDay("2026-02-30")).toBeNull(); expect(civilDay("2026-10-01T00:00:00Z")).toBeNull();
  });
  it("keeps cyclic and self-loop transition edges without converting them into opportunity node totals", () => {
    const graph = flowData(series([{ key: "ab", value: 5, meta: { source: "a", target: "b", sourceLabel: "Qualified", targetLabel: "Proposal" } }, { key: "ba", value: 2, meta: { source: "b", target: "a", sourceLabel: "Proposal", targetLabel: "Qualified" } }, { key: "aa", value: 1, meta: { source: "a", target: "a", sourceLabel: "Qualified", targetLabel: "Qualified" } }]));
    expect(graph?.nodes).toHaveLength(2); expect(graph?.edges.map((edge) => edge.value)).toEqual([5, 2, 1]);
    expect(graph?.nodes[0]).not.toHaveProperty("value");
    expect(flowData(series([{ key: "bad", value: 1, meta: { source: "a", target: "b" } }]))).toBeNull();
  });
});
