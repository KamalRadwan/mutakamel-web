import {
  Database,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { canAccessCrmRoute, TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

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
}

export interface NavSection {
  id: string;
  labelKey: string | null; // null: no section heading (Workspace)
  items: NavItem[];
}

// Single source of truth — useNavTree.ts filters this against the
// authenticated permission set. Only server-backed routes appear; the 45
// sealed routes are deleted, not hidden. See docs/design/shell.md#navigation-map.
//
// Pipeline still points at /crm/pipeline, not the target /crm/opportunities
// rename shell.md calls for — the physical route, its feature hook, and
// tenant-routes.ts all still say "pipeline" today. Renaming only the nav
// entry would point at a route that 404s. Do the rename as one atomic
// change in phase 4 when that screen converts.
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
        id: "pipeline",
        labelKey: "salesPipelineWorkspace",
        href: TENANT_ROUTES.crmPipeline,
        icon: TrendingUp,
        hasAccess: (permissions) => canAccessCrmRoute(permissions, TENANT_ROUTES.crmPipeline),
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
  {
    id: "account",
    labelKey: null,
    items: [
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
