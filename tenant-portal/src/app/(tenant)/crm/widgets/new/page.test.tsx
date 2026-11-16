// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { DashboardCatalog, WidgetRecipe } from "../../dashboards/dashboard-catalog-contract";
import NewWidgetPage from "./page";

const mocks = vi.hoisted(() => ({ lang: "en" as "en" | "ar", state: vi.fn(), create: vi.fn(), preview: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: mocks.lang === "ar" ? ar : en, lang: mocks.lang, dir: mocks.lang === "ar" ? "rtl" : "ltr" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/design-system", async original => ({ ...await original<typeof import("@/design-system")>(),
  PermissionGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../hooks/useWidgetCreatePage", () => ({ useWidgetCreatePage: mocks.state }));
vi.mock("../hooks/useWidgetPreview", () => ({ useWidgetPreview: () => ({ result: null, error: null, busy: false, run: mocks.preview }) }));

const recipe: WidgetRecipe = { key: "converted-leads", family: "LEADS", nameAr: "العملاء المحولون", nameEn: "Converted leads",
  descriptionAr: "كم عميلًا محتملًا تم تحويله؟", descriptionEn: "How many leads converted?", visualizationType: "METRIC_CARD",
  querySpec: { series: [{ metricKey: "crm.leads.converted.count" }], dimension: { key: "none" } }, displaySpec: {}, sourceResources: ["leads"] };
const catalog: DashboardCatalog = { gridColumns: 12, maxWidgets: 20, templates: [], widgetRecipes: [recipe], dimensions: [{ key: "none", grains: [] }],
  visualizations: [{ key: "METRIC_CARD", shapes: ["SCALAR"], minSeries: 1, maxSeries: 1, requiresTarget: false, supportsPeriodComparison: true }],
  metrics: [{ key: recipe.querySpec.series[0].metricKey, nameEn: recipe.nameEn, nameAr: recipe.nameAr, unit: "COUNT", shape: "SCALAR",
    dimensions: ["none"], supportsPeriodComparison: true }] };

function setup(config: Record<string, unknown> = {}) {
  const review = vi.fn();
  mocks.state.mockReturnValue({ cancel: vi.fn(), create: mocks.create, list: { scope: "actor", catalog, canCreate: true, canPreview: false,
    hasLoaded: true, reload: vi.fn(), review, ...config } });
  render(<NewWidgetPage />);
  return review;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.lang = "en"; });

describe("widget starter gallery", () => {
  it.each(["en", "ar"] as const)("prefills the real builder and saves only on explicit action in %s", lang => {
    mocks.lang = lang;
    const t = lang === "ar" ? ar : en;
    const name = lang === "ar" ? recipe.nameAr : recipe.nameEn;
    setup();
    const card = screen.getByRole("article", { name });
    expect(within(card).getByText(t.crmWidgets.recipes.previewAccess)).toBeVisible();
    fireEvent.click(within(card).getByRole("button", { name: t.crmWidgets.recipes.use }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    const input = screen.getByDisplayValue(name);
    fireEvent.change(input, { target: { value: "Quarterly converted leads" } });
    fireEvent.click(screen.getByRole("button", { name: t.crmWidgets.lifecycle.saveDraft }));
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: "Quarterly converted leads",
      visualizationType: "METRIC_CARD", series: [expect.objectContaining({ metricKey: "crm.leads.converted.count" })] }));
  });

  it("supports the blank path with an older catalogue", () => {
    setup({ catalog: { ...catalog, widgetRecipes: undefined } });
    expect(screen.getByText(en.crmWidgets.recipes.noRecipes)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en.crmWidgets.recipes.blank }));
    expect(screen.getByRole("heading", { name: en.crmWidgets.createTitle })).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("combines category and search without invoking a widget request", () => {
    setup();
    const copy = en.crmWidgets.recipes;
    fireEvent.click(screen.getByRole("button", { name: copy.families.PIPELINE }));
    expect(screen.getByText(copy.noMatches)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: copy.families.LEADS }));
    fireEvent.change(screen.getByRole("textbox", { name: copy.search }), { target: { value: "unmatched" } });
    expect(screen.getByText(copy.noMatches)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: copy.search }), { target: { value: "converted" } });
    expect(screen.getByRole("article", { name: recipe.nameEn })).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("keeps write reconciliation available before a template is selected", () => {
    const review = setup({ blocked: true, needsReview: true, reviewReady: true });
    expect(screen.getByRole("button", { name: en.crmWidgets.recipes.use })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en.crmDashboards.review.acknowledge }));
    expect(review).toHaveBeenCalledTimes(1);
  });
});
