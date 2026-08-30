"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Database, HardDrive, ReceiptText, RefreshCw, Settings2, Users } from "lucide-react";
import { Badge, Button, Card } from "@/design-system";
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
import { TenantStorageMigrationPanel } from "./storage";

type WorkspaceTab = "overview" | "provisioning" | "access" | "billing" | "storage";

export function TenantWorkspaceScreen({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { lang, dir } = useI18n();
  const copy = workspaceCopy[lang];
  const activePanelRef = useRef<HTMLDivElement>(null);
  const mutationErrorRef = useRef<HTMLDivElement>(null);
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
  // A deleted tenant runs nothing. Provisioning commands and storage
  // migrations both refuse it, so those panels are closed rather than left to
  // fail one request at a time. Overview stays open: it carries the lifecycle
  // controls, including restore.
  const deleted = tenant?.status === "DELETED";
  const unavailableTab = (tab: WorkspaceTab): boolean =>
    (tab === "access" && !databaseReady) ||
    (deleted && (tab === "provisioning" || tab === "storage"));
  const activeTab: WorkspaceTab = !selection.userSelected && provisioningDefault
    ? "provisioning"
    : unavailableTab(selection.tab)
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

  useEffect(() => {
    if (selection.userSelected) activePanelRef.current?.focus();
  }, [activeTab, selection.userSelected]);

  useEffect(() => {
    if (core.mutation.error) mutationErrorRef.current?.focus();
  }, [core.mutation.error]);

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
          <Button type="button" variant="primary" className="mt-4" onClick={() => void core.refresh()}>{copy.retry}</Button>
        </WorkspaceState>
      </PageFrame>
    );
  }

  // Each disabled tab points at the note that explains its own reason, so a
  // screen reader does not hear the access explanation on the storage tab.
  const DELETED_HINT_ID = "tenant-deleted-unavailable";
  const ACCESS_HINT_ID = "tenant-access-unavailable";
  const tabs: Array<{
    key: WorkspaceTab;
    label: string;
    icon: typeof Settings2;
    disabled?: boolean;
    hintId?: string;
  }> = [
    { key: "overview", label: copy.overview, icon: Settings2 },
    {
      key: "provisioning",
      label: copy.provisioning,
      icon: Database,
      disabled: deleted,
      hintId: DELETED_HINT_ID,
    },
    {
      key: "access",
      label: copy.access,
      icon: Users,
      disabled: !databaseReady,
      hintId: deleted ? DELETED_HINT_ID : ACCESS_HINT_ID,
    },
    { key: "billing", label: copy.billing, icon: ReceiptText },
    {
      key: "storage",
      label: copy.storage,
      icon: HardDrive,
      disabled: deleted,
      hintId: DELETED_HINT_ID,
    },
  ];

  return (
    <PageFrame>
      <div dir={dir} className="space-y-4">
        <Button type="button" variant="link" className="px-0" onClick={() => router.push("/tenants")}>
          {dir === "rtl" ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
          {copy.back}
        </Button>

        <header>
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">{copy.tenantWorkspace}</p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">{tenant.companyName}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{tenant.name} · {tenant.id}</p>
            </div>
            <div
              className="text-end"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-busy={core.isPolling || undefined}
            >
              <Badge tone={statusTone(tenant.status)} className="font-mono">{tenant.status}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">{databaseReady ? copy.databaseReady : copy.databaseNotReady}</p>
              {tenant.status === "PROVISIONING" && core.isPolling ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {copy.polling}
                </p>
              ) : null}
              {core.pollExhausted ? <Button type="button" variant="link" size="sm" className="mt-1 px-0" onClick={() => void core.refresh()}>{copy.resumePolling}</Button> : null}
            </div>
          </div>
        </Card>
        </header>

        <nav className="overflow-x-auto rounded-lg border border-border bg-card p-2" aria-label={copy.sectionsLabel} tabIndex={0}>
          <div className="flex min-w-max gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                type="button"
                disabled={tab.disabled}
                aria-current={selected ? "page" : undefined}
                aria-describedby={tab.disabled ? tab.hintId : undefined}
                variant={selected ? "primary" : "ghost"}
                size="lg"
                className="min-w-max"
                onClick={() => {
                  setTabSelection({
                    tenantId,
                    tab: tab.key,
                    userSelected: true,
                  });
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {tab.label}
              </Button>
            );
          })}
          </div>
        </nav>
        {deleted ? (
          <p id={DELETED_HINT_ID} className="text-xs text-muted-foreground">{copy.deletedSections}</p>
        ) : !databaseReady ? (
          <p id={ACCESS_HINT_ID} className="text-xs text-muted-foreground">{copy.accessNotReady}</p>
        ) : null}

        {core.mutation.error ? (
          <div ref={mutationErrorRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p>{core.mutation.error.message}</p>
            <p className="mt-1 font-mono text-xs">{core.mutation.error.errorCode}{core.mutation.error.correlationId ? ` · ${copy.correlation}: ${core.mutation.error.correlationId}` : ""}</p>
          </div>
        ) : null}

        <div
          ref={activePanelRef}
          id={`tenant-workspace-panel-${activeTab}`}
          role="region"
          aria-label={tabs.find((item) => item.key === activeTab)?.label}
          tabIndex={-1}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
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
        {activeTab === "storage" ? <TenantStorageMigrationPanel /> : null}
        </div>
      </div>
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1600px]">{children}</div>;
}

function WorkspaceState({ children, alert = false }: { children: React.ReactNode; alert?: boolean }) {
  return <div role={alert ? "alert" : "status"} className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function statusTone(status: string): "success" | "danger" | "warn" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "PROVISIONING_FAILED") return "danger";
  if (status === "SUSPENDED") return "warn";
  return "neutral";
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
    sectionsLabel: "Tenant workspace sections",
    databaseReady: "Tenant database ready",
    databaseNotReady: "Tenant database access is not ready",
    polling: "Provisioning status is refreshing automatically.",
    resumePolling: "Resume status checks",
    overview: "Overview & domains",
    provisioning: "Provisioning",
    access: "Users & access",
    billing: "Billing",
    storage: "Storage",
    accessNotReady: "Users and access become available when the tenant is ACTIVE or SUSPENDED.",
    deletedSections: "This tenant is deleted. Provisioning, users and storage stay closed until it is restored.",
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
    sectionsLabel: "أقسام مساحة عمل المستأجر",
    databaseReady: "قاعدة بيانات المستأجر جاهزة",
    databaseNotReady: "الوصول إلى قاعدة بيانات المستأجر غير جاهز",
    polling: "يتم تحديث حالة التجهيز تلقائياً.",
    resumePolling: "استئناف فحص الحالة",
    overview: "النظرة العامة والنطاقات",
    provisioning: "التجهيز",
    access: "المستخدمون والوصول",
    billing: "الفوترة",
    storage: "التخزين",
    accessNotReady: "يتاح المستخدمون والوصول عندما تصبح حالة المستأجر ACTIVE أو SUSPENDED.",
    deletedSections: "هذا المستأجر محذوف. تظل أقسام التجهيز والمستخدمين والتخزين مغلقة حتى تتم استعادته.",
  },
} as const;
