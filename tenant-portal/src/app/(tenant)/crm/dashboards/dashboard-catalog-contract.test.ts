import { describe, expect, it } from "vitest";
import { parseCatalogResponse } from "./dashboard-catalog-contract";

describe("Dashboard metric availability", () => {
  it("reads bounded recipe metadata and rejects repeated recipe identities", () => {
    const base = { grid: {}, visualizations: [], dimensions: [], templates: [], metrics: [] };
    const recipe = { key: "converted-leads", family: "LEADS", nameAr: "التحويل", nameEn: "Converted leads",
      descriptionAr: "كم عميلًا تم تحويله؟", descriptionEn: "How many leads converted?", visualizationType: "METRIC_CARD",
      querySpec: { series: [{ metricKey: "crm.leads.converted.count" }] }, displaySpec: {}, sourceResources: ["leads"] };
    expect(parseCatalogResponse({ ...base, widgetRecipes: [recipe] }).widgetRecipes).toEqual([recipe]);
    expect(parseCatalogResponse(base).widgetRecipes).toEqual([]);
    expect(() => parseCatalogResponse({ ...base, widgetRecipes: [recipe, recipe] })).toThrow();
    expect(() => parseCatalogResponse({ ...base, widgetRecipes: [{ ...recipe, sourceResources: ["unregistered"] }] })).toThrow();
  });
  it("retains all five declared comparison types", () => {
    const comparisonTypes = ["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR", "TARGET", "DATASETS"];
    const catalog = parseCatalogResponse({ grid: {}, visualizations: [], dimensions: [], templates: [], metrics: [{
      key: "test.comparisons", unit: "COUNT", shape: "SCALAR", dimensions: ["none"], comparisonTypes,
    }] });
    expect(catalog.metrics[0].comparisonTypes).toEqual(comparisonTypes);
  });
  it("retains the server date basis and source vocabulary without treating them as data access", () => {
    const catalog = parseCatalogResponse({ grid: {}, visualizations: [], dimensions: [], templates: [], metrics: [{
      key: "crm.leads.converted.count", unit: "COUNT", shape: "SCALAR", dimensions: ["none"],
      timeModel: "EVENT", dateField: "CONVERTED_AT", accessResources: ["leads"],
    }] });
    expect(catalog.metrics[0]).toMatchObject({ timeModel: "EVENT", dateField: "CONVERTED_AT", accessResources: ["leads"] });
  });

  it("keeps an otherwise valid metric readable when semantic metadata is absent or unknown", () => {
    const metric = { unit: "COUNT", shape: "SCALAR", dimensions: ["none"] };
    const catalog = parseCatalogResponse({ grid: {}, visualizations: [], dimensions: [], templates: [], metrics: [
      { ...metric, key: "crm.older" },
      { ...metric, key: "crm.newer", timeModel: "FUTURE_MODEL", dateField: "FUTURE_DATE", accessResources: ["leads", "private_source"] },
      { ...metric, key: "crm.invalid_metadata", timeModel: { label: "EVENT" }, dateField: 2, accessResources: "leads" },
    ] });
    expect(catalog.metrics).toHaveLength(3);
    expect(catalog.metrics[0]).toMatchObject({ timeModel: "UNKNOWN", dateField: "UNKNOWN", accessResources: [] });
    expect(catalog.metrics[1]).toMatchObject({ timeModel: "UNKNOWN", dateField: "UNKNOWN", accessResources: ["leads"] });
    expect(catalog.metrics[2]).toMatchObject({ timeModel: "UNKNOWN", dateField: "UNKNOWN", accessResources: [] });
  });

  it("preserves compatibility and layout metadata needed by advanced authoring", () => {
    const catalog = parseCatalogResponse({ grid: {}, templates: [], dimensions: [],
      visualizations: [{ key: "COLUMN", shapes: ["CATEGORY"], minSeries: 1, maxSeries: 4, supportsDualAxis: true, supportsMixedUnits: false, minW: 4, minH: 4, defaultW: 6, defaultH: 6, maxW: 12, maxH: 10 }],
      metrics: [{ key: "crm.alerts", unit: "COUNT", shape: "ROWS", dimensions: ["record"], rowKind: "ALERT" }] });
    expect(catalog.visualizations[0]).toMatchObject({ supportsDualAxis: true, supportsMixedUnits: false, minW: 4, maxW: 12 });
    expect(catalog.metrics[0].rowKind).toBe("ALERT");
  });
  it("offers only active metrics for new widgets", () => {
    const metric = { unit: "COUNT", shape: "SCALAR", dimensions: ["none"] };
    const catalog = parseCatalogResponse({
      grid: {},
      visualizations: [],
      dimensions: [],
      templates: [],
      metrics: [
        { ...metric, key: "crm.leads.created.count", availability: "AVAILABLE" },
        { ...metric, key: "crm.calendar.utilization.minutes", availability: "RETIRED" },
      ],
    });
    expect(catalog.metrics.map(({ key }) => key)).toEqual(["crm.leads.created.count"]);
  });
});
