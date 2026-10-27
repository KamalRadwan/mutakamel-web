// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { WidgetResult } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";
import { WidgetTile } from "./WidgetTile";

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
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "125");
    expect(container.querySelector("svg:not(.lucide)")).toBeNull();
  });
});

describe("dashboard tile message localization", () => {
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
    renderTile({ warnings: ["RESULT_TRUNCATED", "UNRECOGNIZED_WIDGET_WARNING", "CURRENCIES:EGP,USD"] });
    const t = dictionaries[lang].crmDashboards;
    expect(screen.getByText(`${t.widgetWarnings.RESULT_TRUNCATED} · ${t.widgetWarningGeneric}`)).toBeInTheDocument();
    expect(screen.queryByText(/RESULT_TRUNCATED|UNRECOGNIZED_WIDGET_WARNING|CURRENCIES:/)).toBeNull();
  });
});
