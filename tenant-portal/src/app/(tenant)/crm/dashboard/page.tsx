"use client";

import Link from "next/link";
import {
  Button,
  EmptyState,
  ErrorState,
  hasPermission,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { DashboardWorkspace } from "../dashboards/[id]/components/dashboard-workspace";
import { useDefaultDashboard } from "./hooks/useDefaultDashboard";

export default function CrmDefaultDashboardPage() {
  const { user } = useTenantAuth();
  const enabled = Boolean(user?.isTenantOwner) ||
    hasPermission(user?.permissions ?? [], "crm.dashboards.read", true);

  return (
    <PermissionGate require={user?.isTenantOwner ? [] : "crm.dashboards.read"} scoped>
      <DefaultDashboardContent enabled={enabled} />
    </PermissionGate>
  );
}

function DefaultDashboardContent({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const { dashboardId, setDashboardId, isLoading, isEmpty, error, loadDefaultDashboard } =
    useDefaultDashboard(enabled);

  return (
      <div className="flex flex-col gap-4">
        {isLoading && !dashboardId ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2">
            <EmptyState title={t.crmDashboards.empty} description={t.crmDashboards.subtitle} />
            <Button asChild variant="outline">
              <Link href={TENANT_ROUTES.crmDashboards}>{t.crmDashboards.backToList}</Link>
            </Button>
          </div>
        ) : error ? (
          <ErrorState
            title={t.crmDashboards.loadFailed}
            description={t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed}
            onRetry={() => void loadDefaultDashboard()}
            retryLabel={t.common.retry}
          />
        ) : dashboardId ? (
          <DashboardWorkspace
            key={dashboardId}
            dashboardId={dashboardId}
            onSelectDashboard={(nextId) => setDashboardId(nextId)}
          />
        ) : null}
      </div>
  );
}
