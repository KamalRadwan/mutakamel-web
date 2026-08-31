export const TENANT_ROUTES = {
  home: "/",
  // Two cross-module surfaces (Phase 13). Both sit at the top level rather
  // than under a module because neither belongs to one: `/search` fans out
  // across Core and CRM, and `/getting-started` walks a tenant through Core
  // then CRM then Trade. `proxy.ts` matches only `/core`, `/crm` and `/trade`,
  // so neither needs an entry in an `isSupported*Path` allowlist — but both
  // still need a nav entry, which is the half that shipped missing six times
  // before (DEFECTS.md D22, Q40).
  search: "/search",
  gettingStarted: "/getting-started",
  core: "/core",
  coreSessions: "/core/authentication",
  coreSettings: "/core/settings",
  coreSettingsWorkspace: "/core/settings/workspace",
  coreSettingsCurrencies: "/core/settings/currencies",
  coreSettingsTaxes: "/core/settings/taxes",
  coreSettingsNumbering: "/core/settings/numbering",
  coreSettingsEmail: "/core/settings/email",
  coreSettingsBranding: "/core/settings/branding",
  coreBilling: "/core/billing",
  coreBillingInvoices: "/core/billing/invoices",
  coreSubscription: "/core/subscription",
  coreNotifications: "/core/notifications",
  coreProfile: "/core/profile",
  coreOrganization: "/core/organization",
  coreCompanies: "/core/organization/companies",
  coreBranches: "/core/organization/branches",
  coreDepartments: "/core/organization/departments",
  coreTeams: "/core/organization/teams",
  coreUsers: "/core/users",
  coreRoles: "/core/roles",
  coreDirectory: "/core/directory",
  coreDirectorySettings: "/core/directory/settings",
  coreTemplates: "/core/templates",
  coreTemplateAssets: "/core/templates/assets",
  coreTemplateAssignments: "/core/templates/assignments",
  coreAudit: "/core/audit",
  coreActivities: "/core/activities",
  crm: "/crm",
  crmHome: "/crm",
  crmLeads: "/crm/leads",
  crmCustomerProfiles: "/crm/customer-profiles",
  crmOpportunities: "/crm/opportunities",
  crmStaticCatalogue: "/crm/static-data-catalogue",
  crmLeadStages: "/crm/lead-stages",
  crmAcquisitionSources: "/crm/acquisition-sources",
  crmCustomFields: "/crm/custom-fields",
  crmPipelines: "/crm/pipelines",
  crmOpportunityStages: "/crm/opportunity-stages",
  crmActivities: "/crm/activities",
  crmTasks: "/crm/tasks",
  crmCalendar: "/crm/calendar",
  crmReminders: "/crm/reminders",
  crmOutboundEmails: "/crm/outbound-emails",
  crmSettings: "/crm/settings",
  // Phase 9 — CRM dashboards and widgets, docs/api/crm-dashboards.md.
  crmDashboards: "/crm/dashboards",
  // A static segment under the dashboards list, so Next resolves it before
  // `/crm/dashboards/[id]`; the seven prebuilt reports share one screen
  // because they share a permission, a filter set and an envelope.
  crmDashboardReports: "/crm/dashboards/reports",
  crmWidgets: "/crm/widgets",
  trade: "/trade",
  // Phase 10 — Trade foundation, docs/api/trade-foundation.md.
  tradeItems: "/trade/items",
  tradeUoms: "/trade/uoms",
  tradeChannels: "/trade/channels",
  tradeCommercialAccounts: "/trade/commercial-accounts",
  tradeConfiguration: "/trade/configuration",
  // Phase 11 — Trade commercial documents, docs/api/trade-documents.md.
  tradeQuotations: "/trade/quotations",
  tradeSalesOrders: "/trade/sales-orders",
  tradePurchaseOrders: "/trade/purchase-orders",
  tradePurchaseQuotations: "/trade/purchase-quotations",
  tradeInvoices: "/trade/invoices",
  tradeContracts: "/trade/contracts",
  // Phase 12 — Trade advanced and analytics, docs/api/trade-advanced.md.
  tradeInventory: "/trade/inventory",
  tradeInventoryNodes: "/trade/inventory/nodes",
  tradeInventoryPeriods: "/trade/inventory/periods",
  tradeInventoryUomConversions: "/trade/inventory/uom-conversions",
  tradeInventoryMovements: "/trade/inventory/movements",
  tradeInventorySerials: "/trade/inventory/serials",
  tradeInventoryDecisions: "/trade/inventory/decisions",
  tradePriceBooks: "/trade/price-books",
  tradePricing: "/trade/pricing",
  tradePolicies: "/trade/policies",
  tradeWorkflows: "/trade/workflows",
  tradeDocumentProfiles: "/trade/document-profiles",
  tradeExtensions: "/trade/extensions",
  tradeImports: "/trade/imports",
  tradeImportMappings: "/trade/import-mappings",
  tradeWebhooks: "/trade/webhooks",
  tradeWebhookDeliveries: "/trade/webhooks/deliveries",
  tradeControlTower: "/trade/control-tower",
  tradeDashboards: "/trade/dashboards",
  tradeWidgets: "/trade/widgets",
} as const;

