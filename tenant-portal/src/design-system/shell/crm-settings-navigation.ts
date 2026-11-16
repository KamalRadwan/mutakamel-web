import { NAV_SECTIONS, type NavItem } from "./nav-config";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export function isCrmAnalyticsPath(pathname: string): boolean {
  return [TENANT_ROUTES.crmDashboard, TENANT_ROUTES.crmDashboards, TENANT_ROUTES.crmWidgets]
    .some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export function crmSettingsDestination(items: readonly NavItem[]): NavItem | undefined {
  return items.find((item) => item.id === "leadStages") ?? items[0];
}

/** Analytics and record workspaces keep their full width outside Settings. */
export function isCrmSettingsPath(pathname: string): boolean {
  let sectionId: string | undefined;
  let matchedLength = -1;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && item.href.length > matchedLength) {
        sectionId = section.id;
        matchedLength = item.href.length;
      }
    }
  }
  return sectionId === "crmSetup";
}

export const CRM_SETTINGS_GROUPS = [
  { label: "sales", ids: ["leadStages", "pipelines", "opportunityStages", "acquisitionSources", "crmTags"] },
  { label: "data", ids: ["customFields", "outboundEmails", "crmSettings", "staticData"] },
] as const;
