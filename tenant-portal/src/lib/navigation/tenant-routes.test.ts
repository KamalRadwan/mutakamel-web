import { describe, expect, it } from "vitest";
import {
  TENANT_ROUTES,
  canAccessCoreRoute,
  canAccessCrmRoute,
  getFirstPermittedCrmRoute,
  canAccessCoreOwnerRoute,
  isSupportedCorePath,
  isSupportedCrmPath,
  permittedCoreSettingsRoutes,
  canAccessTradeFoundationRoute,
  isSupportedTradePath,
  permittedTradeFoundationRoutes,
} from "./tenant-routes";

describe("Tenant Portal production route surface", () => {
  it("allows only the server-backed Core pages", () => {
    expect(isSupportedCorePath(TENANT_ROUTES.coreSessions)).toBe(true);
    expect(isSupportedCorePath(TENANT_ROUTES.coreTemplates)).toBe(true);
    expect(isSupportedCorePath(TENANT_ROUTES.coreBilling)).toBe(true);
    expect(isSupportedCorePath("/core/provisioning-updates/job/general")).toBe(false);
  });

  it("keeps WebPhone settings reachable regardless of subscription", () => {
    // The screen renders disabled for an unsubscribed workspace, so redirecting
    // it away would hide the capability instead of explaining it.
    expect(isSupportedCorePath(TENANT_ROUTES.coreWebphoneSettings)).toBe(true);
    // `/core/settings` is a built page and has always been admitted. This line
    // asserted `false` because it was written against the merge's truncated
    // duplicate of `CORE_EXACT_PATHS`, which held only three entries; the real
    // set has carried `coreSettings` since before the merge. Asserting `false`
    // here would mean `proxy.ts` redirects the whole Core settings landing page
    // to `/unavailable`.
    expect(isSupportedCorePath("/core/settings")).toBe(true);
    // The WebPhone admission is exact, not a prefix — a deeper path is still out.
    expect(isSupportedCorePath("/core/settings/webphone/extra")).toBe(false);
  });

  it("allows the implemented CRM slices and one customer detail segment", () => {
    expect(isSupportedCrmPath(TENANT_ROUTES.crmLeads)).toBe(true);
    expect(isSupportedCrmPath("/crm/customer-profiles/customer-id")).toBe(true);
    expect(isSupportedCrmPath("/crm/customer-profiles/customer-id/general")).toBe(false);
    expect(isSupportedCrmPath("/crm/dashboard")).toBe(false);
    // Q40: these five screens existed and were redirected to /unavailable
    // because only customer-profiles was admitted here.
    expect(isSupportedCrmPath("/crm/leads/lead-id")).toBe(true);
    expect(isSupportedCrmPath("/crm/opportunities/opportunity-id")).toBe(true);
    expect(isSupportedCrmPath("/crm/pipelines/pipeline-id")).toBe(true);
    expect(isSupportedCrmPath("/crm/opportunity-stages/stage-id")).toBe(true);
    expect(isSupportedCrmPath("/crm/outbound-emails/email-id")).toBe(true);
    // Still one segment deep, and still nothing that has no [id] route.
    expect(isSupportedCrmPath("/crm/leads/lead-id/notes")).toBe(false);
    expect(isSupportedCrmPath("/crm/tasks/task-id")).toBe(false);
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
    // Was null until 2026-08-31, when Phase 8B's activities, tasks, calendar,
    // reminders and outbound-email screens were linked. An actor who can read
    // activities now has somewhere to land instead of being told they have no
    // CRM access at all.
    expect(getFirstPermittedCrmRoute(["crm.activities.read.all"])).toBe(
      TENANT_ROUTES.crmActivities,
    );
    // Ordering here decides where a user LANDS, so it is behaviour. The first
    // attempt put these seven ahead of leads, which would have dropped a
    // pipeline manager onto a configuration screen instead of their records.
    expect(
      getFirstPermittedCrmRoute([
        "crm.pipelines.manage",
        "crm.leads.read.all",
        "crm.lead_stages.read",
      ]),
    ).toBe(TENANT_ROUTES.crmLeads);
  });
});

