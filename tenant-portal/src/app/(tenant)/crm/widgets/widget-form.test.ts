import { describe, expect, it } from "vitest";
import type { DashboardCatalog } from "../dashboards/dashboard-catalog-contract";
import type { WidgetQuerySpec } from "../dashboards/widget-contract";
import {
  EMPTY_WIDGET_FORM,
  buildQuerySpec,
  buildWidgetUpdate,
  buildableVisualizations,
  isSpecEditable,
  metricsFor,
  validateWidgetForm,
  widgetSpecLimitations,
  widgetToForm,
  type WidgetFormState,
} from "./widget-form";

const catalog: DashboardCatalog = {
  gridColumns: 12,
  maxWidgets: 20,
  visualizations: [
    {
      key: "METRIC_CARD",
      shapes: ["SCALAR"],
      minSeries: 1,
      maxSeries: 1,
      requiresTarget: false,
      supportsPeriodComparison: true,
    },
    {
      key: "SEMI_CIRCLE_GAUGE",
      shapes: ["SCALAR"],
      minSeries: 1,
      maxSeries: 1,
      requiresTarget: true,
      supportsPeriodComparison: false,
    },
    {
      key: "LINE",
      shapes: ["TIME_SERIES", "CATEGORY"],
      minSeries: 1,
      maxSeries: 4,
      requiresTarget: false,
      supportsPeriodComparison: true,
    },
    {
      key: "MULTI_KPI",
      shapes: ["SCALAR"],
      minSeries: 2,
      maxSeries: 4,
      requiresTarget: false,
      supportsPeriodComparison: false,
    },
  ],
  metrics: [
    {
      key: "crm.leads.created.count",
      nameAr: "العملاء المحتملون الجدد",
      nameEn: "New leads",
      unit: "COUNT",
      shape: "SCALAR",
      dimensions: ["none"],
      supportsPeriodComparison: true,
    },
    {
      key: "crm.opportunities.open.count",
      nameAr: "الفرص المفتوحة",
      nameEn: "Open opportunities",
      unit: "COUNT",
      shape: "SCALAR",
      dimensions: ["none"],
      supportsPeriodComparison: false,
    },
    {
      key: "crm.leads.created.trend",
      nameAr: "اتجاه العملاء المحتملين",
      nameEn: "Leads trend",
      unit: "COUNT",
      shape: "TIME_SERIES",
      dimensions: ["time"],
      supportsPeriodComparison: true,
    },
  ],
  dimensions: [
    { key: "none", grains: [] },
    { key: "time", grains: ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"] },
  ],
  templates: [],
};

const form = (overrides: Partial<WidgetFormState> = {}): WidgetFormState => ({
  ...EMPTY_WIDGET_FORM,
  name: "New leads",
  visualizationType: "METRIC_CARD",
  metricKey: "crm.leads.created.count",
  dimensionKey: "none",
  ...overrides,
});

describe("Widget form", () => {
  it("offers only the visualizations a one-metric form can satisfy", () => {
    const offered = buildableVisualizations(catalog).map((capability) => capability.key);
    expect(offered).toContain("METRIC_CARD");
    // MULTI_KPI needs two series; every submission would be a 422.
    expect(offered).not.toContain("MULTI_KPI");
  });

  it("filters metrics by the shapes the chosen visualization accepts", () => {
    const forLine = metricsFor(catalog, catalog.visualizations[2]).map((metric) => metric.key);
    expect(forLine).toEqual(["crm.leads.created.trend"]);
  });

  it("refuses a dimension the metric does not declare", () => {
    expect(validateWidgetForm(form(), catalog)).toBeNull();
    expect(validateWidgetForm(form({ dimensionKey: "time" }), catalog)).toBe("DIMENSION_REQUIRED");
  });

  it("requires a positive target where the visualization requires one", () => {
    expect(
      validateWidgetForm(form({ visualizationType: "SEMI_CIRCLE_GAUGE" }), catalog),
    ).toBe("TARGET_REQUIRED");
    expect(
      validateWidgetForm(
        form({ visualizationType: "SEMI_CIRCLE_GAUGE", comparison: "TARGET", target: "0" }),
        catalog,
      ),
    ).toBe("TARGET_INVALID");
    expect(
      validateWidgetForm(
        form({ visualizationType: "SEMI_CIRCLE_GAUGE", comparison: "TARGET", target: "25" }),
        catalog,
      ),
    ).toBeNull();
  });

  it("refuses a period comparison on a snapshot metric", () => {
    expect(
      validateWidgetForm(
        form({ metricKey: "crm.opportunities.open.count", comparison: "PREVIOUS_PERIOD" }),
        catalog,
      ),
    ).toBe("COMPARISON_UNSUPPORTED");
  });

  it("sends a grain with a time dimension and none without one", () => {
    expect(
      buildQuerySpec(
        form({
          visualizationType: "LINE",
          metricKey: "crm.leads.created.trend",
          dimensionKey: "time",
          grain: "WEEK",
        }),
      ),
    ).toEqual({
      series: [{ metricKey: "crm.leads.created.trend" }],
      dimension: { key: "time", grain: "WEEK" },
    });
    expect(buildQuerySpec(form())).toEqual({
      series: [{ metricKey: "crm.leads.created.count" }],
      dimension: { key: "none" },
    });
  });

  it("never sends a semantic-engine field without the engine", () => {
    const spec = buildQuerySpec(form()) as unknown as Record<string, unknown>;
    for (const key of ["engine", "semanticVersion", "source", "semanticFilters", "topN", "maxPoints"]) {
      expect(spec[key]).toBeUndefined();
    }
  });

  it("round-trips a stored widget back into the form", () => {
    expect(
      widgetToForm({
        name: "Win rate",
        visualizationType: "SEMI_CIRCLE_GAUGE",
        querySpec: {
          series: [{ metricKey: "crm.opportunities.win.rate" }],
          dimension: { key: "none" },
          comparison: { type: "TARGET", target: 35 },
        },
      }),
    ).toEqual({
      name: "Win rate",
      visualizationType: "SEMI_CIRCLE_GAUGE",
      metricKey: "crm.opportunities.win.rate",
      dimensionKey: "none",
      grain: "DAY",
      comparison: "TARGET",
      target: "35",
    });
  });
});

/**
 * D23 — editing a widget's name must not destroy its query spec.
 *
 * The fixture is `TRENDS_COMPARISONS`'s "Count & Estimated Value" widget,
 * copied from `CRM_DASHBOARD_TEMPLATES` in crm-app's `dashboard-catalog.ts`
 * rather than invented. It matters that this is a real shipped widget: its
 * `LINE_AREA` type declares `minSeries: 1`, so the picker offers it and the
 * editor opened it with nothing to warn the user that the form models one
 * series and the widget has two.
 */
const twoSeriesWidget = {
  name: "Count & Estimated Value",
  visualizationType: "LINE_AREA",
  querySpec: {
    series: [
      { metricKey: "crm.opportunities.created.count.trend", axis: "LEFT", label: "Opportunity count" },
      { metricKey: "crm.opportunities.created.estimated_value.trend", axis: "RIGHT", label: "Estimated value" },
    ],
    dimension: { key: "time", grain: "DAY" },
    filters: { compare: "NONE" },
  },
} as const satisfies { name: string; visualizationType: "LINE_AREA"; querySpec: WidgetQuerySpec };

const semanticWidget = {
  name: "Top lead sources",
  visualizationType: "BAR",
  querySpec: {
    engine: "SEMANTIC_V1",
    semanticVersion: 1,
    source: "leads",
    semanticFilters: [{ field: "status", operator: "IN", values: ["NEW", "QUALIFIED"] }],
    series: [{ metricKey: "crm.leads.by_source.count" }],
    dimension: { key: "source" },
    topN: 5,
  },
} as const satisfies { name: string; visualizationType: "BAR"; querySpec: WidgetQuerySpec };

const plainWidget = {
  name: "New leads",
  visualizationType: "METRIC_CARD",
  querySpec: {
    series: [{ metricKey: "crm.leads.created.count" }],
    dimension: { key: "none" },
  },
} as const satisfies { name: string; visualizationType: "METRIC_CARD"; querySpec: WidgetQuerySpec };

describe("D23 · a widget update never narrows a spec the form does not model", () => {
  it("names every part of a stored spec the single-series form cannot represent", () => {
    expect(widgetSpecLimitations(twoSeriesWidget.querySpec).sort()).toEqual([
      "FILTERS",
      "MULTI_SERIES",
      "SERIES_STYLING",
    ]);
    expect(widgetSpecLimitations(semanticWidget.querySpec).sort()).toEqual([
      "RESULT_LIMITS",
      "SEMANTIC_ENGINE",
    ]);
    expect(widgetSpecLimitations(plainWidget.querySpec)).toEqual([]);
  });

  it("refuses to open the editor for a spec it cannot represent", () => {
    // widget-detail-workspace.tsx gates on this. Before it existed, the editor
    // opened for both of these and saving collapsed them.
    expect(isSpecEditable(twoSeriesWidget.querySpec)).toBe(false);
    expect(isSpecEditable(semanticWidget.querySpec)).toBe(false);
    expect(isSpecEditable(plainWidget.querySpec)).toBe(true);
  });

  it("omits querySpec entirely when only the name changed", () => {
    // The whole defect in one assertion. `PATCH /widgets/:id` replaces
    // querySpec wholesale, so the only safe rename is one that does not send
    // it at all — see docs/api/crm-dashboards.md.
    const update = buildWidgetUpdate(
      { ...widgetToForm(twoSeriesWidget), name: "Renamed" },
      twoSeriesWidget,
    );
    expect(update.name).toBe("Renamed");
    expect(update.visualizationType).toBe("LINE_AREA");
    expect(update).not.toHaveProperty("querySpec");
  });

  it("preserves both series and the filters of a two-series widget across a rename", () => {
    const update = buildWidgetUpdate(
      { ...widgetToForm(twoSeriesWidget), name: "Renamed" },
      twoSeriesWidget,
    );
    // Nothing is sent, so the server keeps what it stored. Asserted against the
    // fixture so a future change that starts sending a rebuilt spec fails here.
    expect(update.querySpec).toBeUndefined();
    expect(twoSeriesWidget.querySpec.series).toHaveLength(2);
    expect(twoSeriesWidget.querySpec.filters).toEqual({ compare: "NONE" });
  });

  it("omits querySpec on a rename even for a widget the form fully models", () => {
    // Not only the unsafe case: a rename is a rename. This also keeps a stored
    // `comparison: { type: "NONE" }` from being silently dropped, which
    // buildQuerySpec would do.
    const update = buildWidgetUpdate({ ...widgetToForm(plainWidget), name: "Renamed" }, plainWidget);
    expect(update).not.toHaveProperty("querySpec");
  });

  it("sends the rebuilt spec when the user actually edited the query", () => {
    const update = buildWidgetUpdate(
      { ...widgetToForm(plainWidget), metricKey: "crm.opportunities.open.count" },
      plainWidget,
    );
    expect(update.querySpec).toEqual({
      series: [{ metricKey: "crm.opportunities.open.count" }],
      dimension: { key: "none" },
    });
  });

  it("documents why the guard is needed: rebuilding a two-series spec is lossy", () => {
    // Not a guard — the record of what the editor used to send. buildQuerySpec
    // is unchanged and still narrows; it is simply no longer reachable for a
    // spec like this one.
    const rebuilt = buildQuerySpec(widgetToForm(twoSeriesWidget));
    expect(rebuilt.series).toHaveLength(1);
    expect(rebuilt.series[0]).toEqual({ metricKey: "crm.opportunities.created.count.trend" });
    expect(rebuilt.filters).toBeUndefined();
  });
});
