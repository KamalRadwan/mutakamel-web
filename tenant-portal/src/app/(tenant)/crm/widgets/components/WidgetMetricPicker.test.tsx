// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { EMPTY_WIDGET_FORM, type WidgetFormState } from "../widget-form";
import { WidgetMetricPicker } from "./WidgetMetricPicker";

const locale = vi.hoisted(() => ({ arabic: false }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale.arabic
  ? { t: ar, lang: "ar", dir: "rtl" } : { t: en, lang: "en", dir: "ltr" } }));

const catalog: DashboardCatalog = {
  gridColumns: 12, maxWidgets: 20, templates: [], dimensions: [{ key: "none", grains: [] }],
  visualizations: [
    { key: "METRIC_CARD", shapes: ["SCALAR"], minSeries: 1, maxSeries: 1, requiresTarget: false, supportsPeriodComparison: true },
    { key: "MULTI_KPI", shapes: ["SCALAR"], minSeries: 2, maxSeries: 4, requiresTarget: false, supportsPeriodComparison: false },
    { key: "COLUMN", shapes: ["TIME_SERIES"], minSeries: 1, maxSeries: 4, requiresTarget: false, supportsPeriodComparison: true },
    { key: "ALERT_LIST", shapes: ["ROWS"], minSeries: 1, maxSeries: 1, requiresTarget: false, supportsPeriodComparison: false },
    { key: "LEADERBOARD", shapes: ["ROWS"], minSeries: 1, maxSeries: 1, requiresTarget: false, supportsPeriodComparison: false },
    { key: "TABLE", shapes: ["ROWS"], minSeries: 1, maxSeries: 4, requiresTarget: false, supportsPeriodComparison: false },
  ],
  metrics: [
    { key: "crm.leads.created.count", nameAr: "العملاء الجدد", nameEn: "New leads", unit: "COUNT", shape: "SCALAR", dimensions: ["none"],
      supportsPeriodComparison: true, timeModel: "COHORT", dateField: "CREATED_AT", accessResources: ["leads"] },
    { key: "crm.leads.converted.count", nameAr: "العملاء المحولون", nameEn: "Converted leads", unit: "COUNT", shape: "SCALAR", dimensions: ["none"],
      supportsPeriodComparison: true, timeModel: "EVENT", dateField: "CONVERTED_AT", accessResources: ["leads"] },
    { key: "test.money", nameAr: "القيمة الحالية", nameEn: "Current value", unit: "MONEY", shape: "SCALAR", dimensions: ["none"],
      supportsPeriodComparison: false, timeModel: "SNAPSHOT", dateField: "CURRENT_STATE", accessResources: ["opportunities"] },
    { key: "test.trend", nameAr: "اتجاه التحويل", nameEn: "Conversion trend", unit: "COUNT", shape: "TIME_SERIES", dimensions: ["time"],
      supportsPeriodComparison: true, visualizations: ["COLUMN"] },
    { key: "test.standalone", nameAr: "مؤشر مستقل", nameEn: "Standalone metric", unit: "PERCENT", shape: "SCALAR", dimensions: ["none"],
      supportsPeriodComparison: false, standalone: true },
    { key: "crm.action_center.prioritized_alerts", nameAr: "تنبيهات الإجراءات ذات الأولوية", nameEn: "Prioritized action alerts", unit: "COUNT",
      shape: "ROWS", rowKind: "ALERT", dimensions: ["record"], supportsPeriodComparison: false },
    { key: "test.ranked", nameAr: "الترتيب", nameEn: "Ranked rows", unit: "COUNT", shape: "ROWS", rowKind: "RANKED",
      dimensions: ["none"], supportsPeriodComparison: false },
  ],
};
const form = (patch: Partial<WidgetFormState> = {}): WidgetFormState => ({ ...EMPTY_WIDGET_FORM, visualizationType: "METRIC_CARD",
  series: [{ metricKey: "crm.leads.created.count", axis: "LEFT", label: "Keep label", color: "#123456" }], ...patch });
const labels = en.crmWidgets.metricPicker;

function setup(options: { draft?: WidgetFormState; disabled?: boolean; error?: string } = {}) {
  const onChoose = vi.fn();
  const props = { form: options.draft ?? form(), index: 0, catalog, disabled: options.disabled ?? false, error: options.error, onChoose };
  const view = render(<WidgetMetricPicker {...props} />);
  return { ...view, props, onChoose, open: () => fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.metric })) };
}

afterEach(() => { cleanup(); locale.arabic = false; });

