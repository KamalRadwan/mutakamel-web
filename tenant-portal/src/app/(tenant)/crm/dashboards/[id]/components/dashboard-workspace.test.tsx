// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PermissionGate } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { DashboardWorkspace } from "./dashboard-workspace";

const DICT_BY_LANG = { en, ar } as const;
const DASHBOARD_ID = "01900300-0000-7000-8000-000000000001";
const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", get: vi.fn(), post: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: {
    permissions: ["crm.dashboards.read.own"], accessibleBranches: [], isTenantOwner: false,
  } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: DICT_BY_LANG[state.lang], lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { get: state.get, post: state.post },
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => ({}),
}));
vi.mock("../hooks/useDashboardLayout", () => ({ useDashboardLayout: () => ({ canEdit: false }) }));
vi.mock("../hooks/useDashboardShares", () => ({ useDashboardShares: () => ({}) }));
vi.mock("../hooks/useAvailableWidgets", () => ({ useAvailableWidgets: () => ({}) }));
vi.mock("../hooks/useWidgetDrilldown", () => ({ useWidgetDrilldown: () => ({}) }));
vi.mock("../hooks/useDashboardSwitcher", () => ({
  useDashboardSwitcher: () => ({}),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("dashboard server access denial", () => {
  it.each(["en", "ar"] as const)("shows the forbidden state despite a scoped route grant in %s", async (lang) => {
    state.lang = lang;
    const t = DICT_BY_LANG[lang];
    const forbidden = new TenantApiClientError("request failed", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "CRM_DASHBOARD_DEFINITION_ACCESS_DENIED" },
    });
    state.get.mockRejectedValue(forbidden);
    state.post.mockRejectedValue(forbidden);

    render(<PermissionGate require="crm.dashboards.read" scoped>
      <DashboardWorkspace dashboardId={DASHBOARD_ID} />
    </PermissionGate>);

    expect(await screen.findByText(t.permissionGate.title)).toBeInTheDocument();
    expect(screen.getByText(t.permissionGate.description)).toBeInTheDocument();
    expect(state.get).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/dashboards/${DASHBOARD_ID}`, expect.any(Object),
    );
    expect(screen.queryByText(t.crmDashboards.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.crmDashboards.noWidgets)).not.toBeInTheDocument();
  });
});