const CRM_EXACT_PATHS = new Set<string>([
  TENANT_ROUTES.crm,
  TENANT_ROUTES.crmLeads,
  TENANT_ROUTES.crmCustomerProfiles,
  TENANT_ROUTES.crmOpportunities,
  TENANT_ROUTES.crmStaticCatalogue,
  TENANT_ROUTES.crmLeadStages,
  TENANT_ROUTES.crmAcquisitionSources,
  TENANT_ROUTES.crmCustomFields,
  TENANT_ROUTES.crmPipelines,
  TENANT_ROUTES.crmOpportunityStages,
  TENANT_ROUTES.crmActivities,
  TENANT_ROUTES.crmTasks,
  TENANT_ROUTES.crmCalendar,
  TENANT_ROUTES.crmReminders,
  TENANT_ROUTES.crmOutboundEmails,
  TENANT_ROUTES.crmSettings,
  TENANT_ROUTES.crmDashboards,
  TENANT_ROUTES.crmDashboardReports,
  TENANT_ROUTES.crmWidgets,
]);

const CRM_ENTRY_ROUTES = [
  {
    href: TENANT_ROUTES.crmLeads,
    requirements: [
      { permission: "crm.leads.read", acceptsScopedPermission: true },
      {
        permission: "crm.lead_stages.read",
        acceptsScopedPermission: false,
      },
    ],
  },
  {
    href: TENANT_ROUTES.crmCustomerProfiles,
    requirements: [
      {
        permission: "crm.customer_profiles.read",
        acceptsScopedPermission: true,
      },
    ],
  },
  {
    href: TENANT_ROUTES.crmOpportunities,
    requirements: [
      {
        permission: "crm.opportunities.read",
        acceptsScopedPermission: true,
      },
      { permission: "crm.pipelines.read", acceptsScopedPermission: false },
    ],
  },
  // Order decides where a user LANDS, so it is behaviour, not cosmetics.
  // These sit after the three record screens and before the catalogues:
  // records first, then daily workflow, then pipeline configuration.
  //
  // Analytics sits between the records and the configuration: a dashboard is
  // a reading surface over the same records, so it must not outrank them, and
  // it is a far better landing page than a stage catalogue.
  //
  // `crm.dashboards.read` is seeded ONLY as `.own`/`.team`/`.all`
  // (crm-app `CRM_SCOPED_PERMISSION_BASES`), so it must accept the scoped
  // form — matching the bare key alone would admit nobody. `crm.widgets.read`
  // is the opposite: `widgets` is not a scoped resource, so it is exact.
  {
    href: TENANT_ROUTES.crmDashboards,
    requirements: [{ permission: "crm.dashboards.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmDashboardReports,
    requirements: [{ permission: "crm.dashboards.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmWidgets,
    requirements: [{ permission: "crm.widgets.read", acceptsScopedPermission: false }],
  },
  {
    href: TENANT_ROUTES.crmPipelines,
    requirements: [{ permission: "crm.pipelines.read", acceptsScopedPermission: false }],
  },
  {
    // Every one of the five /opportunity-stages routes requires .manage,
    // including both GETs. Admitting on .read would let an actor onto a screen
    // whose every request then answers 403.
    href: TENANT_ROUTES.crmOpportunityStages,
    requirements: [{ permission: "crm.pipelines.manage", acceptsScopedPermission: false }],
  },
  {
    href: TENANT_ROUTES.crmActivities,
    requirements: [{ permission: "crm.activities.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmTasks,
    requirements: [{ permission: "crm.activities.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmCalendar,
    requirements: [{ permission: "crm.activities.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmReminders,
    requirements: [{ permission: "crm.activities.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmOutboundEmails,
    requirements: [{ permission: "crm.activities.read", acceptsScopedPermission: true }],
  },
  {
    href: TENANT_ROUTES.crmStaticCatalogue,
    requirements: [
      { permission: "crm.settings.read", acceptsScopedPermission: false },
    ],
  },
  {
    href: TENANT_ROUTES.crmLeadStages,
    requirements: [
      {
        permission: "crm.lead_stages.read",
        acceptsScopedPermission: false,
      },
    ],
  },
  {
    href: TENANT_ROUTES.crmAcquisitionSources,
    requirements: [
      {
        permission: "crm.acquisition_sources.read",
        acceptsScopedPermission: false,
      },
    ],
  },
  {
    href: TENANT_ROUTES.crmCustomFields,
    requirements: [
      {
        permission: "crm.custom_fields.read",
        acceptsScopedPermission: false,
      },
    ],
  },
  {
    href: TENANT_ROUTES.crmSettings,
    requirements: [
      { permission: "crm.settings.read", acceptsScopedPermission: false },
    ],
  },
] as const;

const CRM_READ_SCOPES = ["own", "team", "all"] as const;

export function canAccessCrmRoute(
  permissions: readonly string[],
  href: (typeof CRM_ENTRY_ROUTES)[number]["href"],
): boolean {
  const route = CRM_ENTRY_ROUTES.find((candidate) => candidate.href === href);
  if (!route) return false;

  return route.requirements.every((requirement) =>
    permissions.some(
      (permission) =>
        permission === requirement.permission ||
        (requirement.acceptsScopedPermission &&
          CRM_READ_SCOPES.some(
            (scope) => permission === `${requirement.permission}.${scope}`,
          )),
    ),
  );
}

export function getFirstPermittedCrmRoute(
  permissions: readonly string[],
): (typeof CRM_ENTRY_ROUTES)[number]["href"] | null {
  return (
    CRM_ENTRY_ROUTES.find((route) =>
      canAccessCrmRoute(permissions, route.href),
    )?.href ?? null
  );
}

// Every Core screen requires exactly one read permission, and each one is
// copied from its controller's @RequirePermissions decorator in core-app —
// see docs/api/core-settings.md for the route-by-route table.
const CORE_ENTRY_ROUTES = [
  { href: TENANT_ROUTES.coreSettingsWorkspace, permission: "workspace.read" },
  { href: TENANT_ROUTES.coreSettingsCurrencies, permission: "currencies.currency.read" },
  { href: TENANT_ROUTES.coreSettingsTaxes, permission: "taxes.tax.read" },
  { href: TENANT_ROUTES.coreSettingsNumbering, permission: "numbering.read" },
  { href: TENANT_ROUTES.coreSettingsEmail, permission: "workspace.email.read" },
  { href: TENANT_ROUTES.coreNotifications, permission: "notifications.notification.read" },
  // Identity and organization — docs/api/core-identity.md. The tree is gated on
  // `org.company.read` because that is what OrganizationController declares on
  // GET /organization/tree, not on the four level permissions.
  { href: TENANT_ROUTES.coreOrganization, permission: "org.company.read" },
  { href: TENANT_ROUTES.coreCompanies, permission: "org.company.read" },
  { href: TENANT_ROUTES.coreBranches, permission: "org.branch.read" },
  { href: TENANT_ROUTES.coreDepartments, permission: "org.department.read" },
  { href: TENANT_ROUTES.coreTeams, permission: "org.team.read" },
  { href: TENANT_ROUTES.coreUsers, permission: "users.user.read" },
  { href: TENANT_ROUTES.coreRoles, permission: "roles.role.read" },
  // Directory, templates, audit and activities — docs/api/core-directory.md and
  // docs/api/core-templates.md. `directory/settings` uses `.manage` for its GET
  // too: there is no separate read grant on that route.
  { href: TENANT_ROUTES.coreDirectory, permission: "directory.party.read" },
  { href: TENANT_ROUTES.coreDirectorySettings, permission: "directory.settings.manage" },
  { href: TENANT_ROUTES.coreTemplates, permission: "templates.read" },
  { href: TENANT_ROUTES.coreTemplateAssets, permission: "templates.read" },
  { href: TENANT_ROUTES.coreTemplateAssignments, permission: "templates.read" },
  { href: TENANT_ROUTES.coreAudit, permission: "audit.read" },
  { href: TENANT_ROUTES.coreActivities, permission: "activities.read" },
  // Branding — docs/api/core-billing.md. The authenticated half of
  // BrandingController is the one part of Phase 6 that IS permission-gated;
  // billing and subscription carry no permission strings at all.
  { href: TENANT_ROUTES.coreSettingsBranding, permission: "branding.read" },
] as const;

export type CoreEntryRoute = (typeof CORE_ENTRY_ROUTES)[number]["href"];

/**
 * Core permissions carry no `.own`/`.team`/`.all` scope suffix — the CRM
 * scoping model does not apply here, so this is an exact match, never the
 * scoped comparison `canAccessCrmRoute` makes.
 */
export function canAccessCoreRoute(
  permissions: readonly string[],
  href: CoreEntryRoute,
): boolean {
  const route = CORE_ENTRY_ROUTES.find((candidate) => candidate.href === href);
  return route ? permissions.includes(route.permission) : false;
}

/**
 * The sections the `/core/settings` hub offers, in the order it renders them.
 *
 * Listed explicitly rather than derived from `CORE_ENTRY_ROUTES`: that array
 * carries every Core screen, and a hub that silently absorbs each new one
 * would start advertising pages it has no copy for.
 */
const CORE_SETTINGS_HUB_ROUTES = [
  TENANT_ROUTES.coreSettingsWorkspace,
  TENANT_ROUTES.coreSettingsCurrencies,
  TENANT_ROUTES.coreSettingsTaxes,
  TENANT_ROUTES.coreSettingsNumbering,
  TENANT_ROUTES.coreSettingsEmail,
  TENANT_ROUTES.coreSettingsBranding,
] as const;

/** The settings hub lists only what the caller may actually open. */
export function permittedCoreSettingsRoutes(
  permissions: readonly string[],
): CoreEntryRoute[] {
  return CORE_SETTINGS_HUB_ROUTES.filter((href) => canAccessCoreRoute(permissions, href));
}

/**
 * The screens behind `TenantOwnerGuard`.
 *
 * They are NOT in `CORE_ENTRY_ROUTES` because they carry no permission at all:
 * `TenantBillingController` and `SubscriptionSelfServeController` declare
 * `@UseGuards(TenantGuard, TenantOwnerGuard)` with no `@RequirePermissions`
 * anywhere, so admission is `tenant_users.is_tenant_owner` and nothing else.
 * A permission lookup here would be a lookup for a string that does not exist.
 */
const CORE_OWNER_ROUTES = [
  TENANT_ROUTES.coreBilling,
  TENANT_ROUTES.coreBillingInvoices,
  TENANT_ROUTES.coreSubscription,
] as const;

/** The nav predicate for a billing or subscription entry — never a permission. */
export function canAccessCoreOwnerRoute(isTenantOwner: boolean): boolean {
  return isTenantOwner;
}

const CORE_EXACT_PATHS = new Set<string>([
  TENANT_ROUTES.core,
  TENANT_ROUTES.coreSessions,
  TENANT_ROUTES.coreSettings,
  // Own preferences: GET/PUT /users/me/profile carry no @RequirePermissions, so
  // this is reachable by any authenticated tenant user and is not an entry route.
  TENANT_ROUTES.coreProfile,
  ...CORE_ENTRY_ROUTES.map((route) => route.href),
  ...CORE_OWNER_ROUTES,
]);

// One detail segment per list, never two — a stale deep link below a detail
// page redirects to /unavailable instead of rendering an empty shell.
//
// `directory` and `templates` also carry static children (`/settings`,
// `/assets`, `/assignments`) that this pattern matches as well; those are
// listed in CORE_EXACT_PATHS and Next resolves the static segment first, so
// admitting them twice is harmless and keeps the pattern one line.
const CORE_DETAIL_PATHS =
  /^\/core\/(?:notifications|users|roles|directory|templates|billing\/invoices|organization\/(?:companies|branches|departments|teams))\/[^/]+$/u;

export function isSupportedCorePath(pathname: string): boolean {
  return CORE_EXACT_PATHS.has(pathname) || CORE_DETAIL_PATHS.test(pathname);
}

// One detail segment per list, never two — same rule as CORE_DETAIL_PATHS.
// Every segment named here has a `[id]/page.tsx`; a screen that is built but
// not listed is redirected to /unavailable by the proxy, which is how six of
// these shipped unreachable (Q40).
//
// `dashboards` and `widgets` are Phase 9. `/crm/dashboards/reports` matches
// this pattern as well, and that is harmless: it is listed in
// CRM_EXACT_PATHS and Next resolves the static segment before `[id]`.
const CRM_DETAIL_PATHS =
  /^\/crm\/(?:leads|opportunities|customer-profiles|pipelines|opportunity-stages|outbound-emails|dashboards|widgets)\/[^/]+$/u;

export function isSupportedCrmPath(pathname: string): boolean {
  return CRM_EXACT_PATHS.has(pathname) || CRM_DETAIL_PATHS.test(pathname);
}

// ---- Trade · advanced and analytics (Phase 12) ---------------------------
//
// Each permission is the one its screen's read route declares in
// @RequireTradeAccess — docs/api/trade-advanced.md's route tables. Two rules
// differ from Core and CRM:
//
//   * Trade permissions carry no `.own`/`.team`/`.all` suffix, so this is an
//     exact match like Core's, never the CRM scoped comparison.
//   * `trade.inventory.movements` is deliberately absent: receipts,
//     deliveries, reservations and opening balances have NO read route at all
//     (Q37), so that screen's admission is a write grant.
const TRADE_ENTRY_ROUTES = [
  { href: TENANT_ROUTES.tradeInventory, permission: "trade.inventory.read" },
  { href: TENANT_ROUTES.tradeInventoryNodes, permission: "trade.inventory.read" },
  { href: TENANT_ROUTES.tradeInventoryPeriods, permission: "trade.inventory.read" },
  { href: TENANT_ROUTES.tradeInventoryUomConversions, permission: "trade.inventory.read" },
  { href: TENANT_ROUTES.tradeInventoryMovements, permission: "trade.inventory.reserve" },
  { href: TENANT_ROUTES.tradeInventorySerials, permission: "trade.inventory.read" },
  { href: TENANT_ROUTES.tradeInventoryDecisions, permission: "trade.inventory.read" },
  { href: TENANT_ROUTES.tradePriceBooks, permission: "trade.pricing.read" },
  { href: TENANT_ROUTES.tradePricing, permission: "trade.pricing.read" },
  // Workflows use `trade.policy.*` — there is no `trade.workflow.*` permission
  // anywhere in trade-app, so the two studios cannot be authorized apart.
  { href: TENANT_ROUTES.tradePolicies, permission: "trade.policy.read" },
  { href: TENANT_ROUTES.tradeWorkflows, permission: "trade.policy.read" },
  { href: TENANT_ROUTES.tradeDocumentProfiles, permission: "trade.document_profiles.read" },
  { href: TENANT_ROUTES.tradeExtensions, permission: "trade.extensions.read" },
  // The import list and detail reads need `.execute`, not `.manage`: a user
  // who may configure mappings cannot see the runs, and there is no read-only
  // import grant.
  { href: TENANT_ROUTES.tradeImports, permission: "trade.import.execute" },
  { href: TENANT_ROUTES.tradeImportMappings, permission: "trade.import.manage" },
  { href: TENANT_ROUTES.tradeWebhooks, permission: "trade.webhooks.manage" },
  { href: TENANT_ROUTES.tradeWebhookDeliveries, permission: "trade.webhooks.manage" },
  { href: TENANT_ROUTES.tradeControlTower, permission: "trade.control_tower.read" },
] as const;

export type TradeEntryRoute = (typeof TRADE_ENTRY_ROUTES)[number]["href"];

export function canAccessTradeRoute(
  permissions: readonly string[],
  href: TradeEntryRoute,
): boolean {
  const route = TRADE_ENTRY_ROUTES.find((candidate) => candidate.href === href);
  return route ? permissions.includes(route.permission) : false;
}

/**
 * Dashboards and widgets are **not** in `TRADE_ENTRY_ROUTES`.
 *
 * Every route on both controllers targets `DASHBOARD_CONTEXT`, and
 * `TradePermissionsGuard.canActivate` returns `true` immediately for that
 * target — the declared `trade.dashboards.*` and `trade.widgets.*` strings are
 * never enforced by the guard. Authorization happens inside the dashboard
 * service, per resolved company. Gating the entry on a permission string would
 * hide the screen from users the server would have admitted, and would imply a
 * protection that does not exist
 * (docs/api/trade-advanced.md#dashboards--20-routes).
 */
export function canAccessTradeAnalytics(): boolean {
  return true;
}

// ---- Trade · foundation (Phase 10) ---------------------------------------
//
// The read permission each screen's list route declares in
// @RequireTradeAccess — docs/api/trade-foundation.md's route tables. Two of
// them are not the ones the segment name suggests:
//
//   * `/trade/uoms` and `/trade/channels` are gated on `trade.items.read`,
//     not a UOM or channel permission — neither exists in the catalogue.
//   * `/trade/configuration` reads with `trade.configuration.read`, but
//     publishing a version needs `trade.policy.publish`, which a user with
//     full configuration-manage rights does not have.
const TRADE_FOUNDATION_ROUTES = [
  { href: TENANT_ROUTES.tradeItems, permission: "trade.items.read" },
  { href: TENANT_ROUTES.tradeUoms, permission: "trade.items.read" },
  { href: TENANT_ROUTES.tradeChannels, permission: "trade.items.read" },
  {
    href: TENANT_ROUTES.tradeCommercialAccounts,
    permission: "trade.commercial_accounts.read",
  },
  { href: TENANT_ROUTES.tradeConfiguration, permission: "trade.configuration.read" },
] as const;

export type TradeFoundationRoute = (typeof TRADE_FOUNDATION_ROUTES)[number]["href"];

export function canAccessTradeFoundationRoute(
  permissions: readonly string[],
  href: TradeFoundationRoute,
): boolean {
  const route = TRADE_FOUNDATION_ROUTES.find((candidate) => candidate.href === href);
  return route ? permissions.includes(route.permission) : false;
}

/** The foundation sections the `/trade` home offers, in the order it renders them. */
export function permittedTradeFoundationRoutes(
  permissions: readonly string[],
): TradeFoundationRoute[] {
  return TRADE_FOUNDATION_ROUTES.filter((route) =>
    canAccessTradeFoundationRoute(permissions, route.href),
  ).map((route) => route.href);
}

// ---- Trade · commercial documents (Phase 11) -----------------------------
//
// The read permission each family's list route declares in
// @RequireTradeAccess — docs/api/trade-documents.md's route tables. Every one
// of the 60 routes targets `BRANCH`, and `TradePermissionsGuard` matches
// `scope_target` exactly, so a TENANT grant does not admit any of them; only
// `is_tenant_owner` bypasses. Trade publishes no capabilities endpoint (Q30),
// so this is route admission only and the screens treat a 403 as authoritative.
const TRADE_DOCUMENT_ROUTES = [
  { href: TENANT_ROUTES.tradeQuotations, permission: "trade.quotations.read" },
  { href: TENANT_ROUTES.tradeSalesOrders, permission: "trade.sales_orders.read" },
  { href: TENANT_ROUTES.tradePurchaseOrders, permission: "trade.purchase_orders.read" },
  {
    href: TENANT_ROUTES.tradePurchaseQuotations,
    permission: "trade.purchase_quotations.read",
  },
  { href: TENANT_ROUTES.tradeInvoices, permission: "trade.invoices.read" },
  { href: TENANT_ROUTES.tradeContracts, permission: "trade.contracts.read" },
] as const;

export type TradeDocumentRoute = (typeof TRADE_DOCUMENT_ROUTES)[number]["href"];

export function canAccessTradeDocumentRoute(
  permissions: readonly string[],
  href: TradeDocumentRoute,
): boolean {
  const route = TRADE_DOCUMENT_ROUTES.find((candidate) => candidate.href === href);
  return route ? permissions.includes(route.permission) : false;
}

const TRADE_EXACT_PATHS = new Set<string>([
  TENANT_ROUTES.trade,
  TENANT_ROUTES.tradeDashboards,
  TENANT_ROUTES.tradeWidgets,
  ...TRADE_ENTRY_ROUTES.map((route) => route.href),
  ...TRADE_FOUNDATION_ROUTES.map((route) => route.href),
  ...TRADE_DOCUMENT_ROUTES.map((route) => route.href),
]);

// One detail segment per list. Five version families are deliberately absent
// because no GET-by-id exists for any of them, and a route to a screen with no
// source is a dead link:
//
//   document-profiles/:id, document-profile-versions/:id      Q38
//   policy-versions/:id, workflow-versions/:id                Q91 — the ladder
//     has nine action routes and a PATCH but no read; a version is only ever
//     seen through the `versions[]` array the definition list embeds
//   inventory receipts / deliveries / reservations            Q37
//
// `price-book-versions/:id` IS present: PricingReadController exposes a GET.
// Phase 10 appends `items`, `uoms`, `channels` and `commercial-accounts`.
// `configuration` is deliberately ABSENT: trade-app publishes no GET for a
// single configuration definition or version — `findDefinition` is private to
// the service — so a `/trade/configuration/:id` route would have to page the
// whole list to render one record. Its versions, their test and their publish
// live on the list screen instead. Recorded as Q71.
// Phase 11 appends the six commercial-document families. Each has a
// `GET /:id`, so each has a detail screen; there is no second segment below
// one, because a quotation revision, a confirmation attempt and a render job
// are all read through their parent document's own routes.
const TRADE_DETAIL_PATHS =
  /^\/trade\/(?:items|uoms|channels|commercial-accounts|quotations|sales-orders|purchase-orders|purchase-quotations|invoices|contracts|inventory\/(?:nodes|serials|decisions)|price-book-versions|decisions|extensions|import-mappings|imports|control-tower|dashboards|widgets|webhooks|webhooks\/deliveries)\/[^/]+$/u;

/**
 * The `/trade/*` allowlist `proxy.ts` redirects against.
 *
 * Phases 10, 11 and 12 each append their own segments as they land. The six
 * commercial-document families — `/trade/quotations`, `/trade/sales-orders`,
 * `/trade/purchase-orders`, `/trade/purchase-quotations`, `/trade/invoices`
 * and `/trade/contracts` — are in `TRADE_DOCUMENT_ROUTES` above. A Trade path
 * absent from this list redirects to `/unavailable`.
 */
export function isSupportedTradePath(pathname: string): boolean {
  return TRADE_EXACT_PATHS.has(pathname) || TRADE_DETAIL_PATHS.test(pathname);
}
