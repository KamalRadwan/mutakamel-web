"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ErrorState,
  hasPermission,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  DASHBOARDS_DEFAULT_PATH,
  DASHBOARDS_NAVIGATION_PATH,
  parseDashboardDetailResponse,
  parseNavigationResponse,
} from "../dashboards/dashboard-contract";
import { DashboardWorkspace } from "../dashboards/[id]/components/dashboard-workspace";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;

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
  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const loadDefaultDashboard = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const navigationResponse = await axiosClient.get<unknown>(DASHBOARDS_NAVIGATION_PATH, {
        ...READ_CONFIG,
        signal,
      });
      if (signal?.aborted) return;
      const navigation = parseNavigationResponse(navigationResponse.data);
      if (navigation.activeDashboardId) {
        setDashboardId(navigation.activeDashboardId);
        return;
      }

      const response = await axiosClient.get<unknown>(DASHBOARDS_DEFAULT_PATH, {
        ...READ_CONFIG,
        signal,
      });
      if (signal?.aborted) return;
      const detail = parseDashboardDetailResponse(response.data);
      setDashboardId(detail.id);
    } catch (caught) {
      if (signal?.aborted) return;
      setError(normalizeApiError(caught));
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadDefaultDashboard(controller.signal);
      }
    });
    return () => controller.abort();
  }, [enabled, loadDefaultDashboard]);

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
