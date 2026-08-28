"use client";

import Link from "next/link";
import { Lock, TrendingUp } from "lucide-react";
import { PageHeader } from "@/design-system";
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
  const destinations = [
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
