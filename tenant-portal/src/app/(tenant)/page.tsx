"use client";

import Link from "next/link";
import { Compass, Lock, Search, TrendingUp } from "lucide-react";
import { PageHeader, cn, proseMeasure } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  TENANT_ROUTES,
  getFirstPermittedCrmRoute,
} from "@/lib/navigation/tenant-routes";

// Not a dashboard — there is no metrics endpoint. A launcher. Only
// permitted destinations render, no disabled tiles — see
// docs/design/DESIGN-SYSTEM.md#72-workspace-home--.
export default function DashboardPage() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const crmEntryRoute = getFirstPermittedCrmRoute(user?.permissions ?? []);
  // A tenant with no branch cannot load a single CRM list — `branchId` is
  // required on every one of them — so a launcher that only offers those lists
  // is a dead end. `/auth/me` already answers this, at no request cost:
  // `accessibleBranches` is derived straight from the `branches` table for an
  // owner. MASTER-PLAN 13.23.
  const needsFirstRun = (user?.accessibleBranches.length ?? 0) === 0;
  const destinations = [
    {
      href: TENANT_ROUTES.search,
      icon: Search,
      title: t.workspaceHome.searchTitle,
      description: t.workspaceHome.searchDescription,
    },
    {
      href: TENANT_ROUTES.coreSessions,
      icon: Lock,
      title: t.workspaceHome.sessionsTitle,
      description: t.workspaceHome.sessionsDescription,
    },
    ...(crmEntryRoute
      ? [
          {
            href: crmEntryRoute,
            icon: TrendingUp,
            title: t.workspaceHome.crmTitle,
            description: t.workspaceHome.crmDescription,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={user ? t.workspaceHome.greeting(`${user.firstName} ${user.lastName}`) : ""}
        description={t.workspaceHome.subtitle}
      />

      {needsFirstRun ? (
        <Link
          href={TENANT_ROUTES.gettingStarted}
          className="flex items-start gap-3 rounded-md border border-primary bg-card p-4 transition-colors hover:bg-accent"
        >
          <Compass className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {t.workspaceHome.firstRunTitle}
            </span>
            <span className={cn("text-xs text-muted-foreground", proseMeasure)}>
              {t.workspaceHome.firstRunDescription}
            </span>
          </span>
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {destinations.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-md border border-border bg-card p-4 transition-colors hover:border-ink-300 hover:bg-accent"
          >
            <Icon className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h2 className="mt-2 text-sm font-medium text-foreground">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
