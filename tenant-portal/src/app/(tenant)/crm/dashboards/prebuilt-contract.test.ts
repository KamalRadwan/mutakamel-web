import { describe, expect, it } from "vitest";
import {
  PREBUILT_REPORTS,
  parsePrebuiltReport,
  prebuiltReportQuery,
} from "./prebuilt-contract";

const BRANCH_ID = "01900300-0000-7000-8000-0000000000d1";

const overview = PREBUILT_REPORTS.find((report) => report.key === "overview");

const envelope = {
  scope: { resource: "dashboards", action: "read", branches: [] },
  filters: {
    dateFrom: "2026-08-01T00:00:00.000Z",
    dateTo: "2026-08-31T23:59:59.999Z",
    staleDays: 30,
    limit: 10,
  },
  generatedAt: "2026-08-31T09:00:00.000Z",
  warnings: [],
  widgets: {
    pipelineValue: {
      byCurrency: [
        { currencyCode: "EGP", value: 125000.5 },
        { currencyCode: "USD", value: 4000 },
      ],
      warnings: ["MULTI_CURRENCY_SPLIT"],
    },
    wonValue: {
      value: 5000,
      currencyCode: "EGP",
      byCurrency: [{ currencyCode: "EGP", value: 5000 }],
      warnings: [],
    },
    activeDeals: 12,
    newLeads: 30,
    overdueWork: { state: "RETIRED" },
    winLossSummary: [{ status: "WON", currencyCode: "EGP", count: 3, value: 5000 }],
    topReps: [],
    staleDeals: [
      {
        id: "01900300-0000-7000-8000-0000000000e1",
        title: "Acme renewal",
        ownerUserId: null,
        value: 900.25,
        currencyCode: "EGP",
        updatedAt: "2026-08-20T09:00:00.000Z",
      },
    ],
  },
};

describe("Prebuilt CRM reports", () => {
  it("covers exactly the seven routes the controller exposes", () => {
    expect(PREBUILT_REPORTS).toHaveLength(7);
    expect(PREBUILT_REPORTS.map((report) => report.path)).toEqual([
      "/api/tenant/crm/v1/dashboards/overview",
      "/api/tenant/crm/v1/dashboards/sales-pipeline",
      "/api/tenant/crm/v1/dashboards/leads",
      "/api/tenant/crm/v1/dashboards/activities-productivity",
      "/api/tenant/crm/v1/dashboards/customer-intelligence",
      "/api/tenant/crm/v1/dashboards/data-quality",
      "/api/tenant/crm/v1/dashboards/action-center",
    ]);
  });

  it("sends only branchId — DashboardQueryDto has no datePreset and no compare", () => {
    expect(prebuiltReportQuery(BRANCH_ID)).toBe(`?branchId=${BRANCH_ID}`);
    expect(prebuiltReportQuery(null)).toBe("");
  });

  it("parses each widget by its own shape and never guesses a missing one", () => {
    const parsed = parsePrebuiltReport(envelope, overview!.widgets);
    expect(parsed.widgets.activeDeals).toEqual({ kind: "COUNT", value: 12 });
    expect(parsed.widgets.staleDeals).toMatchObject({ kind: "TABLE" });
    expect(parsed.dateFrom).toBe("2026-08-01T00:00:00.000Z");

    // `currencyTotals` omits `value`/`currencyCode` whenever more than one
    // currency is present, and says so through MULTI_CURRENCY_SPLIT.
    const pipelineValue = parsed.widgets.pipelineValue;
    expect(pipelineValue.kind).toBe("MONEY_TOTALS");
    if (pipelineValue.kind === "MONEY_TOTALS") {
      expect(pipelineValue.total).toBeNull();
      expect(pipelineValue.byCurrency).toHaveLength(2);
      expect(pipelineValue.warnings).toContain("MULTI_CURRENCY_SPLIT");
    }
    const wonValue = parsed.widgets.wonValue;
    if (wonValue.kind === "MONEY_TOTALS") {
      expect(wonValue.total).toEqual({ currencyCode: "EGP", value: 5000 });
    }
  });

  it("reports an absent widget as unavailable rather than as an empty result", () => {
    const parsed = parsePrebuiltReport(
      { ...envelope, widgets: { activeDeals: 3 } },
      overview!.widgets,
    );
    expect(parsed.widgets.newLeads).toEqual({ kind: "UNAVAILABLE" });
    expect(parsed.widgets.staleDeals).toEqual({ kind: "UNAVAILABLE" });
  });

  it("preserves retired sections and rejects old data as unavailable", () => {
    for (const report of PREBUILT_REPORTS) {
      for (const spec of report.widgets.filter((widget) => widget.kind === "RETIRED")) {
        const retired = parsePrebuiltReport({ ...envelope, widgets: { [spec.key]: { state: "RETIRED" } } }, [spec]);
        expect(retired.widgets[spec.key]).toEqual({ kind: "RETIRED" });
        const old = parsePrebuiltReport({ ...envelope, widgets: { [spec.key]: [] } }, [spec]);
        expect(old.widgets[spec.key]).toEqual({ kind: "UNAVAILABLE" });
      }
    }
  });

  it("rejects a Core envelope", () => {
    expect(() => parsePrebuiltReport({ success: true, data: envelope }, overview!.widgets)).toThrow();
  });

  it("accepts only a count for duplicate signals and discards phone-bearing rows", () => {
    const quality = PREBUILT_REPORTS.find((report) => report.key === "data-quality")!;
    const parsed = parsePrebuiltReport(
      { ...envelope, widgets: { duplicateSignals: 2 } },
      quality.widgets,
    );
    expect(parsed.widgets.duplicateSignals).toEqual({ kind: "COUNT", value: 2 });

    const phone = "+201000000000";
    const rejected = parsePrebuiltReport(
      { ...envelope, widgets: { duplicateSignals: [{ mobile: phone, parties: 2 }] } },
      quality.widgets,
    );
    expect(rejected.widgets.duplicateSignals).toEqual({ kind: "UNAVAILABLE" });
    expect(JSON.stringify(rejected)).not.toContain(phone);
  });
});
