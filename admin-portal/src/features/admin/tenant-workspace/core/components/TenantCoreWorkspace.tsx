"use client";

import { useTenantCoreWorkspace } from "../hooks/useTenantCoreWorkspace";
import { useTenantFqdnManagement } from "../hooks/useTenantFqdnManagement";
import { isTenantDatabaseReady } from "../model/readers";
import { TenantFqdnPanel } from "./TenantFqdnPanel";
import { TenantLifecyclePanel } from "./TenantLifecyclePanel";
import { TenantProfilePanel } from "./TenantProfilePanel";
import {
  tenantWorkspaceCopy,
  type TenantWorkspaceLocale,
} from "./copy";

export interface TenantCoreWorkspaceProps {
  tenantId: string;
  locale?: TenantWorkspaceLocale;
  onDestroyed?: () => void;
  pollIntervalMs?: number;
  maxProvisioningPolls?: number;
}

export function TenantCoreWorkspace({
  tenantId,
  locale = "en",
  onDestroyed,
  pollIntervalMs,
  maxProvisioningPolls,
}: TenantCoreWorkspaceProps) {
  const text = tenantWorkspaceCopy(locale);
  const workspace = useTenantCoreWorkspace(tenantId, {
    pollIntervalMs,
    maxProvisioningPolls,
  });
  const fqdn = useTenantFqdnManagement({
    tenantId,
    tenant: workspace.tenant,
    permissions: workspace.permissions,
    replaceTenant: workspace.replaceTenant,
    refreshTenant: workspace.refresh,
  });

  if (
    workspace.resourceState === "loading" ||
    workspace.resourceState === "idle"
  ) {
    return (
      <WorkspaceState locale={locale} role="status">
        {text.loading}
      </WorkspaceState>
    );
  }
  if (workspace.resourceState === "forbidden") {
    return (
      <WorkspaceState locale={locale} role="alert">
        {text.forbidden}
      </WorkspaceState>
    );
  }
  if (workspace.resourceState === "destroyed") {
    return (
      <WorkspaceState locale={locale} role="status">
        {text.destroyed}
      </WorkspaceState>
    );
  }
  if (workspace.resourceState === "error" || !workspace.tenant) {
    return (
      <WorkspaceState locale={locale} role="alert">
        <p>{workspace.loadError?.message ?? "Tenant data is unavailable."}</p>
        {workspace.loadError?.correlationId && (
          <p className="mt-1 font-mono text-xs">
            {text.correlation}: {workspace.loadError.correlationId}
          </p>
        )}
        <button
          type="button"
          onClick={() => void workspace.refresh()}
          className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {text.retry}
        </button>
      </WorkspaceState>
    );
  }

  const tenant = workspace.tenant;
  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="space-y-4 text-slate-900 dark:text-slate-100"
      data-testid="tenant-core-workspace"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
            {text.title}
          </p>
          <h1 className="mt-1 text-lg font-semibold">{tenant.companyName}</h1>
          <p className="font-mono text-xs text-slate-500">
            {tenant.name} · {tenant.id}
          </p>
        </div>
        <div className="text-end">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold dark:bg-slate-800">
            {tenant.status}
          </span>
          <p className="mt-1 text-xs text-slate-500">
            {isTenantDatabaseReady(tenant)
              ? locale === "ar"
                ? "قاعدة بيانات المستأجر جاهزة"
                : "Tenant database ready"
              : locale === "ar"
                ? "الوصول لقاعدة المستأجر غير متاح بعد"
                : "Tenant database access is not ready"}
          </p>
        </div>
      </header>

      {workspace.mutation.error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <p>{workspace.mutation.error.message}</p>
          {workspace.mutation.error.correlationId && (
            <p className="mt-1 font-mono text-xs">
              {text.correlation}: {workspace.mutation.error.correlationId}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TenantLifecyclePanel
          locale={locale}
          workspace={workspace}
          onDestroyed={onDestroyed}
        />
        <TenantFqdnPanel
          locale={locale}
          tenant={tenant}
          permissions={workspace.permissions}
          fqdn={fqdn}
        />
      </div>
      <TenantProfilePanel locale={locale} workspace={workspace} />
    </div>
  );
}

function WorkspaceState({
  locale,
  role,
  children,
}: {
  locale: TenantWorkspaceLocale;
  role: "status" | "alert";
  children: React.ReactNode;
}) {
  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      role={role}
      className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    >
      {children}
    </div>
  );
}
