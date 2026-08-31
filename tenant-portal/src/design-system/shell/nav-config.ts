import {
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CalendarRange,
  ChartNoAxesColumn,
  CircleUser,
  ClipboardCheck,
  Coins,
  Compass,
  Contact,
  CreditCard,
  Database,
  FileCog,
  FileSearch,
  FileSignature,
  FileText,
  Gavel,
  Handshake,
  Hash,
  Images,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  ListOrdered,
  Mail,
  Network,
  Package,
  Palette,
  Percent,
  Puzzle,
  Radio,
  RadioTower,
  ReceiptText,
  Route,
  Rows3,
  Ruler,
  ScanBarcode,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  SquareStack,
  Store,
  TrendingUp,
  Truck,
  Upload,
  UserCog,
  Users,
  Users2,
  UsersRound,
  Warehouse,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  canAccessCoreRoute,
  canAccessCrmRoute,
  canAccessTradeAnalytics,
  canAccessTradeDocumentRoute,
  canAccessTradeRoute,
  canAccessTradeFoundationRoute,
  TENANT_ROUTES,
} from "@/lib/navigation/tenant-routes";

export interface NavItem {
  id: string;
  labelKey: string; // dictionary key under t.nav
  href: string;
  icon: LucideIcon;
  // Carried verbatim from lib/navigation/tenant-routes.ts's
  // canAccessCrmRoute — only the output shape changes here, from
  // hook-computed booleans to data the sidebar iterates. Its tests carry
  // over unchanged, which is the proof this did not alter behavior.
  hasAccess: (permissions: readonly string[]) => boolean;
  /**
   * The route is behind `TenantOwnerGuard`, which is not a permission.
   *
   * Billing and subscription declare no `@RequirePermissions` at all — the gate
   * is `tenant_users.is_tenant_owner` — so `hasAccess` has nothing to look up
   * and the predicate is `user.isTenantOwner` instead
   * (docs/api/core-billing.md#the-two-rules-that-shape-every-screen-here).
   */
  requiresTenantOwner?: boolean;
}

export interface NavSection {
  id: string;
  labelKey: string | null; // null: no section heading (Workspace)
  items: NavItem[];
}