describe("Core settings route surface", () => {
  it("admits every Core settings screen and one notification detail segment", () => {
    for (const href of [
      TENANT_ROUTES.coreSettings,
      TENANT_ROUTES.coreSettingsWorkspace,
      TENANT_ROUTES.coreSettingsCurrencies,
      TENANT_ROUTES.coreSettingsTaxes,
      TENANT_ROUTES.coreSettingsNumbering,
      TENANT_ROUTES.coreSettingsEmail,
      TENANT_ROUTES.coreNotifications,
    ]) {
      expect(isSupportedCorePath(href)).toBe(true);
    }
    expect(isSupportedCorePath("/core/notifications/0199f2b0-1111-4222-8333-444455556666")).toBe(
      true,
    );
    expect(isSupportedCorePath("/core/notifications/an-id/extra")).toBe(false);
    expect(isSupportedCorePath(TENANT_ROUTES.coreSettingsBranding)).toBe(true);
  });

  it("admits the three owner-only billing screens and one invoice detail segment", () => {
    for (const href of [
      TENANT_ROUTES.coreBilling,
      TENANT_ROUTES.coreBillingInvoices,
      TENANT_ROUTES.coreSubscription,
    ]) {
      expect(isSupportedCorePath(href)).toBe(true);
    }
    expect(
      isSupportedCorePath("/core/billing/invoices/0199f2b0-1111-4222-8333-444455556666"),
    ).toBe(true);
    expect(isSupportedCorePath("/core/billing/invoices/an-id/lines")).toBe(false);
    expect(isSupportedCorePath("/core/subscription/plan")).toBe(false);
    expect(isSupportedCorePath("/core/billing/payments")).toBe(false);
  });

  it("gates billing and subscription on ownership, never on a permission string", () => {
    // TenantBillingController and SubscriptionSelfServeController declare no
    // @RequirePermissions at all, so no permission set can open them and no
    // permission set can close them — only `is_tenant_owner` decides.
    expect(canAccessCoreOwnerRoute(true)).toBe(true);
    expect(canAccessCoreOwnerRoute(false)).toBe(false);
  });

  it("admits every Core identity screen and exactly one detail segment below it", () => {
    for (const href of [
      TENANT_ROUTES.coreProfile,
      TENANT_ROUTES.coreOrganization,
      TENANT_ROUTES.coreCompanies,
      TENANT_ROUTES.coreBranches,
      TENANT_ROUTES.coreDepartments,
      TENANT_ROUTES.coreTeams,
      TENANT_ROUTES.coreUsers,
      TENANT_ROUTES.coreRoles,
    ]) {
      expect(isSupportedCorePath(href)).toBe(true);
      expect(isSupportedCorePath(`${href}/0199f2b0-1111-4222-8333-444455556666`)).toBe(
        href !== TENANT_ROUTES.coreProfile && href !== TENANT_ROUTES.coreOrganization,
      );
    }
    expect(isSupportedCorePath("/core/users/an-id/roles")).toBe(false);
    expect(isSupportedCorePath("/core/organization/tree")).toBe(false);
  });

  it("gates each Core identity screen on the permission its controller declares", () => {
    expect(canAccessCoreRoute(["org.company.read"], TENANT_ROUTES.coreOrganization)).toBe(true);
    expect(canAccessCoreRoute(["org.company.read"], TENANT_ROUTES.coreCompanies)).toBe(true);
    expect(canAccessCoreRoute(["org.branch.read"], TENANT_ROUTES.coreBranches)).toBe(true);
    expect(canAccessCoreRoute(["org.department.read"], TENANT_ROUTES.coreDepartments)).toBe(true);
    expect(canAccessCoreRoute(["org.team.read"], TENANT_ROUTES.coreTeams)).toBe(true);
    expect(canAccessCoreRoute(["users.user.read"], TENANT_ROUTES.coreUsers)).toBe(true);
    expect(canAccessCoreRoute(["roles.role.read"], TENANT_ROUTES.coreRoles)).toBe(true);
    // Core permissions carry no .own/.team/.all suffix — a scoped string is a
    // CRM shape and must not admit a Core route.
    expect(canAccessCoreRoute(["users.user.read.all"], TENANT_ROUTES.coreUsers)).toBe(false);
    expect(canAccessCoreRoute(["org.branch.read"], TENANT_ROUTES.coreCompanies)).toBe(false);
  });

  it("matches each Core read permission exactly — there is no scope suffix here", () => {
    expect(
      canAccessCoreRoute(["currencies.currency.read"], TENANT_ROUTES.coreSettingsCurrencies),
    ).toBe(true);
    expect(canAccessCoreRoute(["taxes.tax.read"], TENANT_ROUTES.coreSettingsTaxes)).toBe(true);
    expect(canAccessCoreRoute(["numbering.read"], TENANT_ROUTES.coreSettingsNumbering)).toBe(true);
    expect(canAccessCoreRoute(["workspace.email.read"], TENANT_ROUTES.coreSettingsEmail)).toBe(
      true,
    );
    expect(
      canAccessCoreRoute(["notifications.notification.read"], TENANT_ROUTES.coreNotifications),
    ).toBe(true);

    // A CRM-style scope suffix is a different permission, not a wider one.
    expect(
      canAccessCoreRoute(["currencies.currency.read.all"], TENANT_ROUTES.coreSettingsCurrencies),
    ).toBe(false);
    expect(canAccessCoreRoute(["workspace.manage"], TENANT_ROUTES.coreSettingsWorkspace)).toBe(
      false,
    );
    expect(canAccessCoreRoute(["taxes.tax.read"], TENANT_ROUTES.coreSettingsNumbering)).toBe(false);
    // Branding is the one Phase 6 screen that IS permission-gated.
    expect(canAccessCoreRoute(["branding.read"], TENANT_ROUTES.coreSettingsBranding)).toBe(true);
    expect(canAccessCoreRoute(["branding.manage"], TENANT_ROUTES.coreSettingsBranding)).toBe(
      false,
    );
  });

  it("admits the directory, template, activity and audit screens", () => {
    for (const href of [
      TENANT_ROUTES.coreDirectory,
      TENANT_ROUTES.coreDirectorySettings,
      TENANT_ROUTES.coreTemplates,
      TENANT_ROUTES.coreTemplateAssets,
      TENANT_ROUTES.coreTemplateAssignments,
      TENANT_ROUTES.coreActivities,
      TENANT_ROUTES.coreAudit,
    ]) {
      expect(isSupportedCorePath(href)).toBe(true);
    }
    expect(isSupportedCorePath("/core/directory/0199f2b0-1111-4222-8333-444455556666")).toBe(true);
    expect(isSupportedCorePath("/core/templates/0199f2b0-1111-4222-8333-444455556666")).toBe(true);
    // One detail segment, never two — a versions sub-route is not a page.
    expect(isSupportedCorePath("/core/templates/an-id/versions")).toBe(false);
    expect(isSupportedCorePath("/core/directory/an-id/addresses")).toBe(false);
    expect(isSupportedCorePath("/core/activities/an-id")).toBe(false);
  });

  it("gates each Phase 7 screen on the permission its controller declares", () => {
    expect(canAccessCoreRoute(["directory.party.read"], TENANT_ROUTES.coreDirectory)).toBe(true);
    // `directory/settings` has no read grant — the GET uses `.manage` too.
    expect(
      canAccessCoreRoute(["directory.party.read"], TENANT_ROUTES.coreDirectorySettings),
    ).toBe(false);
    expect(
      canAccessCoreRoute(["directory.settings.manage"], TENANT_ROUTES.coreDirectorySettings),
    ).toBe(true);
    expect(canAccessCoreRoute(["templates.read"], TENANT_ROUTES.coreTemplates)).toBe(true);
    expect(canAccessCoreRoute(["templates.read"], TENANT_ROUTES.coreTemplateAssets)).toBe(true);
    expect(canAccessCoreRoute(["templates.read"], TENANT_ROUTES.coreTemplateAssignments)).toBe(
      true,
    );
    expect(canAccessCoreRoute(["activities.read"], TENANT_ROUTES.coreActivities)).toBe(true);
    expect(canAccessCoreRoute(["audit.read"], TENANT_ROUTES.coreAudit)).toBe(true);
    expect(canAccessCoreRoute(["templates.create"], TENANT_ROUTES.coreTemplates)).toBe(false);
    expect(canAccessCoreRoute(["audit.read.all"], TENANT_ROUTES.coreAudit)).toBe(false);
  });

  it("lists only the settings sections the caller may open, and never notifications", () => {
    expect(permittedCoreSettingsRoutes([])).toEqual([]);
    expect(permittedCoreSettingsRoutes(["notifications.notification.read"])).toEqual([]);
    expect(permittedCoreSettingsRoutes(["taxes.tax.read", "numbering.read"])).toEqual([
      TENANT_ROUTES.coreSettingsTaxes,
      TENANT_ROUTES.coreSettingsNumbering,
    ]);
    expect(permittedCoreSettingsRoutes(["branding.read"])).toEqual([
      TENANT_ROUTES.coreSettingsBranding,
    ]);
  });

  it("gates each Phase 10 Trade screen on the permission its list route declares", () => {
    // `/trade/uoms` and `/trade/channels` are gated on `trade.items.read`:
    // there is no UOM or channel permission anywhere in the catalogue.
    expect(canAccessTradeFoundationRoute(["trade.items.read"], TENANT_ROUTES.tradeItems)).toBe(true);
    expect(canAccessTradeFoundationRoute(["trade.items.read"], TENANT_ROUTES.tradeUoms)).toBe(true);
    expect(canAccessTradeFoundationRoute(["trade.items.read"], TENANT_ROUTES.tradeChannels)).toBe(
      true,
    );
    expect(
      canAccessTradeFoundationRoute(
        ["trade.commercial_accounts.read"],
        TENANT_ROUTES.tradeCommercialAccounts,
      ),
    ).toBe(true);
    expect(
      canAccessTradeFoundationRoute(["trade.configuration.read"], TENANT_ROUTES.tradeConfiguration),
    ).toBe(true);

    // Trade permissions carry no `.own`/`.team`/`.all` suffix, so the CRM
    // scoped comparison must not apply here.
    expect(canAccessTradeFoundationRoute(["trade.items.read.all"], TENANT_ROUTES.tradeItems)).toBe(
      false,
    );
    // Managing is not reading.
    expect(canAccessTradeFoundationRoute(["trade.items.manage"], TENANT_ROUTES.tradeItems)).toBe(
      false,
    );
  });

  it("admits the Phase 10 Trade paths and their detail segments", () => {
    expect(isSupportedTradePath(TENANT_ROUTES.tradeItems)).toBe(true);
    expect(isSupportedTradePath("/trade/items/0199f2b0-1111-4222-8333-444455556666")).toBe(true);
    expect(isSupportedTradePath("/trade/uoms/an-id")).toBe(true);
    expect(isSupportedTradePath("/trade/channels/an-id")).toBe(true);
    expect(isSupportedTradePath("/trade/commercial-accounts/an-id")).toBe(true);
    // trade-app publishes no GET for a single configuration definition, so the
    // list screen carries the versions and there is no detail route — Q71.
    expect(isSupportedTradePath(TENANT_ROUTES.tradeConfiguration)).toBe(true);
    expect(isSupportedTradePath("/trade/configuration/an-id")).toBe(false);
    // One detail segment, never two.
    expect(isSupportedTradePath("/trade/items/an-id/channel-listings")).toBe(false);
  });

  it("offers the Trade home only the foundation sections the caller may open", () => {
    expect(permittedTradeFoundationRoutes([])).toEqual([]);
    expect(permittedTradeFoundationRoutes(["trade.items.read"])).toEqual([
      TENANT_ROUTES.tradeItems,
      TENANT_ROUTES.tradeUoms,
      TENANT_ROUTES.tradeChannels,
    ]);
    expect(permittedTradeFoundationRoutes(["trade.credit.view"])).toEqual([]);
  });

});
