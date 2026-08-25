"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FolderGit2,
  GitCommit,
  Kanban,
  Settings,
  Share2,
  Sliders,
  UserCircle,
} from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  TENANT_ROUTES,
  canAccessCrmRoute,
} from "@/lib/navigation/tenant-routes";

export function CrmNavbarLinks() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const items = [
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmLeads)
      ? [
          {
            label: t.nav.leads || "Leads",
            href: TENANT_ROUTES.crmLeads,
            icon: FolderGit2,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmCustomerProfiles)
      ? [
          {
            label: t.nav.customerProfiles || "Customers",
            href: TENANT_ROUTES.crmCustomerProfiles,
            icon: UserCircle,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmPipeline)
      ? [
          {
            label: t.nav.salesPipelineWorkspace || "Pipeline",
            href: TENANT_ROUTES.crmPipeline,
            icon: Kanban,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmStaticCatalogue)
      ? [
          {
            label: t.nav.staticData || "Catalogue",
            href: TENANT_ROUTES.crmStaticCatalogue,
            icon: Database,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmLeadStages)
      ? [
          {
            label: t.nav.leadStages || "Lead Stages",
            href: TENANT_ROUTES.crmLeadStages,
            icon: GitCommit,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmAcquisitionSources)
      ? [
          {
            label: t.nav.acquisitionSources || "Acquisition Sources",
            href: TENANT_ROUTES.crmAcquisitionSources,
            icon: Share2,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmCustomFields)
      ? [
          {
            label: t.nav.customFields || "Custom Fields",
            href: TENANT_ROUTES.crmCustomFields,
            icon: Sliders,
          },
        ]
      : []),
    ...(canAccessCrmRoute(permissions, TENANT_ROUTES.crmSettings)
      ? [
          {
            label: t.nav.crmSettings || "CRM Settings",
            href: TENANT_ROUTES.crmSettings,
            icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <nav className="flex items-center gap-1" aria-label="CRM">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href === TENANT_ROUTES.crmCustomerProfiles &&
            pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "border border-blue-200/80 bg-blue-50 text-blue-600 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-400"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
