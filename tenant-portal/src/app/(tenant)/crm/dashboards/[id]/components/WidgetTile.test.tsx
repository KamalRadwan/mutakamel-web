// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { parseWidgetResult, type WidgetResult } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";
import { WidgetTile } from "./WidgetTile";
import { WidgetPreview } from "../../../widgets/components/WidgetPreview";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar } as const;
const directions = { en: "ltr", ar: "rtl" } as const;
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[state.lang], lang: state.lang, dir: directions[state.lang] }),
}));

const widget: WidgetDefinition = {
  id: "01900300-0000-7000-8000-000000000001",
  ownerUserId: "01900300-0000-7000-8000-000000000002",
  ownerName: null,
  name: "New leads",
  visualizationType: "METRIC_CARD",
  querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
  displaySpec: {}, schemaVersion: 1, revision: 1,
  createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
  accessLevel: "OWNER", isShared: false,
};

function result(overrides: Partial<WidgetResult> = {}): WidgetResult {
  return {
    widgetId: widget.id, shape: "SCALAR", value: 125,
    previousValue: null, target: null, series: [], rows: [], typedResult: null,
    unit: "COUNT", currency: null, generatedAt: "2026-10-18T00:00:00Z",
    warnings: [], errorCode: null,
    ...overrides,
  };
}

function renderTile(overrides: Partial<WidgetResult> = {}) {
  return render(<WidgetTile widget={widget} result={result(overrides)}
    placementId="01900300-0000-7000-8000-000000000003"
    isRemoving={false} onDrilldown={vi.fn()} />);
}

afterEach(() => { cleanup(); state.lang = "en"; });

