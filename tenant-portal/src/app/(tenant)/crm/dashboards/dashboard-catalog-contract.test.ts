import { describe, expect, it } from "vitest";
import { parseCatalogResponse } from "./dashboard-catalog-contract";

describe("Dashboard metric availability", () => {
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
