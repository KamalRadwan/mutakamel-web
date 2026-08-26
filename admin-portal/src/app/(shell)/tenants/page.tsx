"use client";

import Link from "next/link";
import {
  ExternalLink,
  Globe,
  HardDrive,
  Loader2,
  Plus,
  RotateCcw,
  Server,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  ErrorState,
  FilterBar,
  PageHeader,
  type ColumnDef,
} from "@/design-system";
import {
  useTenants,
  type TenantDirectoryModalAction,
  type TenantRecord,
  type TenantStatusFilter,
} from "./hooks/useTenants";

export default function TenantsDirectoryPage() {
  const {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serverFilter,
    setServerFilter,
    databaseServerOptions,
    databaseServerOptionsState,
    databaseServerOptionsError,
    retryDatabaseServerOptions,
    page,
    setPage,
    limit,
    tenants,
    totalItems,
    pagination,
    activeModalTenant,
    modalActionType,
    closeModal,
    confirmModalAction,
    openActivateModal,
    openSuspendModal,
    openDeleteModal,
    handleReprovision,
    refresh,
    isLoading,
    loadError,
    actionError,
    clearActionError,
    pendingAction,
    permissions,
  } = useTenants();
  const { lang } = useI18n();
  const copy = directoryCopy(lang);

  const columns: ColumnDef<TenantRecord>[] = [
    {
      key: "tenant",
      headerEn: "Tenant",
      headerAr: "المستأجر",
      cell: (tenant) => (
        <Link href={`/tenants/${tenant.id}`} className="group inline-flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-brand-700 group-hover:underline dark:text-brand-400">
              {tenant.companyName}
            </span>
            <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-muted-foreground dark:bg-ink-800">
              {tenant.name}
            </span>
          </div>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {tenant.ownerEmail ?? "—"}
          </span>
        </Link>
      ),
    },
    {
      key: "fqdn",
      headerEn: "Primary FQDN",
      headerAr: "النطاق الأساسي",
      cell: (tenant) => (
        <div className="flex items-center gap-1.5">
          <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">{tenant.primaryFqdn ?? "—"}</span>
          {tenant.secondaryFqdnsCount > 0 ? (
            <span className="text-xs text-muted-foreground">+{tenant.secondaryFqdnsCount}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "infrastructure",
      headerEn: "Infrastructure",
      headerAr: "البنية التحتية",
      cell: (tenant) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5" title={copy.databaseServer}>
            <Server className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {tenant.databaseServerName ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5" title={copy.storageServer}>
            <HardDrive className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {tenant.storageServer?.name ?? tenant.storageServerId}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{tenant.countryName}</div>
        </div>
      ),
    },
    {
      key: "subscription",
      headerEn: "Subscription",
      headerAr: "الاشتراك",
      cell: (tenant) => (
        <div>
          <span className="text-xs font-semibold text-foreground">{tenant.subscriptionStatus ?? "—"}</span>
          <div className="font-mono text-xs text-muted-foreground">
            {tenant.seats === null ? "—" : copy.seats(tenant.seats)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (tenant) => <TenantStatusBadge status={tenant.status} lang={lang} />,
    },
    {
      key: "actions",
      headerEn: "Actions",
      headerAr: "الإجراءات",
      align: "end",
      cell: (tenant) => (
        <TenantRowActions
          tenant={tenant}
          copy={copy}
          canSuspendOrActivate={permissions.canSuspendOrActivate}
          canReprovision={permissions.canReprovision}
          canSoftDelete={permissions.canSoftDelete}
          pendingAction={pendingAction}
          onActivate={openActivateModal}
          onSuspend={openSuspendModal}
          onDelete={openDeleteModal}
          onReprovision={handleReprovision}
        />
      ),
    },
  ];

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={t.tenants.pageTitle}
        description={t.tenants.pageSubtitle}
        status={<Badge tone="neutral">{copy.isolation}</Badge>}
        action={
          permissions.canCreate ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/tenants/new">
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tenants.registerTenant}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {loadError ? (
        <ErrorState error={loadError} onRetry={() => void refresh()} />
      ) : null}
      {actionError && !activeModalTenant ? (
        <ErrorBanner
          message={actionError.message}
          errorCode={actionError.errorCode}
          correlationId={actionError.correlationId}
          dismissLabel={copy.dismiss}
          onDismiss={clearActionError}
        />
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <FilterBar
              fields={[
                {
                  key: "search",
                  type: "search",
                  placeholderEn: "Search name, company, country, database, or owner email",
                  placeholderAr: "ابحث بالاسم أو الشركة أو الدولة أو قاعدة البيانات أو بريد المالك",
                },
              ]}
              values={{ search }}
              onChange={(next) => setSearch(typeof next.search === "string" ? next.search : "")}
            />
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <select
              aria-label={copy.statusFilter}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TenantStatusFilter)}
              className="h-(--size-control-lg) rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">{t.tenants.allStatuses}</option>
              <option value="ACTIVE">{t.tenants.statusNames.ACTIVE}</option>
              <option value="PROVISIONING">{t.tenants.statusNames.PROVISIONING}</option>
              <option value="PROVISIONING_FAILED">{copy.provisioningFailed}</option>
              <option value="SUSPENDED">{t.tenants.statusNames.SUSPENDED}</option>
              <option value="DELETED">{t.tenants.statusNames.DELETED}</option>
            </select>

            <div className="flex min-w-48 flex-col gap-1">
              <select
                aria-label={copy.databaseServerFilter}
                value={serverFilter}
                disabled={databaseServerOptionsState !== "ready"}
                onChange={(event) => setServerFilter(event.target.value)}
                className="h-(--size-control-lg) min-w-48 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="ALL">
                  {databaseServerOptionsState === "loading" ? copy.databaseServerLoading : t.tenants.allServers}
                </option>
                {databaseServerOptions.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
              {databaseServerOptionsState === "forbidden" ? (
                <span className="text-xs text-warn-700 dark:text-warn-300">{copy.databaseServerForbidden}</span>
              ) : databaseServerOptionsState === "error" ? (
                <span role="alert" className="text-xs text-danger-700 dark:text-danger-300">
                  {copy.databaseServerUnavailable}
                  {databaseServerOptionsError?.errorCode ? ` · ${databaseServerOptionsError.errorCode}` : ""}
                  {databaseServerOptionsError?.correlationId ? ` · ${databaseServerOptionsError.correlationId}` : ""}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => void retryDatabaseServerOptions()}
                    className="ms-1 h-auto p-0 text-xs"
                  >
                    {copy.retry}
                  </Button>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={tenants}
          isLoading={isLoading && tenants.length === 0}
          pagination={{
            page,
            limit,
            totalItems,
            totalPages: pagination.totalPages,
            onPageChange: setPage,
          }}
          emptyState={{
            titleEn: loadError ? "Trusted results could not be displayed" : "No tenants found",
            titleAr: loadError ? "تعذر عرض نتائج موثوقة" : t.tenants.emptyState,
            descriptionEn: loadError ? "Retry the request." : undefined,
            descriptionAr: loadError ? "أعد المحاولة." : undefined,
          }}
        />
      </div>

      {activeModalTenant && modalActionType ? (
        <TenantActionModal
          tenant={activeModalTenant}
          action={modalActionType}
          error={actionError}
          isSubmitting={
            pendingAction?.action === modalActionType && pendingAction.tenantId === activeModalTenant.id
          }
          onClose={closeModal}
          onConfirm={() => void confirmModalAction()}
        />
      ) : null}
    </div>
  );
}

function TenantRowActions({
  tenant,
  copy,
  canSuspendOrActivate,
  canReprovision,
  canSoftDelete,
  pendingAction,
  onActivate,
  onSuspend,
  onDelete,
  onReprovision,
}: {
  tenant: TenantRecord;
  copy: ReturnType<typeof directoryCopy>;
  canSuspendOrActivate: boolean;
  canReprovision: boolean;
  canSoftDelete: boolean;
  pendingAction: { action: string; tenantId: string } | null;
  onActivate: (tenant: TenantRecord) => void;
  onSuspend: (tenant: TenantRecord) => void;
  onDelete: (tenant: TenantRecord) => void;
  onReprovision: (tenant: TenantRecord) => Promise<void>;
}) {
  const busy = pendingAction !== null;
  const thisRowBusy = pendingAction?.tenantId === tenant.id;
  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/tenants/${tenant.id}`}>
          {copy.details}
          <ExternalLink className="size-3" aria-hidden="true" />
        </Link>
      </Button>

      {canSuspendOrActivate && tenant.status === "SUSPENDED" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onActivate(tenant)}
          className="text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30"
        >
          {thisRowBusy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : copy.activate}
        </Button>
      ) : null}
      {canSuspendOrActivate && tenant.status === "ACTIVE" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onSuspend(tenant)}
          className="text-warn-700 hover:bg-warn-50 dark:text-warn-400 dark:hover:bg-warn-950/30"
        >
          {thisRowBusy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : copy.suspend}
        </Button>
      ) : null}
      {canReprovision && tenant.status === "PROVISIONING_FAILED" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void onReprovision(tenant)}
        >
          {thisRowBusy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-3" aria-hidden="true" />}
          {copy.reprovision}
        </Button>
      ) : null}
      {canSoftDelete && tenant.status !== "DELETED" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onDelete(tenant)}
          aria-label={`${copy.delete} ${tenant.companyName}`}
          title={copy.delete}
          className="text-danger-600 hover:bg-danger-50 hover:text-danger-700 dark:text-danger-400 dark:hover:bg-danger-950/30"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function TenantStatusBadge({ status, lang }: { status: TenantRecord["status"]; lang: "ar" | "en" }) {
  const labels = {
    ACTIVE: { en: "Active", ar: "نشط", tone: "brand" },
    PROVISIONING: { en: "Provisioning", ar: "جارٍ التجهيز", tone: "neutral" },
    PROVISIONING_FAILED: { en: "Provisioning failed", ar: "فشل التجهيز", tone: "danger" },
    SUSPENDED: { en: "Suspended", ar: "معلّق", tone: "warn" },
    DELETED: { en: "Deleted", ar: "محذوف", tone: "neutral" },
  } as const;
  const value = labels[status];
  return <Badge tone={value.tone}>{value[lang]}</Badge>;
}

function TenantActionModal({
  tenant,
  action,
  error,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  tenant: TenantRecord;
  action: TenantDirectoryModalAction;
  error: { message: string; correlationId?: string } | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copyEn = directoryCopy("en");
  const copyAr = directoryCopy("ar");
  const titleEn =
    action === "activate" ? copyEn.modalActivateTitle : action === "suspend" ? copyEn.modalSuspendTitle : copyEn.modalDeleteTitle;
  const titleAr =
    action === "activate" ? copyAr.modalActivateTitle : action === "suspend" ? copyAr.modalSuspendTitle : copyAr.modalDeleteTitle;
  const baseDescriptionEn =
    action === "activate"
      ? copyEn.modalActivateDescription
      : action === "suspend"
        ? copyEn.modalSuspendDescription
        : copyEn.modalDeleteDescription;
  const baseDescriptionAr =
    action === "activate"
      ? copyAr.modalActivateDescription
      : action === "suspend"
        ? copyAr.modalSuspendDescription
        : copyAr.modalDeleteDescription;
  // error.message is produced by the transport/hook in a single language
  // (see localError() in useTenants.ts) — the original inline error text
  // was never bilingual either, so the same literal string is appended to
  // both descriptions here rather than only one.
  const errorSuffix = error ? ` — ${error.message}${error.correlationId ? ` · ${error.correlationId}` : ""}` : "";

  return (
    <ConfirmActionModal
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      titleEn={titleEn}
      titleAr={titleAr}
      descriptionEn={`${baseDescriptionEn} ${tenant.companyName} (${tenant.name})${errorSuffix}`}
      descriptionAr={`${baseDescriptionAr} ${tenant.companyName} (${tenant.name})${errorSuffix}`}
      variant={action === "delete" ? "danger" : action === "suspend" ? "warning" : "info"}
      requiredConfirmationText={action === "activate" ? undefined : tenant.name}
      isLoading={isSubmitting}
    />
  );
}

function ErrorBanner({
  message,
  errorCode,
  correlationId,
  dismissLabel,
  onDismiss,
}: {
  message: string;
  errorCode: string;
  correlationId?: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-xs text-danger-800 dark:border-danger-900/70 dark:bg-danger-950/30 dark:text-danger-300"
    >
      <p>
        <strong>{errorCode}</strong> · {message}
        {correlationId ? <span className="ms-2 font-mono text-xs">{correlationId}</span> : null}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  );
}

function directoryCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        isolation: "عزل متعدد المستأجرين",
        statusFilter: "تصفية حسب الحالة",
        databaseServerFilter: "تصفية حسب خادم قاعدة البيانات",
        databaseServerLoading: "جارٍ تحميل سجل خوادم قاعدة البيانات…",
        databaseServerForbidden:
          "تحتاج صلاحية قراءة خوادم قاعدة البيانات لاستخدام هذه التصفية.",
        databaseServerUnavailable: "تعذر تحميل سجل خوادم قاعدة البيانات.",
        provisioningFailed: "فشل التجهيز",
        databaseServer: "خادم قاعدة البيانات",
        storageServer: "خادم التخزين",
        seats: (count: number) => `${count} مقعد`,
        details: "التفاصيل",
        activate: "تفعيل",
        suspend: "إيقاف مؤقت",
        reprovision: "إعادة محاولة التجهيز",
        delete: "حذف مؤقت",
        retry: "إعادة المحاولة",
        dismiss: "إخفاء",
        modalActivateTitle: "تأكيد تفعيل المستأجر",
        modalSuspendTitle: "تأكيد إيقاف المستأجر",
        modalDeleteTitle: "تأكيد الحذف المؤقت للمستأجر",
        modalActivateDescription: "سيصبح المستأجر نشطاً وسيُسمح لمستخدميه بالوصول مجدداً:",
        modalSuspendDescription: "سيُعلّق وصول مستخدمي المستأجر حتى تتم إعادة تفعيله:",
        modalDeleteDescription: "سيُنقل المستأجر إلى حالة الحذف المؤقت وفق قيود الفوترة والعمليات:",
      }
    : {
        isolation: "Multi-tenant isolation",
        statusFilter: "Filter by status",
        databaseServerFilter: "Filter by database server",
        databaseServerLoading: "Loading database server registry…",
        databaseServerForbidden: "Database-server read permission is required for this filter.",
        databaseServerUnavailable: "Database server registry is unavailable.",
        provisioningFailed: "Provisioning failed",
        databaseServer: "Database server",
        storageServer: "Storage server",
        seats: (count: number) => `${count} seats`,
        details: "Details",
        activate: "Activate",
        suspend: "Suspend",
        reprovision: "Retry provisioning",
        delete: "Soft delete",
        retry: "Retry",
        dismiss: "Dismiss",
        modalActivateTitle: "Confirm tenant activation",
        modalSuspendTitle: "Confirm tenant suspension",
        modalDeleteTitle: "Confirm tenant soft deletion",
        modalActivateDescription: "The tenant becomes active and its users can access it again:",
        modalSuspendDescription: "Tenant-user access remains suspended until the tenant is activated again:",
        modalDeleteDescription: "The tenant is soft-deleted subject to billing and operation safeguards:",
      };
}