// Single source of truth — useNavTree.ts filters this against the
// authenticated permission set. Only server-backed routes appear; the 45
// sealed routes are deleted, not hidden. See docs/design/shell.md#navigation-map.
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    labelKey: null,
    items: [
      {
        id: "home",
        labelKey: "workspaceCenter",
        href: TENANT_ROUTES.home,
        icon: LayoutDashboard,
        hasAccess: () => true,
      },
      // Phase 13. Both are reachable by everyone and gate themselves in-body:
      // the search screen renders only the record families the actor's own
      // permissions admit, and the checklist renders every step but offers a
      // link only for the ones the actor may perform. Gating the nav entry on
      // a permission string would hide the screen from someone it would have
      // been useful to — see MASTER-PLAN 13.21 and 13.23.
      {
        id: "globalSearch",
        labelKey: "globalSearch",
        href: TENANT_ROUTES.search,
        icon: Search,
        hasAccess: () => true,
      },
      {
        id: "gettingStarted",
        labelKey: "gettingStarted",
        href: TENANT_ROUTES.gettingStarted,
        icon: Compass,
        hasAccess: () => true,
      },
    ],
  },
  {
    id: "crm",
    labelKey: "crm",
    items: [
      {
        id: "leads",
        labelKey: "leads",
        href: TENANT_ROUTES.crmLeads,
        icon: Users2,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmLeads),
      },
      {
        id: "customerProfiles",
        labelKey: "customerProfiles",
        href: TENANT_ROUTES.crmCustomerProfiles,
        icon: Users,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmCustomerProfiles),
      },
      {
        id: "opportunities",
        labelKey: "opportunities",
        href: TENANT_ROUTES.crmOpportunities,
        icon: TrendingUp,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmOpportunities),
      },
    ],
  },
  // CRM analytics (Phase 9). Its own section rather than three more rows under
  // `crm`: the three screens share a `SubNav`, and the dashboards list, the
  // prebuilt reports and the widget library are one workspace with three
  // entrances. Admission mirrors CRM_ENTRY_ROUTES exactly — dashboards accept
  // the scoped `crm.dashboards.read.*`, widgets need the static
  // `crm.widgets.read`.
  {
    id: "crmAnalytics",
    labelKey: "crmDashboardBuilder",
    items: [
      {
        id: "crmDashboards",
        labelKey: "crmDashboardBuilder",
        href: TENANT_ROUTES.crmDashboards,
        icon: LayoutDashboard,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmDashboards),
      },
      {
        id: "crmDashboardReports",
        labelKey: "presetDashboards",
        href: TENANT_ROUTES.crmDashboardReports,
        icon: FileSearch,
        hasAccess: (permissions) =>
          canAccessCrmRoute(permissions, TENANT_ROUTES.crmDashboardReports),
      },
      {
        id: "crmWidgets",
        labelKey: "crmWidgetLibrary",
        href: TENANT_ROUTES.crmWidgets,
        icon: SquareStack,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmWidgets),
      },
    ],
  },
  {
    id: "crmSetup",
    labelKey: "crmSetup",
    items: [
      {
        id: "leadStages",
        labelKey: "leadStages",
        href: TENANT_ROUTES.crmLeadStages,
        icon: ListOrdered,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmLeadStages),
      },
      {
        id: "acquisitionSources",
        labelKey: "acquisitionSources",
        href: TENANT_ROUTES.crmAcquisitionSources,
        icon: TrendingUp,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmAcquisitionSources),
      },
      {
        id: "customFields",
        labelKey: "customFields",
        href: TENANT_ROUTES.crmCustomFields,
        icon: SlidersHorizontal,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmCustomFields),
      },
      {
        id: "crmSettings",
        labelKey: "crmSettings",
        href: TENANT_ROUTES.crmSettings,
        icon: Settings,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmSettings),
      },
      {
        id: "staticData",
        labelKey: "staticData",
        href: TENANT_ROUTES.crmStaticCatalogue,
        icon: Database,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmStaticCatalogue),
      },
    ],
  },
  // Trade · foundation (Phase 10). Every item is gated on the read permission
  // its list route declares, matched exactly: Trade permissions carry no
  // `.own`/`.team`/`.all` suffix. The tenant owner needs no separate predicate
  // — `/auth/me` returns every seeded permission key to an owner
  // (core-app tenant-auth.service.ts, `fetchPermissionKeys`), and the 90 Trade
  // keys are seeded by trade-app's own `trade.permissions` pack, so an owner of
  // a tenant without the Trade module correctly sees no Trade nav at all.
  {
    id: "tradeFoundation",
    labelKey: "tradeFoundation",
    items: [
      {
        id: "tradeItems",
        labelKey: "tradeItems",
        href: TENANT_ROUTES.tradeItems,
        icon: Package,
        hasAccess: (permissions) =>
          canAccessTradeFoundationRoute(permissions, TENANT_ROUTES.tradeItems),
      },
      {
        id: "tradeUoms",
        labelKey: "tradeUoms",
        href: TENANT_ROUTES.tradeUoms,
        icon: Ruler,
        hasAccess: (permissions) =>
          canAccessTradeFoundationRoute(permissions, TENANT_ROUTES.tradeUoms),
      },
      {
        id: "tradeChannels",
        labelKey: "tradeChannels",
        href: TENANT_ROUTES.tradeChannels,
        icon: Radio,
        hasAccess: (permissions) =>
          canAccessTradeFoundationRoute(permissions, TENANT_ROUTES.tradeChannels),
      },
      {
        id: "tradeCommercialAccounts",
        labelKey: "tradeCommercialAccounts",
        href: TENANT_ROUTES.tradeCommercialAccounts,
        icon: Handshake,
        hasAccess: (permissions) =>
          canAccessTradeFoundationRoute(permissions, TENANT_ROUTES.tradeCommercialAccounts),
      },
      {
        id: "tradeConfiguration",
        labelKey: "tradeConfiguration",
        href: TENANT_ROUTES.tradeConfiguration,
        icon: SlidersHorizontal,
        hasAccess: (permissions) =>
          canAccessTradeFoundationRoute(permissions, TENANT_ROUTES.tradeConfiguration),
      },
    ],
  },
  // Trade · commercial documents (Phase 11). Same exact-match rule as the
  // foundation section above. Invoices and contracts are **not** feature-gated
  // in trade-app — `TradeInvoicesController` and `TradeContractsController`
  // carry no `@RequireTradeFeature`, and `trade.contracts_recurring` is
  // referenced nowhere — so they appear on the same terms as the rest.
  {
    id: "tradeDocuments",
    labelKey: "tradeDocuments",
    items: [
      {
        id: "tradeQuotations",
        labelKey: "tradeQuotations",
        href: TENANT_ROUTES.tradeQuotations,
        icon: FileText,
        hasAccess: (permissions) =>
          canAccessTradeDocumentRoute(permissions, TENANT_ROUTES.tradeQuotations),
      },
      {
        id: "tradeSalesOrders",
        labelKey: "tradeSalesOrders",
        href: TENANT_ROUTES.tradeSalesOrders,
        icon: ClipboardCheck,
        hasAccess: (permissions) =>
          canAccessTradeDocumentRoute(permissions, TENANT_ROUTES.tradeSalesOrders),
      },
      {
        id: "tradePurchaseOrders",
        labelKey: "tradePurchaseOrders",
        href: TENANT_ROUTES.tradePurchaseOrders,
        icon: ShoppingCart,
        hasAccess: (permissions) =>
          canAccessTradeDocumentRoute(permissions, TENANT_ROUTES.tradePurchaseOrders),
      },
      {
        id: "tradePurchaseQuotations",
        labelKey: "tradePurchaseQuotations",
        href: TENANT_ROUTES.tradePurchaseQuotations,
        icon: FileSearch,
        hasAccess: (permissions) =>
          canAccessTradeDocumentRoute(permissions, TENANT_ROUTES.tradePurchaseQuotations),
      },
      {
        id: "tradeInvoices",
        labelKey: "tradeInvoices",
        href: TENANT_ROUTES.tradeInvoices,
        icon: ReceiptText,
        hasAccess: (permissions) =>
          canAccessTradeDocumentRoute(permissions, TENANT_ROUTES.tradeInvoices),
      },
      {
        id: "tradeContracts",
        labelKey: "tradeContracts",
        href: TENANT_ROUTES.tradeContracts,
        icon: FileSignature,
        hasAccess: (permissions) =>
          canAccessTradeDocumentRoute(permissions, TENANT_ROUTES.tradeContracts),
      },
    ],
  },
  // Phase 12 — Trade advanced and analytics. Every entry's predicate is the
  // permission its screen's read route declares, except the two analytics
  // ones: `DASHBOARD_CONTEXT` makes `TradePermissionsGuard` return true before
  // it looks at a permission, so gating the entry on a string would hide a
  // screen the server would have admitted.
  {
    id: "tradeInventory",
    labelKey: "tradeInventoryNodes",
    items: [
      {
        id: "tradeInventoryAvailability",
        labelKey: "tradeInventoryAvailability",
        href: TENANT_ROUTES.tradeInventory,
        icon: Boxes,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventory),
      },
      {
        id: "tradeInventoryNodes",
        labelKey: "tradeInventoryNodes",
        href: TENANT_ROUTES.tradeInventoryNodes,
        icon: Warehouse,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventoryNodes),
      },
      {
        id: "tradeInventoryPeriods",
        labelKey: "tradeInventoryPeriods",
        href: TENANT_ROUTES.tradeInventoryPeriods,
        icon: CalendarRange,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventoryPeriods),
      },
      {
        id: "tradeInventoryUomConversions",
        labelKey: "tradeInventoryUomConversions",
        href: TENANT_ROUTES.tradeInventoryUomConversions,
        icon: Ruler,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventoryUomConversions),
      },
      {
        id: "tradeInventoryMovements",
        labelKey: "tradeInventoryMovements",
        href: TENANT_ROUTES.tradeInventoryMovements,
        icon: Truck,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventoryMovements),
      },
      {
        id: "tradeInventorySerials",
        labelKey: "tradeInventorySerials",
        href: TENANT_ROUTES.tradeInventorySerials,
        icon: ScanBarcode,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventorySerials),
      },
      {
        id: "tradeInventoryDecisions",
        labelKey: "tradeInventoryDecisions",
        href: TENANT_ROUTES.tradeInventoryDecisions,
        icon: Gavel,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeInventoryDecisions),
      },
    ],
  },
  {
    id: "tradeGovernance",
    labelKey: "policyStudio",
    items: [
      {
        id: "tradePriceBooks",
        labelKey: "tradePriceBooks",
        href: TENANT_ROUTES.tradePriceBooks,
        icon: BookOpen,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradePriceBooks),
      },
      {
        id: "tradePricingEvaluate",
        labelKey: "tradePricingEvaluate",
        href: TENANT_ROUTES.tradePricing,
        icon: Calculator,
        hasAccess: (permissions) => canAccessTradeRoute(permissions, TENANT_ROUTES.tradePricing),
      },
      {
        id: "tradePolicies",
        labelKey: "tradePolicies",
        href: TENANT_ROUTES.tradePolicies,
        icon: ShieldCheck,
        hasAccess: (permissions) => canAccessTradeRoute(permissions, TENANT_ROUTES.tradePolicies),
      },
      {
        id: "tradeWorkflows",
        labelKey: "tradeWorkflows",
        href: TENANT_ROUTES.tradeWorkflows,
        icon: Workflow,
        hasAccess: (permissions) => canAccessTradeRoute(permissions, TENANT_ROUTES.tradeWorkflows),
      },
      {
        id: "tradeDocumentProfiles",
        labelKey: "tradeDocumentProfiles",
        href: TENANT_ROUTES.tradeDocumentProfiles,
        icon: FileCog,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeDocumentProfiles),
      },
    ],
  },
  {
    id: "tradeAutomation",
    labelKey: "importsWebhooks",
    items: [
      {
        id: "tradeExtensions",
        labelKey: "tradeExtensions",
        href: TENANT_ROUTES.tradeExtensions,
        icon: Puzzle,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeExtensions),
      },
      {
        id: "tradeImports",
        labelKey: "tradeImports",
        href: TENANT_ROUTES.tradeImports,
        icon: Upload,
        hasAccess: (permissions) => canAccessTradeRoute(permissions, TENANT_ROUTES.tradeImports),
      },
      {
        id: "tradeImportMappings",
        labelKey: "tradeImportMappings",
        href: TENANT_ROUTES.tradeImportMappings,
        icon: Rows3,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeImportMappings),
      },
      {
        id: "tradeWebhookSubscriptions",
        labelKey: "tradeWebhookSubscriptions",
        href: TENANT_ROUTES.tradeWebhooks,
        icon: Radio,
        hasAccess: (permissions) => canAccessTradeRoute(permissions, TENANT_ROUTES.tradeWebhooks),
      },
      {
        id: "tradeControlTower",
        labelKey: "tradeControlTower",
        href: TENANT_ROUTES.tradeControlTower,
        icon: RadioTower,
        hasAccess: (permissions) =>
          canAccessTradeRoute(permissions, TENANT_ROUTES.tradeControlTower),
      },
    ],
  },
  {
    id: "tradeAnalytics",
    labelKey: "tradeDashboard",
    items: [
      {
        id: "tradeDashboards",
        labelKey: "tradeDashboards",
        href: TENANT_ROUTES.tradeDashboards,
        icon: LayoutDashboard,
        hasAccess: canAccessTradeAnalytics,
      },
      {
        id: "tradeWidgets",
        labelKey: "tradeWidgets",
        href: TENANT_ROUTES.tradeWidgets,
        icon: ChartNoAxesColumn,
        hasAccess: canAccessTradeAnalytics,
      },
    ],
  },
  {
    id: "coreIdentity",
    labelKey: "staff",
    items: [
      {
        id: "coreOrganization",
        labelKey: "organization",
        href: TENANT_ROUTES.coreOrganization,
        icon: Workflow,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreOrganization),
      },
      {
        id: "coreCompanies",
        labelKey: "companies",
        href: TENANT_ROUTES.coreCompanies,
        icon: Building2,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreCompanies),
      },
      {
        id: "coreBranches",
        labelKey: "branches",
        href: TENANT_ROUTES.coreBranches,
        icon: Store,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreBranches),
      },
      {
        id: "coreDepartments",
        labelKey: "departments",
        href: TENANT_ROUTES.coreDepartments,
        icon: Network,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreDepartments),
      },
      {
        id: "coreTeams",
        labelKey: "teams",
        href: TENANT_ROUTES.coreTeams,
        icon: UsersRound,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreTeams),
      },
      {
        id: "coreUsers",
        labelKey: "users",
        href: TENANT_ROUTES.coreUsers,
        icon: UserCog,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreUsers),
      },
      {
        id: "coreRoles",
        labelKey: "roles",
        href: TENANT_ROUTES.coreRoles,
        icon: ShieldCheck,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreRoles),
      },
    ],
  },
  {
    // Directory, templates, activities and audit — MASTER-PLAN Phase 7.
    id: "coreOperations",
    labelKey: "operationsAndContent",
    items: [
      {
        id: "coreDirectory",
        labelKey: "partyDirectory",
        href: TENANT_ROUTES.coreDirectory,
        icon: Contact,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreDirectory),
      },
      {
        id: "coreDirectorySettings",
        labelKey: "coreDirectorySettings",
        href: TENANT_ROUTES.coreDirectorySettings,
        icon: SlidersHorizontal,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreDirectorySettings),
      },
      {
        id: "coreTemplates",
        labelKey: "templates",
        href: TENANT_ROUTES.coreTemplates,
        icon: LayoutTemplate,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreTemplates),
      },
      {
        id: "coreTemplateAssets",
        labelKey: "coreTemplateAssets",
        href: TENANT_ROUTES.coreTemplateAssets,
        icon: Images,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreTemplateAssets),
      },
      {
        id: "coreTemplateAssignments",
        labelKey: "coreTemplateAssignments",
        href: TENANT_ROUTES.coreTemplateAssignments,
        icon: Route,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreTemplateAssignments),
      },
      {
        id: "coreActivities",
        labelKey: "coreActivities",
        href: TENANT_ROUTES.coreActivities,
        icon: ListChecks,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreActivities),
      },
      {
        id: "coreAudit",
        labelKey: "coreAudit",
        href: TENANT_ROUTES.coreAudit,
        icon: ScrollText,
        hasAccess: (permissions) => canAccessCoreRoute(permissions, TENANT_ROUTES.coreAudit),
      },
    ],
  },
  {
    id: "coreSettings",
    labelKey: "coreSettings",
    items: [
      {
        id: "coreSettingsHub",
        labelKey: "coreSettingsHub",
        href: TENANT_ROUTES.coreSettings,
        icon: SquareStack,
        // The hub renders only the sections the caller may reach, and says so
        // when that set is empty — so it is reachable for anyone.
        hasAccess: () => true,
      },
      {
        id: "coreWorkspaceSettings",
        labelKey: "coreWorkspaceSettings",
        href: TENANT_ROUTES.coreSettingsWorkspace,
        icon: Settings,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreSettingsWorkspace),
      },
      {
        id: "coreCurrencies",
        labelKey: "coreCurrencies",
        href: TENANT_ROUTES.coreSettingsCurrencies,
        icon: Coins,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreSettingsCurrencies),
      },
      {
        id: "coreTaxes",
        labelKey: "coreTaxes",
        href: TENANT_ROUTES.coreSettingsTaxes,
        icon: Percent,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreSettingsTaxes),
      },
      {
        id: "coreNumbering",
        labelKey: "coreNumbering",
        href: TENANT_ROUTES.coreSettingsNumbering,
        icon: Hash,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreSettingsNumbering),
      },
      {
        id: "coreEmail",
        labelKey: "coreEmail",
        href: TENANT_ROUTES.coreSettingsEmail,
        icon: Mail,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreSettingsEmail),
      },
      {
        id: "coreBranding",
        labelKey: "coreBranding",
        href: TENANT_ROUTES.coreSettingsBranding,
        icon: Palette,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreSettingsBranding),
      },
    ],
  },
  {
    id: "coreBilling",
    labelKey: "coreBillingSection",
    items: [
      {
        id: "coreBilling",
        labelKey: "coreBilling",
        href: TENANT_ROUTES.coreBilling,
        icon: CreditCard,
        hasAccess: () => true,
        requiresTenantOwner: true,
      },
      {
        id: "coreBillingInvoices",
        labelKey: "coreBillingInvoices",
        href: TENANT_ROUTES.coreBillingInvoices,
        icon: ReceiptText,
        hasAccess: () => true,
        requiresTenantOwner: true,
      },
      {
        id: "coreSubscription",
        labelKey: "coreSubscription",
        href: TENANT_ROUTES.coreSubscription,
        icon: SquareStack,
        hasAccess: () => true,
        requiresTenantOwner: true,
      },
    ],
  },
  {
    id: "account",
    labelKey: null,
    items: [
      {
        id: "coreNotifications",
        labelKey: "coreNotifications",
        href: TENANT_ROUTES.coreNotifications,
        icon: Bell,
        hasAccess: (permissions) =>
          canAccessCoreRoute(permissions, TENANT_ROUTES.coreNotifications),
      },
      {
        id: "coreProfile",
        labelKey: "profile",
        href: TENANT_ROUTES.coreProfile,
        icon: CircleUser,
        // GET/PUT /users/me/profile declare no @RequirePermissions — every
        // authenticated tenant user owns their own preferences.
        hasAccess: () => true,
      },
      {
        id: "authentication",
        labelKey: "authentication",
        href: TENANT_ROUTES.coreSessions,
        icon: KeyRound,
        hasAccess: () => true,
      },
    ],
  },
];