describe("CRM metric inspection and selection", () => {
  it("labels the field, focuses search and shows source-backed event semantics", async () => {
    const { open } = setup({ error: en.crmWidgets.formErrors.METRIC_REQUIRED });
    const trigger = screen.getByRole("button", { name: en.crmWidgets.metric });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAccessibleDescription(en.crmWidgets.formErrors.METRIC_REQUIRED);
    open();
    await waitFor(() => expect(screen.getByRole("searchbox", { name: labels.search })).toHaveFocus());
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    const details = within(screen.getByRole("region", { name: labels.details }));
    expect(details.getByText(labels.dateFields.CONVERTED_AT)).toBeInTheDocument();
    expect(details.getByText(labels.timeDescriptions.EVENT)).toBeInTheDocument();
    expect(details.getByText(labels.resources.leads)).toBeInTheDocument();
    expect(details.getByText(labels.accessNotice)).toBeInTheDocument();
    expect(details.queryByText("CRM_DASHBOARD:", { exact: false })).not.toBeInTheDocument();
  });

  it("keeps inspection local until Choose and preserves the original definition", () => {
    const draft = form({ filters: { branchId: "kept" }, comparison: "NONE", displaySpec: { title: "Keep title" } });
    const original = structuredClone(draft);
    const { open, onChoose } = setup({ draft });
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: labels.choose }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("crm.leads.converted.count");
    expect(draft).toEqual(original);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("discards Cancel and Escape, resets search on reopen and returns focus", async () => {
    const { open, onChoose } = setup();
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "converted" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    await waitFor(() => expect(screen.getByRole("button", { name: en.crmWidgets.metric })).toHaveFocus());
    open();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "New leads" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: en.crmWidgets.metric })).toHaveFocus();
  });

  it("searches bilingual names, units, date labels and sources without losing the staged choice", () => {
    const { open } = setup();
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    for (const query of ["القيمة الحالية", "Amount", "Current state", "Opportunities"]) {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
      expect(screen.getAllByRole("radio")).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "Current value" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Converted leads" })).toBeInTheDocument();
    }
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-metric" } });
    expect(screen.getByRole("status")).toHaveTextContent(labels.noResults);
    expect(screen.getByRole("button", { name: labels.choose })).toBeEnabled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getByRole("radio", { name: "Converted leads" })).toBeChecked();
  });

  it("allows inspecting incompatible metrics while preventing their adoption", () => {
    const { open, onChoose } = setup();
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Conversion trend" }));
    expect(screen.getByRole("radio", { name: "Conversion trend" })).toHaveAccessibleDescription(
      `${labels.unit}: ${en.crmDashboards.metricUnits.COUNT} ${labels.dateBasis}: ${labels.unknown} ${labels.incompatible}`,
    );
    const details = within(screen.getByRole("region", { name: labels.details }));
    expect(details.getByText(labels.incompatible)).toBeInTheDocument();
    expect(details.getByText(en.crmDashboards.visualizations.COLUMN)).toBeInTheDocument();
    expect(details.getByText(labels.timeDescriptions.UNKNOWN)).toBeInTheDocument();
    expect(details.getAllByText(labels.unknown)).toHaveLength(3);
    expect(details.queryByText(labels.dateFields.CREATED_AT)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.choose })).toBeDisabled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("supports arrow-key inspection without committing the series", async () => {
    const { open, onChoose } = setup();
    open();
    const first = screen.getByRole("radio", { name: "New leads" });
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Converted leads" })).toHaveFocus());
    expect(screen.getByRole("radio", { name: "Converted leads" })).toBeChecked();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("respects the server row-kind restriction in both choosing and supported charts", () => {
    const { open } = setup({ draft: form({ visualizationType: "ALERT_LIST" }) });
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Prioritized action alerts" }));
    expect(screen.getByRole("button", { name: labels.choose })).toBeEnabled();
    const details = within(screen.getByRole("region", { name: labels.details }));
    expect(details.getByText(en.crmDashboards.visualizations.ALERT_LIST)).toBeInTheDocument();
    expect(details.queryByText(en.crmDashboards.visualizations.LEADERBOARD)).not.toBeInTheDocument();
    expect(details.queryByText(en.crmDashboards.visualizations.TABLE)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Ranked rows" }));
    expect(screen.getByRole("button", { name: labels.choose })).toBeDisabled();
  });

  it("excludes standalone metrics from multi-series charts and from another standalone series", () => {
    const draft = form({ visualizationType: "MULTI_KPI", series: [...form().series, { ...form().series[0], metricKey: "test.money" }] });
    const { open, rerender, props } = setup({ draft });
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Standalone metric" }));
    expect(screen.getByRole("button", { name: labels.choose })).toBeDisabled();
    const details = within(screen.getByRole("region", { name: labels.details }));
    expect(details.queryByText(en.crmDashboards.visualizations.MULTI_KPI)).not.toBeInTheDocument();
    rerender(<WidgetMetricPicker {...props} form={{ ...draft, series: [draft.series[0], { ...draft.series[1], metricKey: "test.standalone" }] }} />);
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    expect(screen.getByRole("button", { name: labels.choose })).toBeDisabled();
  });

  it("revalidates the staged choice when catalogue or pending state changes", () => {
    const { open, rerender, props, onChoose } = setup();
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Converted leads" }));
    rerender(<WidgetMetricPicker {...props} disabled />);
    expect(screen.getByRole("button", { name: labels.choose })).toBeDisabled();
    rerender(<WidgetMetricPicker {...props} catalog={{ ...catalog, metrics: catalog.metrics.filter((metric) => metric.key !== "crm.leads.converted.count") }} />);
    expect(screen.getByRole("button", { name: labels.choose })).toBeDisabled();
    expect(screen.getByText(labels.inspectHint)).toBeInTheDocument();
    rerender(<WidgetMetricPicker {...props} catalog={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(labels.noResults);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("does not emit an unchanged metric and cannot open while disabled", () => {
    const { open, rerender, props, onChoose } = setup({ disabled: true });
    open();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<WidgetMetricPicker {...props} disabled={false} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: labels.choose }));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("uses Arabic metadata and RTL direction", () => {
    locale.arabic = true;
    render(<WidgetMetricPicker form={form()} index={0} catalog={catalog} disabled={false} onChoose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: ar.crmWidgets.metric }));
    expect(screen.getByRole("dialog")).toHaveAttribute("dir", "rtl");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: ar.crmWidgets.metricPicker.dateFields.CONVERTED_AT } });
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    fireEvent.click(screen.getByRole("radio", { name: "العملاء المحولون" }));
    expect(screen.getByRole("button", { name: ar.crmWidgets.metricPicker.choose })).toBeEnabled();
    expect(screen.getByText(ar.crmWidgets.metricPicker.accessNotice)).toBeInTheDocument();
  });
});
