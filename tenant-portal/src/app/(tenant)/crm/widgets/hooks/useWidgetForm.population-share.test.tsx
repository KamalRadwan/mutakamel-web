// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWidgetForm } from "./useWidgetForm";
import { EMPTY_WIDGET_FORM, validateWidgetForm, widgetInput, widgetToForm } from "../widget-form";
import { parseCatalogResponse } from "../../dashboards/dashboard-catalog-contract";
import { LEAD_MISSING_SOURCE_SHARE } from "../../dashboards/widget-acquisition-quality";

vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: () => ({}) }));
vi.mock("./useWidgetPreview", () => ({ useWidgetPreview: () => ({ result: null, run: vi.fn() }) }));
afterEach(cleanup);
const catalog = parseCatalogResponse({ grid: { columns: 12, maxWidgets: 20 }, templates: [], dimensions: [{ key: "none", grains: [] }],
  visualizations: ["METRIC_CARD", "PROGRESS_CARD", "BULLET"].map(key => ({ key, shapes: ["SCALAR"], minSeries: 1, maxSeries: 1,
    requiresTarget: key !== "METRIC_CARD", supportsPeriodComparison: false })),
  metrics: [{ key: LEAD_MISSING_SOURCE_SHARE, labelEn: "Missing source", labelAr: "دون مصدر", unit: "PERCENT", shape: "SCALAR", dimensions: ["none"],
    visualizations: ["METRIC_CARD", "PROGRESS_CARD"], standalone: true, populationShare: true, comparisonTypes: ["NONE"], supportsPeriodComparison: false },
  { key: "crm.leads.created.count", labelEn: "Created leads", labelAr: "العملاء المنشؤون", unit: "COUNT", shape: "SCALAR", dimensions: ["none"], supportsPeriodComparison: false }],
});

describe("Population-share authoring", () => {
  it("retains NONE and the no-target spec when switching from metric to progress", () => {
    const { result } = renderHook(() => useWidgetForm({ catalog, canPreview: true, pending: false, blocked: false, onSaveDraft: vi.fn(),
      initial: { ...EMPTY_WIDGET_FORM, name: "Missing source", visualizationType: "METRIC_CARD", comparison: "NONE",
        series: [{ metricKey: LEAD_MISSING_SOURCE_SHARE, label: "", color: "", axis: "" }] } }));
    act(() => result.current.update({ visualizationType: "PROGRESS_CARD" }));
    expect(result.current.form.comparison).toBe("NONE");
    expect(result.current.error).toBeNull();
    const saved = widgetInput(result.current.form);
    expect(saved.querySpec.comparison).toEqual({ type: "NONE" });
    expect(validateWidgetForm(widgetToForm(saved), catalog)).toBeNull();
    act(() => result.current.update({ visualizationType: "BULLET" }));
    expect(result.current.form.series[0].metricKey).toBe("");
  });
  it("removes forced target mode after choosing a population share in a progress card", () => {
    const { result } = renderHook(() => useWidgetForm({ catalog, canPreview: true, pending: false, blocked: false, onSaveDraft: vi.fn(),
      initial: { ...EMPTY_WIDGET_FORM, name: "Missing source", visualizationType: "PROGRESS_CARD", comparison: "TARGET", target: "100" } }));
    act(() => result.current.updateSeries(0, { metricKey: LEAD_MISSING_SOURCE_SHARE }));
    expect(result.current.form.comparison).toBe("NONE");
    expect(result.current.error).toBeNull();
    expect(widgetInput(result.current.form).querySpec.comparison).toEqual({ type: "NONE" });
  });
  it("preserves the target requirement for ordinary progress cards", () => {
    const form = { ...EMPTY_WIDGET_FORM, name: "Count", visualizationType: "PROGRESS_CARD" as const, comparison: "NONE" as const,
      series: [{ metricKey: "crm.leads.created.count", label: "", color: "", axis: "" as const }] };
    expect(validateWidgetForm(form, catalog)).toBe("TARGET_REQUIRED");
    expect(validateWidgetForm({ ...form, comparison: "TARGET", target: "100" }, catalog)).toBeNull();
  });
});
