import { describe, expect, it } from "vitest";
import { parseCatalogResponse } from "./dashboard-catalog-contract";
import { parseWidgetResult } from "./dashboard-run-contract";
import { localizeWidgetResult } from "./widget-labels";
const catalog = parseCatalogResponse({ grid: {}, visualizations: [], dimensions: [], templates: [], metrics: [
  { key: "crm.amount", labelEn: "Pipeline value", labelAr: "قيمة الفرص", unit: "MONEY", shape: "CATEGORY", dimensions: ["source"] },
] });
const result = (label: string) => parseWidgetResult({ widgetId: "preview", shape: "CATEGORY",
  series: [{ key: "crm.amount:EGP", label, unit: "MONEY", currency: "EGP", points: [{ key: "web", label: "Web", value: 42 }] }],
  meta: { unit: "MONEY", generatedAt: "2026-11-05T00:00:00Z", warnings: [] } });
describe("catalogue metric labels in executed widgets", () => {
  it("translates the known default and preserves currency and values", () => {
    const source = result("Pipeline value (EGP)");
    expect(localizeWidgetResult(source, catalog, "ar").series[0]).toMatchObject({ label: "قيمة الفرص (EGP)", currency: "EGP", points: source.series[0].points });
    expect(source.series[0].label).toBe("Pipeline value (EGP)");
  });
  it("preserves actual group names and user-authored labels", () => {
    expect(localizeWidgetResult(result("Cairo team"), catalog, "ar").series[0].label).toBe("Cairo team");
    expect(localizeWidgetResult(result("Pipeline value (Cairo)"), catalog, "ar").series[0].label).toBe("Pipeline value (Cairo)");
    expect(localizeWidgetResult(result("Pipeline value"), catalog, "ar", { series: [{ metricKey: "crm.amount", label: "Pipeline value" }] }).series[0].label).toBe("Pipeline value");
  });
  it("localizes a source bucket only when the executor provides the Arabic label", () => {
    const source = result("Pipeline value");
    source.series[0].points[0].meta.labelAr = "الموقع";
    expect(localizeWidgetResult(source, catalog, "ar").series[0].points[0]).toMatchObject({
      key: "web", label: "الموقع", value: 42,
    });
    expect(localizeWidgetResult(source, catalog, "en").series[0].points[0].label).toBe("Web");
  });
  it("localizes a runtime outcome series using the matching bilingual receipt labels", () => {
    const source = result("Converted");
    source.series[0].points[0].meta = { seriesLabel: "Converted", seriesLabelAr: "تحوّل" };
    expect(localizeWidgetResult(source, catalog, "ar").series[0].label).toBe("تحوّل");
    expect(localizeWidgetResult(source, catalog, "en").series[0].label).toBe("Converted");
    expect(localizeWidgetResult(source, catalog, "ar", { series: [{ metricKey: "crm.amount", label: "Converted" }] }).series[0].label).toBe("Converted");
  });
});
