// @vitest-environment jsdom
//
// The five states no parser test can reach, on one CRM analytics screen.
//
// 13.24 measured the gap this closes: 131 screens, 2 of them ever rendered in
// a test. Every phase claimed the eleven-state checklist passed "by
// construction", which is how `widgetToForm` was called with no guard on
// series count for an entire phase without anything noticing — see D23. A
// contract test proves a parser; only a render proves a screen.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const WIDGET_ID = "01900300-0000-7000-8000-0000000000a1";

const state = vi.hoisted(() => ({
  user: null as unknown,
  get: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));

// The real English dictionary, so a missing key fails the test rather than
// rendering as empty text.
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

// Only the transport is replaced. `TenantApiClientError` stays real, because
// `normalizeApiError` narrows on `instanceof` — a stubbed class would make
// every failure look like an unknown error and the 403 state unreachable.
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: {
    get: (...args: unknown[]) => state.get(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const { TenantApiClientError } = await import("@/lib/api/axiosClient");
const { WidgetDetailWorkspace } = await import("./widget-detail-workspace");

function tenantUser(permissions: string[]) {
  return {
    accessibleBranches: ["01900100-0000-7000-8000-000000000099"],
    accessibleCompanies: ["01900100-0000-7000-8000-000000000001"],
    teamMemberships: [],
    permissions,
    isTenantOwner: false,
  };
}

/** A `GET /widgets/:id` body, shaped exactly as `detail()` returns it. */
function widget(overrides: Record<string, unknown> = {}) {
  return {
    id: WIDGET_ID,
    ownerUserId: "01900100-0000-7000-8000-000000000002",
    ownerName: "Sara Nour",
    name: "New leads",
    visualizationType: "METRIC_CARD",
    querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
    displaySpec: {},
    schemaVersion: 1,
    revision: 3,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-30T09:00:00.000Z",
    accessLevel: "OWNER",
    isShared: false,
    ...overrides,
  };
}

/** `TRENDS_COMPARISONS`'s real two-series widget — D23's exact shape. */
const twoSeriesSpec = {
  series: [
    { metricKey: "crm.opportunities.created.count.trend", axis: "LEFT", label: "Opportunity count" },
    { metricKey: "crm.opportunities.created.estimated_value.trend", axis: "RIGHT", label: "Estimated value" },
  ],
  dimension: { key: "time", grain: "DAY" },
  filters: { compare: "NONE" },
};

/**
 * Routes the two GETs the screen makes. The catalogue is answered with a
 * rejection on purpose in most cases: the screen is specified to degrade to
 * "catalogue unavailable" rather than fail, and nothing here depends on it.
 */
function respond(detail: () => Promise<unknown>) {
  state.get.mockImplementation((path: string) => {
    if (path.includes("/dashboards/catalog")) return Promise.reject(new Error("no catalogue"));
    if (path.includes("/widgets/")) return detail();
    return Promise.resolve({ data: [] });
  });
}

function apiError(status: number, errorCode: string) {
  return new TenantApiClientError("request failed", {
    status,
    statusText: "",
    headers: new Headers(),
    data: { errorCode },
  });
}

beforeEach(() => {
  state.user = tenantUser(["crm.widgets.read", "crm.widgets.update", "crm.dashboards.read.all"]);
  respond(() => Promise.resolve({ data: widget() }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Widget detail · the states no contract test reaches", () => {
  it("renders the loading state before the widget arrives, and no widget chrome", () => {
    // A promise that never settles is the honest fixture for "still loading".
    respond(() => new Promise(() => {}));
    const { container } = render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    // The shimmer is the design system's one permitted loading affordance
    // (docs/design/motion.md#shimmer), so its presence is the state.
    const shimmers = [...container.querySelectorAll("div")].filter((node) =>
      node.className.includes("animate-[shimmer"),
    );
    expect(shimmers.length).toBeGreaterThan(0);
    expect(screen.queryByText(en.crmWidgets.definition)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmWidgets.edit })).not.toBeInTheDocument();
    // Loading is not "nothing found" and not "not allowed".
    expect(screen.queryByText(en.crmWidgets.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(en.permissionGate.title)).not.toBeInTheDocument();
  });

  it("renders the permission gate on a 403, never an empty or not-found state", async () => {
    respond(() => Promise.reject(apiError(403, "CRM_PERMISSION_DENIED")));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.permissionGate.title);
    expect(screen.getByText(en.permissionGate.description)).toBeInTheDocument();
    // S7: a 403 says "not yours", and must not be confused with "not there".
    expect(screen.queryByText(en.crmWidgets.notFoundTitle)).not.toBeInTheDocument();
  });

  it("renders the not-found state with a way back when the widget is gone", async () => {
    respond(() => Promise.reject(apiError(404, "CRM_WIDGET_NOT_FOUND")));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.notFoundTitle);
    expect(screen.getByRole("link", { name: en.crmWidgets.backToList })).toHaveAttribute(
      "href",
      "/crm/widgets",
    );
  });

  it("renders read-only for a VIEW grant — the widget, without the editor", async () => {
    respond(() => Promise.resolve({ data: widget({ accessLevel: "VIEW" }) }));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.definition);
    expect(screen.queryByRole("button", { name: en.crmWidgets.edit })).not.toBeInTheDocument();
    // A viewer is not told the widget is unsafe to edit; they simply cannot.
    expect(screen.queryByText(en.crmWidgets.notEditableTitle)).not.toBeInTheDocument();
  });

  it("renders read-only when the actor has EDIT access but not the update permission", async () => {
    state.user = tenantUser(["crm.widgets.read"]);
    respond(() => Promise.resolve({ data: widget({ accessLevel: "EDIT" }) }));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.definition);
    expect(screen.queryByRole("button", { name: en.crmWidgets.edit })).not.toBeInTheDocument();
  });

  it("offers the editor for a widget the single-metric form can represent", async () => {
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    expect(await screen.findByRole("button", { name: en.crmWidgets.edit })).toBeInTheDocument();
    expect(screen.queryByText(en.crmWidgets.notEditableTitle)).not.toBeInTheDocument();
  });
});

