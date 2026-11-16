// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { WidgetBuilder } from "./WidgetBuilder";
import { EMPTY_WIDGET_FORM } from "../widget-form";

const fixtures = vi.hoisted(() => ({ authorized: false, get: vi.fn(), branchId: "018f0000-0000-7000-8000-000000000001" }));
if (typeof HTMLElement.prototype.scrollIntoView !== "function") HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("next/navigation", () => {
  const router = { push: vi.fn() };
  return { useRouter: () => router };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: fixtures.authorized ? {
  id: "018f0000-0000-7000-8000-000000000002", permissions: ["crm.targets.read", "crm.dashboards.read"],
  accessibleBranches: [fixtures.branchId], teamMemberships: [],
} : null }) }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: fixtures.get } }));
vi.mock("@/hooks/useTenantBranchLabels", () => ({ useTenantBranchLabels: () => new Map([[fixtures.branchId, "Cairo"]]) }));
vi.mock("../hooks/useWidgetPreview", () => ({
  useWidgetPreview: () => ({ result: null, error: null, busy: false, run: vi.fn() }),
}));

function renderBuilder() {
  const onCancel = vi.fn();
  const onSaveDraft = vi.fn();
  render(<WidgetBuilder title={en.crmWidgets.createTitle}
    catalog={{ gridColumns: 12, maxWidgets: 20, visualizations: [], metrics: [], dimensions: [], templates: [] }}
    isSubmitting={false} canPreview onReload={vi.fn()} onReview={vi.fn()} onCancel={onCancel} onSaveDraft={onSaveDraft} />);
  return { onCancel, onSaveDraft };
}

afterEach(() => { cleanup(); fixtures.authorized = false; fixtures.get.mockReset(); });

