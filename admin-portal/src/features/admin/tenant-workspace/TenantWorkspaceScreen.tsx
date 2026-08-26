"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Database, ReceiptText, Settings2, Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { TenantAccessPanel } from "./access";
import { TenantBillingPanel } from "./billing/components/TenantBillingPanel";
import { useTenantBillingWorkspace } from "./billing/hooks/useTenantBillingWorkspace";
import { TenantFqdnPanel } from "./core/components/TenantFqdnPanel";
import { TenantLifecyclePanel } from "./core/components/TenantLifecyclePanel";
import { TenantProfilePanel } from "./core/components/TenantProfilePanel";
import { useTenantCoreWorkspace } from "./core/hooks/useTenantCoreWorkspace";
import { useTenantFqdnManagement } from "./core/hooks/useTenantFqdnManagement";
import { isTenantDatabaseReady } from "./core/model/readers";
import { TenantProvisioningWorkspace } from "./provisioning";

type WorkspaceTab = "overview" | "provisioning" | "access" | "billing";

export function TenantWorkspaceScreen({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { lang, dir } = useI18n();
  const copy = workspaceCopy[lang];
  const [tabSelection, setTabSelection] = useState<{
    tenantId: string;
    tab: WorkspaceTab;
    userSelected: boolean;
  }>({ tenantId, tab: "overview", userSelected: false });
  const selection = tabSelection.tenantId === tenantId
    ? tabSelection
    : { tenantId, tab: "overview" as const, userSelected: false };
  const core = useTenantCoreWorkspace(tenantId);
  const tenant = core.tenant;
  const databaseReady = tenant ? isTenantDatabaseReady(tenant) : false;
  const provisioningDefault =
    tenant?.status === "PROVISIONING" ||
    tenant?.status === "PROVISIONING_FAILED";
  const activeTab: WorkspaceTab = !selection.userSelected && provisioningDefault
    ? "provisioning"
    : selection.tab === "access" && !databaseReady
      ? provisioningDefault
        ? "provisioning"
        : "overview"
      : selection.tab;
  const fqdn = useTenantFqdnManagement({
    tenantId,
    tenant,
    permissions: core.permissions,
    replaceTenant: core.replaceTenant,
    refreshTenant: core.refresh,
  });
  const billing = useTenantBillingWorkspace(tenantId, {
    enabled: activeTab === "billing",
  });

  if (core.resourceState === "loading" || core.resourceState === "idle") {
    return <PageFrame><WorkspaceState>{copy.loading}</WorkspaceState></PageFrame>;
  }
  if (core.resourceState === "forbidden") {
    return <PageFrame><WorkspaceState alert>{copy.forbidden}</WorkspaceState></PageFrame>;
  }
  if (core.resourceState === "destroyed") {
    return <PageFrame><WorkspaceState>{copy.destroyed}</WorkspaceState></PageFrame>;
  }
  if (core.resourceState === "error" || !tenant) {
    return (
      <PageFrame>
        <WorkspaceState alert>
          <p>{core.loadError?.message ?? copy.unavailable}</p>
          {core.loadError?.correlationId ? <p className="mt-2 font-mono text-xs">{copy.correlation}: {core.loadError.correlationId}</p> : null}
          <button type="button" className="primary-button mt-4" onClick={() => void core.refresh()}>{copy.retry}</button>
        </WorkspaceState>
      </PageFrame>
    );
  }

  const tabs: Array<{ key: WorkspaceTab; label: string; icon: typeof Settings2; disabled?: boolean; hint?: string }> = [
    { key: "overview", label: copy.overview, icon: Settings2 },
    { key: "provisioning", label: copy.provisioning, icon: Database },
    {
      key: "access",
      label: copy.access,
      icon: Users,
      disabled: !databaseReady,
      hint: !databaseReady ? copy.accessNotReady : undefined,
    },
    { key: "billing", label: copy.billing, icon: ReceiptText },
  ];

  return (
    <PageFrame>
      <div dir={dir} className="space-y-4">
        <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white" onClick={() => router.push("/tenants")}>
          {dir === "rtl" ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          {copy.back}
        </button>

        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{copy.tenantWorkspace}</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{tenant.companyName}</h1>
              <p className="mt-1 font-mono text-xs text-slate-500">{tenant.name} · {tenant.id}</p>
            </div>
            <div className="text-end">
              <span className={statusClass(tenant.status)}>{tenant.status}</span>
              <p className="mt-2 text-xs text-slate-500">{databaseReady ? copy.databaseReady : copy.databaseNotReady}</p>
              {tenant.status === "PROVISIONING" && core.isPolling ? <p className="mt-1 text-xs text-indigo-600">{copy.polling}</p> : null}
              {core.pollExhausted ? <button type="button" className="mt-1 text-xs font-semibold text-indigo-600 underline" onClick={() => void core.refresh()}>{copy.resumePolling}</button> : null}
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950" aria-label={copy.tenantWorkspace}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                title={tab.hint}
                disabled={tab.disabled}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex min-w-max items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${selected ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"} disabled:cursor-not-allowed disabled:opacity-45`}
                onClick={() => {
                  setTabSelection({
                    tenantId,
                    tab: tab.key,
                    userSelected: true,
                  });
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {core.mutation.error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p>{core.mutation.error.message}</p>
            <p className="mt-1 font-mono text-xs">{core.mutation.error.errorCode}{core.mutation.error.correlationId ? ` · ${copy.correlation}: ${core.mutation.error.correlationId}` : ""}</p>
          </div>
        ) : null}

        {activeTab === "overview" ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <TenantLifecyclePanel
                locale={lang}
                workspace={core}
                onDestroyed={() => router.replace("/tenants")}
              />
              <TenantFqdnPanel
                locale={lang}
                tenant={tenant}
                permissions={core.permissions}
                fqdn={fqdn}
              />
            </div>
            <TenantProfilePanel locale={lang} workspace={core} />
          </div>
        ) : null}
        {activeTab === "provisioning" ? <TenantProvisioningWorkspace tenantId={tenantId} /> : null}
        {activeTab === "access" && databaseReady ? (
          <TenantAccessPanel tenantId={tenantId} tenantStatus={tenant.status} enabled locale={lang} />
        ) : null}
        {activeTab === "billing" ? <TenantBillingPanel workspace={billing} lang={lang} /> : null}
      </div>
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1600px]">{children}</div>;
}

function WorkspaceState({ children, alert = false }: { children: React.ReactNode; alert?: boolean }) {
  return <div role={alert ? "alert" : "status"} className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{children}</div>;
}

function statusClass(status: string): string {
  const tone = status === "ACTIVE"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    : status === "PROVISIONING_FAILED"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
      : status === "PROVISIONING"
        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return `inline-flex rounded-full px-3 py-1 font-mono text-xs font-semibold ${tone}`;
}

const workspaceCopy = {
  en: {
    loading: "Loading tenant workspace…",
    forbidden: "You do not have permission to view this tenant.",
    destroyed: "This tenant was permanently destroyed.",
    unavailable: "Tenant data is unavailable.",
    correlation: "Correlation ID",
    retry: "Retry",
    back: "Back to tenants",
    tenantWorkspace: "Tenant workspace",
    databaseReady: "Tenant database ready",
    databaseNotReady: "Tenant database access is not ready",
    polling: "Provisioning status is refreshing automatically.",
    resumePolling: "Resume status checks",
    overview: "Overview & domains",
    provisioning: "Provisioning",
    access: "Users & access",
    billing: "Billing",
    accessNotReady: "Users and access become available when the tenant is ACTIVE or SUSPENDED.",
  },
  ar: {
    loading: "جارٍ تحميل مساحة المستأجر…",
    forbidden: "لا تملك صلاحية عرض هذا المستأجر.",
    destroyed: "تم حذف هذا المستأجر نهائياً.",
    unavailable: "بيانات المستأجر غير متاحة.",
    correlation: "معرّف الارتباط",
    retry: "إعادة المحاولة",
    back: "العودة إلى المستأجرين",
    tenantWorkspace: "مساحة عمل المستأجر",
    databaseReady: "قاعدة بيانات المستأجر جاهزة",
    databaseNotReady: "الوصول إلى قاعدة بيانات المستأجر غير جاهز",
    polling: "يتم تحديث حالة التجهيز تلقائياً.",
    resumePolling: "استئناف فحص الحالة",
    overview: "النظرة العامة والنطاقات",
    provisioning: "التجهيز",
    access: "المستخدمون والوصول",
    billing: "الفوترة",
    accessNotReady: "يتاح المستخدمون والوصول عندما تصبح حالة المستأجر ACTIVE أو SUSPENDED.",
  },
} as const;