describe("Widget detail · D23, the editor is withheld rather than allowed to narrow a spec", () => {
  it("withholds the editor for a two-series widget and says which parts it cannot show", async () => {
    respond(() => Promise.resolve({ data: widget({ visualizationType: "LINE_AREA", querySpec: twoSeriesSpec }) }));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.notEditableTitle);
    // Before the guard, this button opened a form that dropped series 2, the
    // per-series axes and labels, and the stored filters, on save.
    expect(screen.queryByRole("button", { name: en.crmWidgets.edit })).not.toBeInTheDocument();

    expect(screen.getByText(en.crmWidgets.notEditableReasons.MULTI_SERIES)).toBeInTheDocument();
    expect(screen.getByText(en.crmWidgets.notEditableReasons.SERIES_STYLING)).toBeInTheDocument();
    expect(screen.getByText(en.crmWidgets.notEditableReasons.FILTERS)).toBeInTheDocument();
  });

  it("still shows the widget itself, both metrics included — withheld editing is not a dead end", async () => {
    respond(() => Promise.resolve({ data: widget({ visualizationType: "LINE_AREA", querySpec: twoSeriesSpec }) }));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.definition);
    await waitFor(() => {
      expect(
        screen.getByText(
          "crm.opportunities.created.count.trend, crm.opportunities.created.estimated_value.trend",
        ),
      ).toBeInTheDocument();
    });
  });

  it("withholds the editor for a SEMANTIC_V1 widget, which the form would demote to LEGACY_V1", async () => {
    respond(() =>
      Promise.resolve({
        data: widget({
          visualizationType: "BAR",
          querySpec: {
            engine: "SEMANTIC_V1",
            semanticVersion: 1,
            source: "leads",
            series: [{ metricKey: "crm.leads.by_source.count" }],
            dimension: { key: "source" },
            topN: 5,
          },
          schemaVersion: 2,
        }),
      }),
    );
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.notEditableTitle);
    expect(screen.getByText(en.crmWidgets.notEditableReasons.SEMANTIC_ENGINE)).toBeInTheDocument();
    expect(screen.getByText(en.crmWidgets.notEditableReasons.RESULT_LIMITS)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.crmWidgets.edit })).not.toBeInTheDocument();
  });

  it("does not show the read-only explanation to someone who could not edit anyway", async () => {
    state.user = tenantUser(["crm.widgets.read"]);
    respond(() => Promise.resolve({ data: widget({ visualizationType: "LINE_AREA", querySpec: twoSeriesSpec }) }));
    render(<WidgetDetailWorkspace widgetId={WIDGET_ID} />);

    await screen.findByText(en.crmWidgets.definition);
    expect(screen.queryByText(en.crmWidgets.notEditableTitle)).not.toBeInTheDocument();
  });
});