describe("scalar KPI data honesty", () => {
  it("shows exact CRM target evidence with a real meter", () => {
    const governedTarget = { state: "READY", basis: "RECORDED_WON_EVENT", currencyCode: "SAR", measure: "ATTAINMENT", workingPace: null,
      periodStart: "2026-10-01", periodEndExclusive: "2026-11-01", periodState: "OPEN", coverageStartedAt: "2026-09-01T00:00:00Z", revision: 2,
      amounts: { targetValue: "100.00", actualValue: "12.345", remainingValue: "87.655", attainmentPercent: "12.35", excludedCount: 0 } };
    const wire = { widgetId: widget.id, shape: "SCALAR", state: "READY", value: 12.345, target: 100, series: [],
      meta: { unit: "MONEY", currency: "SAR", timeBasis: "EVENT" }, governedTarget };
    expect(() => parseWidgetResult({ ...wire, governedTarget: { ...governedTarget,
      amounts: { ...governedTarget.amounts, attainmentPercent: "12.34" } } })).toThrow();
    render(<WidgetTile widget={{ ...widget, visualizationType: "BULLET" }} result={parseWidgetResult(wire)}
      placementId={widget.id} isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "12.345");
    expect(screen.getByText(en.crmDashboardReports.wonTarget.recordedWon)).toBeInTheDocument();
    expect(screen.getByText(/12\.35%/)).toBeInTheDocument();
  });

  it("keeps an authorized CRM team target visible without plotting unrecorded history", () => {
    state.lang = "ar";
    const unavailable = parseWidgetResult({ widgetId: widget.id, shape: "SCALAR", state: "UNAVAILABLE", value: null, series: [],
      meta: { unit: "MONEY", currency: "EGP", timeBasis: "EVENT" }, governedTarget: { state: "TEAM_HISTORY_UNAVAILABLE", basis: "RECORDED_WON_EVENT", measure: "ATTAINMENT", workingPace: null,
        currencyCode: "EGP", periodStart: "2026-10-01", periodEndExclusive: "2026-11-01", periodState: "OPEN", coverageStartedAt: "2026-09-01T00:00:00Z", revision: 1,
        amounts: { targetValue: "100.00", actualValue: null, remainingValue: null, attainmentPercent: null, excludedCount: null } } });
    render(<WidgetTile widget={{ ...widget, visualizationType: "BULLET" }} result={unavailable}
      placementId={widget.id} isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getByText(ar.crmDashboardReports.wonTarget.states.TEAM_HISTORY_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("renders one exact workday KPI in both the tile and Builder preview", () => {
    const labels = en.crmDashboardReports.wonTarget;
    const workingPace = { state: "READY", calendarRevision: 4, remainingWorkdays: 2, requiredPerWorkday: "43.828" };
    const governedTarget = { state: "READY", basis: "RECORDED_WON_EVENT", measure: "DAILY_PACE", currencyCode: "SAR",
      periodStart: "2026-10-01", periodEndExclusive: "2026-11-01", periodState: "OPEN", coverageStartedAt: "2026-09-01T00:00:00Z", revision: 2,
      amounts: { targetValue: "100.00", actualValue: "12.345", remainingValue: "87.655", attainmentPercent: "12.35", excludedCount: 0 }, workingPace };
    const wire = { widgetId: widget.id, shape: "SCALAR", state: "READY", value: 43.828, series: [],
      meta: { unit: "MONEY", currency: "SAR", timeBasis: "SNAPSHOT" }, governedTarget };
    expect(() => parseWidgetResult({ ...wire, value: 12.345 })).toThrow();
    expect(() => parseWidgetResult({ ...wire, target: 100 })).toThrow();
    expect(() => parseWidgetResult({ ...wire, meta: { ...wire.meta, timeBasis: "EVENT" } })).toThrow();
    expect(() => parseWidgetResult({ ...wire, governedTarget: { ...governedTarget, workingPace: { ...workingPace, requiredPerWorkday: "43.827" } } })).toThrow();
    const parsed = parseWidgetResult(wire);
    render(<><WidgetTile widget={widget} result={parsed} placementId={widget.id} isRemoving={false} onDrilldown={vi.fn()} />
      <WidgetPreview visualizationType="METRIC_CARD" result={parsed} name="Pace preview" /></>);
    const regions = screen.getAllByRole("region", { name: labels.paceTitle });
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      expect(within(region).getByText(/SAR\s*43\.828/u)).toBeInTheDocument();
      expect(within(region).getByText(labels.calendarRevision)).toBeInTheDocument();
    }
    expect(screen.getByRole("columnheader", { name: labels.dailyPace })).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
    cleanup();
    renderTile(parseWidgetResult({ ...wire, value: 0, governedTarget: { ...governedTarget,
      amounts: { ...governedTarget.amounts, actualValue: "110.000", remainingValue: "0.000", attainmentPercent: "110.00" },
      workingPace: { ...workingPace, requiredPerWorkday: "0.000" } } }));
    const zeroCard = within(screen.getByRole("region", { name: labels.paceTitle }));
    expect(zeroCard.getAllByText(/SAR\s*0\.00/u)).toHaveLength(2);
    expect(zeroCard.queryByRole("note")).toBeNull();
  });

  it.each(["en", "ar"] as const)("renders a governed daily combo and its exact table in %s", lang => {
    state.lang = lang;
    const t = dictionaries[lang];
    const labels = t.crmDashboardReports.wonTarget.trajectory;
    const governedTarget = { state: "READY", basis: "RECORDED_WON_EVENT", measure: "TRAJECTORY", currencyCode: "SAR",
      periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", periodState: "OPEN", coverageStartedAt: "2026-09-01T00:00:00Z", revision: 2,
      amounts: { targetValue: "100.00", actualValue: "12.345", remainingValue: "87.655", attainmentPercent: "12.35", excludedCount: 0 },
      workingPace: { state: "READY", calendarRevision: 4, remainingWorkdays: 1, requiredPerWorkday: "87.655" },
      trajectory: { timeZone: "Africa/Cairo", points: Array.from({ length: 30 }, (_, index) => ({
        date: `2026-11-${String(index + 1).padStart(2, "0")}`,
        wonValue: index === 29 ? null : index === 28 ? "12.345" : "0.000",
        observedCumulative: index === 29 ? null : index === 28 ? "12.345" : "0.000",
        plannedCumulative: index === 29 ? "100.000" : index === 28 ? "12.345" : null,
        isPlannedWorkday: index === 29,
      })) } };
    const wire = { widgetId: widget.id, shape: "TIME_SERIES", state: "READY", value: null, series: [],
      meta: { unit: "MONEY", currency: "SAR", timeBasis: "SNAPSHOT", generatedAt: "2026-11-28T22:15:00.000Z" }, governedTarget };
    expect(() => parseWidgetResult({ ...wire, shape: "SCALAR" })).toThrow();
    expect(() => parseWidgetResult({ ...wire, value: 12.345 })).toThrow();
    expect(() => parseWidgetResult({ ...wire, governedTarget: { ...governedTarget, trajectory: null } })).toThrow();
    expect(() => parseWidgetResult({ ...wire, governedTarget: { ...governedTarget,
      trajectory: { ...governedTarget.trajectory, points: governedTarget.trajectory.points.slice(0, -1) } } })).toThrow();
    const parsed = parseWidgetResult(wire);
    render(<div dir={directions[lang]}><WidgetTile widget={{ ...widget, visualizationType: "COMBO", name: "Target plan" }}
      result={parsed} placementId={widget.id} isRemoving={false} onDrilldown={vi.fn()} />
      <WidgetPreview visualizationType="COMBO" result={parsed} name="Target plan preview" /></div>);
    expect(screen.getByRole("img", { name: "Target plan" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Target plan preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.crmDashboards.showDataTable }));
    expect(screen.getAllByRole("columnheader", { name: labels.plan })).toHaveLength(2);
    for (const table of screen.getAllByRole("table")) {
      expect(within(table).getByRole("row", { name: /2026-11-29/u })).toHaveTextContent(/12\.345/u);
      expect(within(table).getByRole("row", { name: /2026-11-30/u })).toHaveTextContent(/100\.00/u);
    }
  });

  it("shows the workday denominator failure separately from won data readiness", () => {
    const unavailable = parseWidgetResult({ widgetId: widget.id, shape: "SCALAR", state: "UNAVAILABLE", value: null, series: [],
      meta: { unit: "MONEY", currency: "EGP", timeBasis: "SNAPSHOT" }, governedTarget: { state: "READY", basis: "RECORDED_WON_EVENT", measure: "DAILY_PACE",
        currencyCode: "EGP", periodStart: "2026-10-01", periodEndExclusive: "2026-11-01", periodState: "OPEN", coverageStartedAt: "2026-09-01T00:00:00Z", revision: 1,
        workingPace: { state: "NO_REMAINING_WORKDAYS", calendarRevision: 1, remainingWorkdays: 0, requiredPerWorkday: null },
        amounts: { targetValue: "100.00", actualValue: "0.000", remainingValue: "100.000", attainmentPercent: "0.00", excludedCount: 0 } } });
    renderTile(unavailable);
    expect(screen.getByText(en.crmDashboardReports.wonTarget.workingPaceStates.NO_REMAINING_WORKDAYS)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("shows an Arabic team history gap and published workdays without deriving a rate", () => {
    state.lang = "ar";
    const labels = ar.crmDashboardReports.wonTarget;
    const parsed = parseWidgetResult({ widgetId: widget.id, shape: "SCALAR", state: "UNAVAILABLE", value: null, series: [],
      meta: { unit: "MONEY", currency: "SAR", timeBasis: "SNAPSHOT" }, governedTarget: { state: "TEAM_HISTORY_UNAVAILABLE", basis: "RECORDED_WON_EVENT", measure: "DAILY_PACE",
        currencyCode: "SAR", periodStart: "2026-11-01", periodEndExclusive: "2026-12-01", periodState: "OPEN", coverageStartedAt: "2026-09-01T00:00:00Z", revision: 1,
        workingPace: { state: "ACTUAL_UNAVAILABLE", calendarRevision: 4, remainingWorkdays: 7, requiredPerWorkday: null },
        amounts: { targetValue: "800000.00", actualValue: null, remainingValue: null, attainmentPercent: null, excludedCount: null } } });
    renderTile(parsed);
    const card = within(screen.getByRole("region", { name: labels.paceTitle }));
    expect(card.getByRole("note")).toHaveTextContent(labels.states.TEAM_HISTORY_UNAVAILABLE);
    expect(card.getByText("7", { exact: true })).toBeInTheDocument();
    expect(card.getByText(labels.calendarRevision)).toBeInTheDocument();
    expect(card.queryByText(/SAR\s*0\.00/u)).toBeNull();
  });

  it("opens archive from the keyboard menu only when the canvas supplies the owner action", async () => {
    const { rerender } = renderTile();
    const name = en.crmWidgets.governance.actions.replace("{name}", widget.name);
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    const onArchive = vi.fn(() => true);
    rerender(<WidgetTile widget={widget} result={result()} placementId="01900300-0000-7000-8000-000000000003"
      isRemoving={false} onDrilldown={vi.fn()} onArchive={onArchive} />);
    const trigger = screen.getByRole("button", { name });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: en.crmWidgets.governance.archive }));
    expect(onArchive).toHaveBeenCalledExactlyOnceWith(trigger);
  });

  it.each(["UNAVAILABLE", "FAILED", "DEADLINE_EXCEEDED"] as const)("hides values from a %s result even without an error code", (state) => {
    renderTile({ state, value: 125 });
    expect(screen.queryByText("125")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
  it("keeps a real zero and target in the native bullet geometry", () => {
    render(<WidgetTile widget={{ ...widget, visualizationType: "BULLET" }} result={result({ value: 0, target: 250, series: [] })}
      placementId="01900300-0000-7000-8000-000000000003" isRemoving={false} onDrilldown={vi.fn()} />);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText(en.crmDashboards.targetOf.replace("{target}", "250"))).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
  it("opens an exact scalar table with the actual target and previous value using the keyboard-accessible control", () => {
    renderTile({ value: 125, previousValue: 100, target: 250 });
    fireEvent.click(screen.getByRole("button", { name: en.crmDashboards.showDataTable }));
    expect(screen.getByRole("table")).toHaveTextContent("125");
    expect(screen.getByRole("table")).toHaveTextContent("100");
    expect(screen.getByRole("table")).toHaveTextContent("250");
  });
  it("shows only the value when there is no comparison or target", () => {
    const { container } = renderTile();
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(container.querySelector("svg:not(.lucide)")).toBeNull();
    expect(container.querySelector("linearGradient")).toBeNull();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps the existing delta badge without inventing a trend series", () => {
    const { container } = renderTile({ previousValue: 100 });
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getByText(/\+25.*\(100\)/)).toBeInTheDocument();
    expect(container.querySelector("svg:not(.lucide)")).toBeNull();
  });

  it("keeps target progress when the run supplies a target", () => {
    const { container } = renderTile({ target: 250 });
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "125");
    expect(container.querySelector("svg:not(.lucide)")).not.toBeNull();
  });
  it("keeps an actual above-target value determinate rather than passing an out-of-range value to a task progressbar", () => {
    renderTile({ value: 125, target: 100 });
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "125");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemax", "125");
  });
});

describe("dashboard tile message localization", () => {
  it.each(["en", "ar"] as const)("explains partial coverage and ignored filters without hiding readable values in %s", (lang) => {
    state.lang = lang;
    renderTile({ partialAccess: true, ignoredFilters: ["ownerUserId"] });
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getByText(dictionaries[lang].crmDashboards.partialAccessNotice)).toBeInTheDocument();
    expect(screen.getByText(dictionaries[lang].crmDashboards.ignoredFiltersNotice)).toBeInTheDocument();
    expect(screen.queryByText("ownerUserId")).toBeNull();
  });
  it.each(["en", "ar"] as const)("translates known errors and hides their wire code in %s", (lang) => {
    state.lang = lang;
    const code = "CRM_WIDGET_EXECUTION_FAILED";
    renderTile({ errorCode: code });
    expect(screen.getByText(dictionaries[lang].crmDashboards.widgetErrors[code])).toBeInTheDocument();
    expect(screen.queryByText(code)).toBeNull();
  });

  it.each(["en", "ar"] as const)("uses a translated fallback for unknown errors in %s", (lang) => {
    state.lang = lang;
    renderTile({ errorCode: "UNRECOGNIZED_WIDGET_ERROR" });
    expect(screen.getByText(dictionaries[lang].crmDashboards.widgetFailedGeneric)).toBeInTheDocument();
    expect(screen.queryByText("UNRECOGNIZED_WIDGET_ERROR")).toBeNull();
  });

  it.each(["en", "ar"] as const)("translates known and unknown warnings without showing codes in %s", (lang) => {
    state.lang = lang;
    renderTile({ warnings: ["RESULT_TRUNCATED", "UNRECOGNIZED_WIDGET_WARNING", "OTHER_CURRENCIES"] });
    const t = dictionaries[lang].crmDashboards;
    expect(screen.getByText(`${t.widgetWarnings.RESULT_TRUNCATED} · ${t.widgetWarningGeneric} · ${t.widgetWarnings.OTHER_CURRENCIES}`)).toBeInTheDocument();
    expect(screen.queryByText(/RESULT_TRUNCATED|UNRECOGNIZED_WIDGET_WARNING|CURRENCIES:/)).toBeNull();
  });
});