describe("Widget authoring workspace", () => {
  it.each(["BULLET", "METRIC_CARD", "COMBO"] as const)("browses CRM targets and saves a complete period for %s", async visualization => {
    fixtures.authorized = true;
    const registryMetric = "crm.opportunities.won.estimated_value";
    const pace = visualization === "METRIC_CARD";
    const combo = visualization === "COMBO";
    const standalone = pace || combo;
    const metricKey = combo ? "crm.opportunities.won.target.trajectory" : pace ? "crm.opportunities.won.target.required_per_workday" : registryMetric;
    const nameEn = combo ? "Daily won value and target plan" : pace ? "Required sales value per workday" : "Won value";
    const binding = { branchId: fixtures.branchId, subjectId: fixtures.branchId, currencyCode: "EGP", subjectType: "BRANCH", periodGrain: "MONTH" };
    fixtures.get.mockResolvedValue({ data: { page: 1, limit: 25, hasNext: false, items: [{ ...binding, metricKey: registryMetric,
      id: "018f0000-0000-7000-8000-000000000003", subjectName: "Cairo", periodStart: "2026-10-01", periodEndExclusive: "2026-11-01" }] } });
    const onSaveDraft = vi.fn();
    render(<WidgetBuilder title={en.crmWidgets.createTitle} initial={{ ...EMPTY_WIDGET_FORM, name: "Target test", visualizationType: visualization,
      ...(combo ? { series: [...EMPTY_WIDGET_FORM.series, ...EMPTY_WIDGET_FORM.series], grain: "MONTH" }
        : pace ? {} : { comparison: "GOVERNED_TARGET", series: [{ metricKey, axis: "", label: "", color: "" }] }) }}
      catalog={{ gridColumns: 12, maxWidgets: 20, visualizations: [{ key: visualization, shapes: [combo ? "TIME_SERIES" : "SCALAR"], requiresTarget: !standalone,
        minSeries: combo ? 2 : 1, maxSeries: combo ? 4 : 1, supportsPeriodComparison: false }], metrics: [{ key: metricKey, nameEn, nameAr: "قيمة الفوز",
        unit: "MONEY", shape: combo ? "TIME_SERIES" : "SCALAR", dimensions: [combo ? "time" : "none"], supportsPeriodComparison: !standalone, comparisonTypes: ["GOVERNED_TARGET"],
        ...(standalone ? { standalone: true, visualizations: [visualization], requiredComparison: "GOVERNED_TARGET" } : {}),
        ...(combo ? { requiredGrain: "DAY" } : {}) }],
        dimensions: [{ key: "none", grains: [] }, { key: "time", grains: ["DAY", "MONTH"] }], templates: [] }}
      isSubmitting={false} canPreview onReload={vi.fn()} onReview={vi.fn()} onCancel={vi.fn()} onSaveDraft={onSaveDraft} />);
    expect(fixtures.get).not.toHaveBeenCalled();
    if (standalone) {
      fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.builder.steps.metrics.title }));
      fireEvent.click(screen.getAllByRole("button", { name: en.crmWidgets.metric })[0]!);
      fireEvent.click(screen.getByRole("radio", { name: nameEn }));
      const choose = screen.getByRole("button", { name: en.crmWidgets.metricPicker.choose });
      expect(choose).toBeEnabled();
      fireEvent.click(choose);
      if (combo) {
        expect(screen.getByRole("button", { name: en.crmWidgets.metric })).toHaveTextContent(nameEn);
        fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.builder.steps.scope.title }));
        expect(screen.getByRole("combobox", { name: en.crmWidgets.grain })).toBeDisabled();
      }
    }
    fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.builder.steps.comparison.title }));
    const target = screen.getByRole("combobox", { name: en.crmWidgets.governedTarget.target });
    await waitFor(() => expect(target).toBeEnabled());
    expect(fixtures.get).toHaveBeenCalledWith(expect.stringContaining(`/api/tenant/crm/v1/targets?branchId=${fixtures.branchId}`),
      expect.objectContaining({ cache: "no-store" }));
    fireEvent.keyDown(target, { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("option", { name: /Cairo.*EGP.*2026-10-01/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.lifecycle.saveDraft }));
    expect(onSaveDraft).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ governedTarget: binding, comparison: "GOVERNED_TARGET",
      series: [expect.objectContaining({ metricKey })],
      ...(combo ? { dimensionKey: "time", grain: "DAY" } : {}),
      filters: { datePreset: "CUSTOM", dateFrom: "2026-10-01", dateTo: "2026-10-31" } }));
  });

  it("focuses the active stage and routes invalid review settings back to their field", () => {
    const { onSaveDraft } = renderBuilder();
    const { progress, steps, reviewSettings } = en.crmWidgets.builder;
    const nav = within(screen.getByRole("navigation", { name: progress }));
    expect(nav.getAllByRole("button")).toHaveLength(6);
    fireEvent.click(nav.getByRole("button", { name: steps.review.title }));
    expect(screen.getByRole("heading", { name: steps.review.title })).toHaveFocus();
    expect(screen.getByRole("button", { name: en.crmWidgets.preview })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.crmWidgets.lifecycle.saveDraft })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(en.crmWidgets.formErrors.NAME_REQUIRED);
    fireEvent.click(screen.getByRole("button", { name: reviewSettings }));
    expect(screen.getByRole("heading", { name: steps.details.title })).toHaveFocus();
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it("saves an incomplete draft from a step before review", () => {
    const { onSaveDraft } = renderBuilder();
    fireEvent.change(screen.getByRole("textbox", { name: en.crmWidgets.name }), { target: { value: "Lead conversions" } });
    fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.lifecycle.saveDraft }));
    expect(onSaveDraft).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: "Lead conversions", visualizationType: "" }));
  });

  it("retains the draft between stages and confirms discard", () => {
    const { onCancel } = renderBuilder();
    const { progress, steps, next } = en.crmWidgets.builder;
    fireEvent.change(screen.getByRole("textbox", { name: en.crmWidgets.name }), { target: { value: "Lead conversions" } });
    fireEvent.click(screen.getByRole("button", { name: next }));
    const nav = within(screen.getByRole("navigation", { name: progress }));
    fireEvent.click(nav.getByRole("button", { name: steps.details.title }));
    expect(screen.getByRole("textbox", { name: en.crmWidgets.name })).toHaveValue("Lead conversions");
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(onCancel).not.toHaveBeenCalled();
    const dialog = within(screen.getByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: en.common.discardConfirm }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
