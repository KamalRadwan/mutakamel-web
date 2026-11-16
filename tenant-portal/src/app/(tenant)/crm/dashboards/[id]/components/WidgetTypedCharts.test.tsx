// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { ReactNode } from "react";
import { parseWidgetResult } from "../../dashboard-run-contract";
import { WidgetTypedCharts } from "./WidgetTypedCharts";
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>, HierarchyChart: ({ data }: { data: unknown }) => <div data-testid="hierarchy">{JSON.stringify(data)}</div>, WaterfallChart: ({ steps }: { steps: unknown }) => <div>{JSON.stringify(steps)}</div> }));
afterEach(cleanup);
const result = (typed: Record<string, unknown>) => parseWidgetResult({ widgetId: "preview", shape: typed.shape, series: [], result: typed, meta: { warnings: [] } });
it("keeps every ranked row and its independently formatted measure/reference", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: String(index), label: `Owner ${index}`, rank: index + 1,
    primaryMeasure: { key: "won", label: "Won value", value: 100, unit: "MONEY", currencyCode: "EGP", references: [{ key: "t", label: "Goal", kind: "TARGET", value: 80, unit: "MONEY", currencyCode: "EGP" }] },
    secondaryMeasures: [{ key: "rate", label: "Conversion", value: 25, unit: "PERCENT" }] }));
  render(<WidgetTypedCharts mode="LEADERBOARD" label="Owners" result={result({ shape: "ROWS", rowKind: "RANKED", rows })} />);
  expect(screen.getByText("Owner 11")).toBeInTheDocument();
  expect(screen.getAllByText(/25%/)).toHaveLength(12);
  expect(screen.getAllByText(/EGP/)).toHaveLength(24);
});
it("does not infer a favorable scorecard status or invent missing hierarchy remainder", () => {
  const { rerender } = render(<WidgetTypedCharts mode="SCORECARD" label="Score" result={result({ shape: "ROWS", rowKind: "SCORECARD", rows: [{ id: "s", label: "Sales", status: "UNKNOWN", measures: [{ key: "m", label: "Rate", value: 99, unit: "PERCENT" }] }] })} />);
  expect(screen.getByText(en.crmDashboards.scorecardStatuses.UNKNOWN)).toBeInTheDocument();
  rerender(<WidgetTypedCharts mode="TREEMAP" label="Pipeline" result={result({ shape: "HIERARCHY", unit: "COUNT", nodes: [{ id: "p", label: "Pipeline", value: 100, depth: 0 }, { id: "s", parentId: "p", label: "Stage", value: 60, depth: 1 }] })} />);
  expect(screen.getByText(en.crmDashboards.invalidChartGeometry)).toBeInTheDocument();
  expect(screen.queryByTestId("hierarchy")).toBeNull();
});
