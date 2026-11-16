import { expect, it } from "vitest";
import { parseCatalogResponse } from "./dashboard-catalog-contract";
import { currentDrillCurrency, currentWidgetDrillAdmission } from "./widget-drill-admission";
import type { WidgetDefinition } from "./widget-contract";

const widget = (metricKey: string, dimension = "none", more: Record<string, unknown> = {}) => ({
  querySpec: { series: [{ metricKey }], dimension: { key: dimension }, ...more },
}) as WidgetDefinition;

const trend = "crm.leads.converted.trend";
const branch = "crm.leads.converted.by_branch.count";
const money = "crm.opportunities.by_stage.estimated_value";
const catalog = parseCatalogResponse({
  grid: {}, visualizations: [], dimensions: [], templates: [],
  metrics: [
    { key: trend, shape: "TIME_SERIES", unit: "COUNT", dimensions: ["time"],
      drilldown: { dimensionKey: "time", requiresCurrency: false } },
    { key: branch, shape: "CATEGORY", unit: "COUNT", dimensions: ["branch"],
      drilldown: { dimensionKey: "branch", requiresCurrency: false } },
    { key: money, shape: "CATEGORY", unit: "MONEY", dimensions: ["stage"],
      drilldown: { dimensionKey: "stage", requiresCurrency: true } },
    { key: "unsupported", shape: "CATEGORY", unit: "COUNT", dimensions: ["branch"],
      drilldown: { dimensionKey: "owner", requiresCurrency: false } },
  ],
});

it.each([[trend, "time"], [branch, "branch"], [money, "stage"]])(
  "admits %s only for the server-registered dimension", (key, dimension) => {
    expect(currentWidgetDrillAdmission(widget(key, dimension), catalog, "EGP")).toBe("SUPPORTED");
    expect(currentWidgetDrillAdmission(widget(key, "invalid"), catalog, "EGP")).toBe("UNSUPPORTED");
  },
);

it("requires catalogue capability and rejects invalid or retired query formats", () => {
  expect(currentWidgetDrillAdmission(widget(branch, "branch"), null)).toBe("UNSUPPORTED");
  expect(currentWidgetDrillAdmission(widget("unregistered"), catalog)).toBe("UNSUPPORTED");
  expect(currentWidgetDrillAdmission(widget("unsupported", "owner"), catalog)).toBe("UNSUPPORTED");
  expect(currentWidgetDrillAdmission(widget(branch, "branch", { engine: "SEMANTIC_V1" }), catalog)).toBe("UNSUPPORTED");
  expect(currentWidgetDrillAdmission(widget(branch, "branch", { topN: 10 }), catalog)).toBe("UNSUPPORTED");
  expect(currentWidgetDrillAdmission(widget(branch, "branch", {
    series: [{ metricKey: branch }, { metricKey: branch }],
  }), catalog)).toBe("UNSUPPORTED");
});

it("requires currency per capability and keeps filter-layer precedence", () => {
  expect(currentWidgetDrillAdmission(widget(money, "stage"), catalog)).toBe("CURRENCY_REQUIRED");
  expect(currentWidgetDrillAdmission(widget(branch, "branch"), catalog)).toBe("SUPPORTED");
  expect(currentWidgetDrillAdmission(widget(money, "stage", { filters: { currencyCode: "SAR" } }), catalog)).toBe("SUPPORTED");
  expect(currentDrillCurrency({ currencyCode: "EGP" }, {}, null)).toBe("EGP");
  expect(currentDrillCurrency({ currencyCode: "EGP" }, { currencyCode: "SAR" }, null)).toBe("SAR");
  expect(currentDrillCurrency({ currencyCode: "EGP" }, { currencyCode: null }, null)).toBeNull();
  expect(currentDrillCurrency({ currencyCode: "EGP" }, { currencyCode: null }, "SAR")).toBe("SAR");
});