/** The section a settings screen renders as its `SubNav`. */
export const CORE_SETTINGS_NAV_ITEMS: NavItem[] =
  NAV_SECTIONS.find((section) => section.id === "coreSettings")?.items ?? [];

/** The `SubNav` the billing, invoice and subscription screens render. */
export const CORE_BILLING_NAV_ITEMS: NavItem[] =
  NAV_SECTIONS.find((section) => section.id === "coreBilling")?.items ?? [];

/** The section an organization, users or roles screen renders as its `SubNav`. */
export const CORE_IDENTITY_NAV_ITEMS: NavItem[] =
  NAV_SECTIONS.find((section) => section.id === "coreIdentity")?.items ?? [];

const CORE_OPERATIONS_ITEMS: NavItem[] =
  NAV_SECTIONS.find((section) => section.id === "coreOperations")?.items ?? [];

const operationsItems = (...ids: string[]): NavItem[] =>
  ids.flatMap((id) => CORE_OPERATIONS_ITEMS.filter((item) => item.id === id));

/** The `SubNav` the directory list, detail and settings screens render. */
export const CORE_DIRECTORY_NAV_ITEMS: NavItem[] = operationsItems(
  "coreDirectory",
  "coreDirectorySettings",
);

/** The `SubNav` the template definition, asset and assignment screens render. */
export const CORE_TEMPLATE_NAV_ITEMS: NavItem[] = operationsItems(
  "coreTemplates",
  "coreTemplateAssets",
  "coreTemplateAssignments",
);

/** The `SubNav` every Trade foundation screen renders. */
export const TRADE_FOUNDATION_NAV_ITEMS: NavItem[] =
  NAV_SECTIONS.find((section) => section.id === "tradeFoundation")?.items ?? [];

/** The `SubNav` every Trade commercial-document screen renders. */
export const TRADE_DOCUMENT_NAV_ITEMS: NavItem[] =
  NAV_SECTIONS.find((section) => section.id === "tradeDocuments")?.items ?? [];
