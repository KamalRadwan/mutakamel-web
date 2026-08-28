export const TENANT_ROUTES = {
  home: "/",
  core: "/core",
  coreSessions: "/core/authentication",
  coreWebphoneSettings: "/core/settings/webphone",
  crm: "/crm",
  crmHome: "/crm",
  crmLeads: "/crm/leads",
  crmCustomerProfiles: "/crm/customer-profiles",
  crmPipeline: "/crm/pipeline",
  crmStaticCatalogue: "/crm/static-data-catalogue",
  crmLeadStages: "/crm/lead-stages",
  crmAcquisitionSources: "/crm/acquisition-sources",
  crmCustomFields: "/crm/custom-fields",
  crmSettings: "/crm/settings",
  trade: "/trade",
} as const;

const CRM_EXACT_PATHS = new Set<string>([
  TENANT_ROUTES.crm,
  TENANT_ROUTES.crmLeads,
  TENANT_ROUTES.crmCustomerProfiles,
  TENANT_ROUTES.crmPipeline,
  TENANT_ROUTES.crmStaticCatalogue,
  TENANT_ROUTES.crmLeadStages,
  TENANT_ROUTES.crmAcquisitionSources,
  TENANT_ROUTES.crmCustomFields,
  TENANT_ROUTES.crmSettings,
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
    href: TENANT_ROUTES.crmPipeline,
    requirements: [
      {
        permission: "crm.opportunities.read",
        acceptsScopedPermission: true,
      },
      { permission: "crm.pipelines.read", acceptsScopedPermission: false },
    ],
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

// WebPhone settings are reachable even for a workspace that has not subscribed:
// the screen renders disabled and states why, so the capability stays
// discoverable instead of vanishing behind a redirect.
const CORE_EXACT_PATHS = new Set<string>([
  TENANT_ROUTES.core,
  TENANT_ROUTES.coreSessions,
  TENANT_ROUTES.coreWebphoneSettings,
]);

export function isSupportedCorePath(pathname: string): boolean {
  return CORE_EXACT_PATHS.has(pathname);
}

export function isSupportedCrmPath(pathname: string): boolean {
  return (
    CRM_EXACT_PATHS.has(pathname) ||
    /^\/crm\/customer-profiles\/[^/]+$/u.test(pathname)
  );
}

export function isSupportedTradePath(pathname: string): boolean {
  return pathname === TENANT_ROUTES.trade;
}
