import { describe, expect, it } from "vitest";
import {
  canAccessCrmRoute,
  getFirstPermittedCrmRoute,
  isSupportedCrmPath,
  TENANT_ROUTES,
} from "@/lib/navigation/tenant-routes";
import { NAV_SECTIONS } from "@/design-system";

// A screen that is built but not admitted loads for nobody: the proxy sends
// the browser to /unavailable before the page runs, and the sidebar never
// links it. Six CRM detail screens shipped that way (DEFECTS.md D22,
// OPEN-QUESTIONS.md Q40). Nothing in `pnpm verify` connects the route to its
// admission, so this suite does.

const DASHBOARD_ID = "01900300-0000-7000-8000-000000000001";

describe("Phase 9 route admission", () => {
  it("admits every screen this phase builds", () => {
    expect(isSupportedCrmPath(TENANT_ROUTES.crmDashboards)).toBe(true);
    expect(isSupportedCrmPath(TENANT_ROUTES.crmDashboardReports)).toBe(true);
    expect(isSupportedCrmPath(TENANT_ROUTES.crmWidgets)).toBe(true);
    expect(isSupportedCrmPath(`${TENANT_ROUTES.crmDashboards}/${DASHBOARD_ID}`)).toBe(true);
    expect(isSupportedCrmPath(`${TENANT_ROUTES.crmWidgets}/${DASHBOARD_ID}`)).toBe(true);
  });

  it("still refuses a second segment below a detail screen", () => {
    expect(isSupportedCrmPath(`${TENANT_ROUTES.crmDashboards}/${DASHBOARD_ID}/widgets`)).toBe(false);
    expect(isSupportedCrmPath("/crm/dashboard")).toBe(false);
  });

  it("accepts the scoped dashboards grant, which is the only form the tenant seeds", () => {
    // `crm.dashboards.read` is in CRM_SCOPED_PERMISSION_BASES, so the seeded
    // keys are `.own`/`.team`/`.all` — matching the bare key would admit
    // nobody.
    for (const scope of ["own", "team", "all"]) {
      expect(
        canAccessCrmRoute([`crm.dashboards.read.${scope}`], TENANT_ROUTES.crmDashboards),
      ).toBe(true);
    }
    expect(canAccessCrmRoute([], TENANT_ROUTES.crmDashboards)).toBe(false);
  });

  it("requires the exact widgets grant — `widgets` is not a scoped CRM resource", () => {
    expect(canAccessCrmRoute(["crm.widgets.read"], TENANT_ROUTES.crmWidgets)).toBe(true);
    expect(canAccessCrmRoute(["crm.widgets.read.all"], TENANT_ROUTES.crmWidgets)).toBe(false);
    expect(canAccessCrmRoute(["crm.dashboards.read.all"], TENANT_ROUTES.crmWidgets)).toBe(false);
  });

  it("lands a records-holder on their records, not on a dashboard", () => {
    expect(
      getFirstPermittedCrmRoute(["crm.leads.read.own", "crm.lead_stages.read", "crm.dashboards.read.all"]),
    ).toBe(TENANT_ROUTES.crmLeads);
  });

  it("lands a dashboards-only actor on the dashboards list, ahead of configuration", () => {
    expect(getFirstPermittedCrmRoute(["crm.dashboards.read.team", "crm.pipelines.read"])).toBe(
      TENANT_ROUTES.crmDashboards,
    );
  });

  it("puts all three screens in one sidebar section, gated the same way", () => {
    const section = NAV_SECTIONS.find((candidate) => candidate.id === "crmAnalytics");
    expect(section?.items.map((item) => item.href)).toEqual([
      TENANT_ROUTES.crmDashboards,
      TENANT_ROUTES.crmDashboardReports,
      TENANT_ROUTES.crmWidgets,
    ]);
    const permissions = ["crm.dashboards.read.own"];
    expect(section?.items.filter((item) => item.hasAccess(permissions))).toHaveLength(2);
  });
});
