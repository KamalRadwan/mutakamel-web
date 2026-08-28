import { describe, expect, it } from "vitest";
import {
  TENANT_ROUTES,
  canAccessCrmRoute,
  getFirstPermittedCrmRoute,
  isSupportedCorePath,
  isSupportedCrmPath,
} from "./tenant-routes";

describe("Tenant Portal production route surface", () => {
  it("allows only the server-backed Core page", () => {
    expect(isSupportedCorePath(TENANT_ROUTES.coreSessions)).toBe(true);
    expect(isSupportedCorePath("/core/users")).toBe(false);
    expect(isSupportedCorePath("/core/provisioning-updates/job/general")).toBe(false);
  });

  it("allows the implemented CRM slices and one customer detail segment", () => {
    expect(isSupportedCrmPath(TENANT_ROUTES.crmLeads)).toBe(true);
    expect(isSupportedCrmPath("/crm/customer-profiles/customer-id")).toBe(true);
    expect(isSupportedCrmPath("/crm/customer-profiles/customer-id/general")).toBe(false);
    expect(isSupportedCrmPath("/crm/dashboard")).toBe(false);
    expect(isSupportedCrmPath("/crm/opportunities-stage-history")).toBe(false);
  });

  it("accepts both exact scoped-base permissions and their scoped variants", () => {
    expect(
      canAccessCrmRoute(
        ["crm.leads.read", "crm.lead_stages.read"],
        TENANT_ROUTES.crmLeads,
      ),
    ).toBe(true);
    expect(
      canAccessCrmRoute(
        ["crm.customer_profiles.read"],
        TENANT_ROUTES.crmCustomerProfiles,
      ),
    ).toBe(true);
    expect(
      canAccessCrmRoute(
        ["crm.opportunities.read", "crm.pipelines.read"],
        TENANT_ROUTES.crmOpportunities,
      ),
    ).toBe(true);
    expect(
      canAccessCrmRoute(
        ["crm.customer_profiles.read.team"],
        TENANT_ROUTES.crmCustomerProfiles,
      ),
    ).toBe(true);
    expect(
      canAccessCrmRoute(
        ["crm.opportunities.read.all", "crm.pipelines.read"],
        TENANT_ROUTES.crmOpportunities,
      ),
    ).toBe(true);
  });

  it("requires every read contract used by composite CRM pages", () => {
    expect(
      canAccessCrmRoute(["crm.leads.read.all"], TENANT_ROUTES.crmLeads),
    ).toBe(false);
    expect(
      canAccessCrmRoute(
        ["crm.lead_stages.read"],
        TENANT_ROUTES.crmLeads,
      ),
    ).toBe(false);
    expect(
      canAccessCrmRoute(
        ["crm.opportunities.read.team"],
        TENANT_ROUTES.crmOpportunities,
      ),
    ).toBe(false);
    expect(
      canAccessCrmRoute(["crm.pipelines.read"], TENANT_ROUTES.crmOpportunities),
    ).toBe(false);
  });

  it("rejects lookalike permissions and descendants of exact permissions", () => {
    expect(
      canAccessCrmRoute(["crm.leads.readonly"], TENANT_ROUTES.crmLeads),
    ).toBe(false);
    expect(
      canAccessCrmRoute(["crm.leads.read.evil"], TENANT_ROUTES.crmLeads),
    ).toBe(false);
    expect(
      canAccessCrmRoute(
        ["crm.lead_stages.read.team"],
        TENANT_ROUTES.crmLeadStages,
      ),
    ).toBe(false);
  });

  it("selects the first supported CRM route the user can read", () => {
    expect(
      getFirstPermittedCrmRoute([
        "crm.opportunities.read.team",
        "crm.customer_profiles.read",
      ]),
    ).toBe(TENANT_ROUTES.crmCustomerProfiles);
    expect(getFirstPermittedCrmRoute(["crm.settings.read"])).toBe(
      TENANT_ROUTES.crmStaticCatalogue,
    );
    expect(
      getFirstPermittedCrmRoute([
        "crm.leads.read.all",
        "crm.customer_profiles.read.team",
      ]),
    ).toBe(TENANT_ROUTES.crmCustomerProfiles);
    expect(
      getFirstPermittedCrmRoute([
        "crm.opportunities.read.all",
        "crm.settings.read",
      ]),
    ).toBe(TENANT_ROUTES.crmStaticCatalogue);
    expect(getFirstPermittedCrmRoute(["crm.activities.read.all"])).toBeNull();
  });
});
