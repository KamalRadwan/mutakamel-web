"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  ExternalLink,
  Globe,
  HardDrive,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-canvas dark:text-slate-100">
      <Navbar />

      <main className="w-full flex-1 space-y-4 px-4 py-4 sm:py-6">
        <header className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 px-4 py-3 text-white shadow-md sm:px-5 sm:py-3.5">
          <div className="pointer-events-none absolute end-0 top-0 -me-10 -mt-10 size-72 rounded-full bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-indigo-500/0 blur-3xl" />
          <div className="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-2.5 text-white shadow-xs">
                <Building2 className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                    {t.tenants.pageTitle}
                  </h1>
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/20 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-cyan-300">
                    {copy.isolation}
                  </span>
                </div>
                <p className="mt-0.5 max-w-xl text-xs leading-tight text-cyan-100/80">
                  {t.tenants.pageSubtitle}
                </p>
              </div>
            </div>

            {permissions.canCreate ? (
              <Link
                href="/tenants/new"
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-cyan-400 hover:to-indigo-400"
              >
                <Plus className="size-3.5" />
                <span>{t.tenants.registerTenant}</span>
              </Link>
            ) : null}
          </div>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {copy.matchingTenants}
            </span>
            <strong className="ms-2 font-mono text-base text-slate-950 dark:text-white">
              {totalItems}
            </strong>
          </div>
          <span className="text-slate-500 dark:text-slate-400">
            {copy.visibleRows(tenants.length)}
          </span>
        </section>

        {loadError ? (
          <ErrorBanner
            message={loadError.message}
            errorCode={loadError.errorCode}
            correlationId={loadError.correlationId}
            retryLabel={copy.retry}
            dismissLabel={copy.dismiss}
            onRetry={() => void refresh()}
          />
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

        <section className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row">
          <div className="relative w-full sm:w-96">
            <Search className="absolute start-3.5 top-3 size-4 text-cyan-500" />
            <input
              type="search"
              value={search}
              maxLength={200}
              aria-label={copy.search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-xs text-slate-900 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select
              aria-label={copy.statusFilter}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TenantStatusFilter)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
            >
              <option value="ALL">{t.tenants.allStatuses}</option>
              <option value="ACTIVE">{t.tenants.statusNames.ACTIVE}</option>
              <option value="PROVISIONING">
                {t.tenants.statusNames.PROVISIONING}
              </option>
              <option value="PROVISIONING_FAILED">
                {copy.provisioningFailed}
              </option>
              <option value="SUSPENDED">
                {t.tenants.statusNames.SUSPENDED}
              </option>
              <option value="DELETED">{t.tenants.statusNames.DELETED}</option>
            </select>

            <div className="flex min-w-48 flex-col gap-1">
              <select
                aria-label={copy.databaseServerFilter}
                value={serverFilter}
                disabled={databaseServerOptionsState !== "ready"}
                onChange={(event) => setServerFilter(event.target.value)}
                className="min-w-48 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
              >
                <option value="ALL">
                  {databaseServerOptionsState === "loading"
                    ? copy.databaseServerLoading
                    : t.tenants.allServers}
                </option>
                {databaseServerOptions.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
              {databaseServerOptionsState === "forbidden" ? (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  {copy.databaseServerForbidden}
                </span>
              ) : databaseServerOptionsState === "error" ? (
                <span
                  role="alert"
                  className="text-xs text-rose-700 dark:text-rose-300"
                >
                  {copy.databaseServerUnavailable}
                  {databaseServerOptionsError?.errorCode
                    ? ` · ${databaseServerOptionsError.errorCode}`
                    : ""}
                  {databaseServerOptionsError?.correlationId
                    ? ` · ${databaseServerOptionsError.correlationId}`
                    : ""}
                  <button
                    type="button"
                    onClick={() => void retryDatabaseServerOptions()}
                    className="ms-1 font-semibold underline"
                  >
                    {copy.retry}
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900"
          aria-busy={isLoading}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                  <th className="px-5 py-3 text-start">
                    {t.tenants.tenantName}
                  </th>
                  <th className="px-5 py-3 text-start">
                    {t.tenants.primaryFqdn}
                  </th>
                  <th className="px-5 py-3 text-start">
                    {copy.infrastructure}
                  </th>
                  <th className="px-5 py-3 text-start">{copy.subscription}</th>
                  <th className="px-5 py-3 text-start">{t.tenants.status}</th>
                  <th className="px-5 py-3 text-end">{t.tenants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading && tenants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-500"
                    >
                      <Loader2 className="mx-auto mb-2 size-6 animate-spin text-blue-500" />
                      {copy.loading}
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-500"
                    >
                      {loadError ? copy.noTrustedResults : t.tenants.emptyState}
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant) => (
                    <TenantRow
                      key={tenant.id}
                      tenant={tenant}
                      lang={lang}
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              {copy.pagination(
                page,
                Math.max(1, pagination.totalPages),
                totalItems,
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrev || isLoading}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {copy.previous}
              </button>
              <button
                type="button"
                disabled={!pagination.hasNext || isLoading}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {copy.next}
              </button>
            </div>
          </footer>
        </section>
      </main>

      {activeModalTenant && modalActionType ? (
        <TenantActionModal
          tenant={activeModalTenant}
          action={modalActionType}
          lang={lang}
          error={actionError}
          isSubmitting={
            pendingAction?.action === modalActionType &&
            pendingAction.tenantId === activeModalTenant.id
          }
          onClose={closeModal}
          onConfirm={() => void confirmModalAction()}
        />
      ) : null}
    </div>
  );
}

function TenantRow({
  tenant,
  lang,
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
  lang: "ar" | "en";
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
    <tr className="h-11 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
        <Link
          href={`/tenants/${tenant.id}`}
          className="group inline-flex flex-col"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 group-hover:underline dark:text-blue-400">
              {tenant.companyName}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-800">
              {tenant.name}
            </span>
          </div>
          <span className="font-mono text-xs font-normal text-slate-400">
            {tenant.ownerEmail ?? "—"}
          </span>
        </Link>
      </td>
      <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <Globe className="size-3.5 shrink-0 text-blue-500" />
          <span className="text-xs font-semibold">
            {tenant.primaryFqdn ?? "—"}
          </span>
          {tenant.secondaryFqdnsCount > 0 ? (
            <span className="text-xs text-slate-400">
              +{tenant.secondaryFqdnsCount}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center gap-1.5"
            title={copy.databaseServer}
          >
            <Server className="size-3.5 shrink-0 text-purple-500" />
            <span className="font-mono text-xs font-semibold">
              {tenant.databaseServerName ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5" title={copy.storageServer}>
            <HardDrive className="size-3.5 shrink-0 text-blue-500" />
            <span className="font-mono text-xs font-semibold">
              {tenant.storageServer?.name ?? tenant.storageServerId}
            </span>
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {tenant.countryName}
        </div>
      </td>
      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
        <span className="text-xs font-semibold">
          {tenant.subscriptionStatus ?? "—"}
        </span>
        <div className="font-mono text-xs text-slate-400">
          {tenant.seats === null ? "—" : copy.seats(tenant.seats)}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <TenantStatusBadge status={tenant.status} lang={lang} />
      </td>
      <td className="px-4 py-2.5 text-end">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/tenants/${tenant.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/60"
          >
            <span>{copy.details}</span>
            <ExternalLink className="size-3" />
          </Link>

          {canSuspendOrActivate && tenant.status === "SUSPENDED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onActivate(tenant)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
            >
              {thisRowBusy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                copy.activate
              )}
            </button>
          ) : null}
          {canSuspendOrActivate && tenant.status === "ACTIVE" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSuspend(tenant)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 disabled:opacity-40 dark:text-amber-400 dark:hover:bg-amber-950/60"
            >
              {thisRowBusy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                copy.suspend
              )}
            </button>
          ) : null}
          {canReprovision && tenant.status === "PROVISIONING_FAILED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onReprovision(tenant)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950/60"
            >
              {thisRowBusy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCcw className="size-3" />
              )}
              <span>{copy.reprovision}</span>
            </button>
          ) : null}
          {canSoftDelete && tenant.status !== "DELETED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(tenant)}
              aria-label={`${copy.delete} ${tenant.companyName}`}
              title={copy.delete}
              className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:hover:bg-rose-950/60"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function TenantStatusBadge({
  status,
  lang,
}: {
  status: TenantRecord["status"];
  lang: "ar" | "en";
}) {
  const labels = {
    ACTIVE: { en: "Active", ar: "نشط", tone: "emerald" },
    PROVISIONING: { en: "Provisioning", ar: "جارٍ التجهيز", tone: "blue" },
    PROVISIONING_FAILED: {
      en: "Provisioning failed",
      ar: "فشل التجهيز",
      tone: "rose",
    },
    SUSPENDED: { en: "Suspended", ar: "معلّق", tone: "amber" },
    DELETED: { en: "Deleted", ar: "محذوف", tone: "slate" },
  } as const;
  const value = labels[status];
  const tones = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-400",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-400",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400",
    slate:
      "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tones[value.tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {value[lang]}
    </span>
  );
}

function TenantActionModal({
  tenant,
  action,
  lang,
  error,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  tenant: TenantRecord;
  action: TenantDirectoryModalAction;
  lang: "ar" | "en";
  error: { message: string; correlationId?: string } | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = directoryCopy(lang);
  const [confirmation, setConfirmation] = useState("");
  const requiresName = action !== "activate";
  const confirmed =
    !requiresName ||
    confirmation.trim().toLowerCase() === tenant.name.trim().toLowerCase();
  const title =
    action === "activate"
      ? copy.modalActivateTitle
      : action === "suspend"
        ? copy.modalSuspendTitle
        : copy.modalDeleteTitle;
  const description =
    action === "activate"
      ? copy.modalActivateDescription
      : action === "suspend"
        ? copy.modalSuspendDescription
        : copy.modalDeleteDescription;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-action-title"
        className="relative w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          aria-label={copy.close}
          disabled={isSubmitting}
          onClick={onClose}
          className="absolute end-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
        >
          <X className="size-4" />
        </button>
        <div className="pe-8">
          <h2 id="tenant-action-title" className="text-sm font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
          <strong>{tenant.companyName}</strong>
          <div className="font-mono text-slate-500">{tenant.name}</div>
        </div>
        {requiresName ? (
          <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{copy.typeTenantName}</span>
            <input
              autoFocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={tenant.name}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error.message}
            {error.correlationId ? ` · ${error.correlationId}` : ""}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            disabled={!confirmed || isSubmitting}
            onClick={onConfirm}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              action === "activate"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : action === "suspend"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {isSubmitting ? copy.executing : copy.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}

function ErrorBanner({
  message,
  errorCode,
  correlationId,
  retryLabel,
  dismissLabel,
  onRetry,
  onDismiss,
}: {
  message: string;
  errorCode: string;
  correlationId?: string;
  retryLabel?: string;
  dismissLabel: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>{errorCode}</strong> · {message}
          {correlationId ? (
            <span className="ms-2 font-mono text-xs">{correlationId}</span>
          ) : null}
        </p>
      </div>
      <div className="flex gap-2">
        {onRetry && retryLabel ? (
          <button
            type="button"
            className="font-semibold underline"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            className="font-semibold underline"
            onClick={onDismiss}
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function directoryCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        isolation: "عزل متعدد المستأجرين",
        matchingTenants: "المستأجرون المطابقون",
        visibleRows: (count: number) => `${count} صف في الصفحة الحالية`,
        search: "بحث المستأجرين",
        searchPlaceholder:
          "ابحث بالاسم أو الشركة أو الدولة أو قاعدة البيانات أو بريد المالك",
        statusFilter: "تصفية حسب الحالة",
        provisioningFailed: "فشل التجهيز",
        databaseServerFilter: "تصفية حسب خادم قاعدة البيانات",
        databaseServerLoading: "جارٍ تحميل سجل خوادم قاعدة البيانات…",
        databaseServerForbidden:
          "تحتاج صلاحية قراءة خوادم قاعدة البيانات لاستخدام هذه التصفية.",
        databaseServerUnavailable: "تعذر تحميل سجل خوادم قاعدة البيانات.",
        infrastructure: "البنية التحتية",
        subscription: "الاشتراك",
        databaseServer: "خادم قاعدة البيانات",
        storageServer: "خادم التخزين",
        seats: (count: number) => `${count} مقعد`,
        details: "التفاصيل",
        activate: "تفعيل",
        suspend: "إيقاف مؤقت",
        reprovision: "إعادة محاولة التجهيز",
        delete: "حذف مؤقت",
        loading: "جارٍ تحميل المستأجرين…",
        noTrustedResults: "تعذر عرض نتائج موثوقة. أعد المحاولة.",
        retry: "إعادة المحاولة",
        dismiss: "إخفاء",
        previous: "السابق",
        next: "التالي",
        pagination: (page: number, totalPages: number, total: number) =>
          `الصفحة ${page} من ${totalPages} · الإجمالي ${total}`,
        modalActivateTitle: "تأكيد تفعيل المستأجر",
        modalSuspendTitle: "تأكيد إيقاف المستأجر",
        modalDeleteTitle: "تأكيد الحذف المؤقت للمستأجر",
        modalActivateDescription:
          "سيصبح المستأجر نشطاً وسيُسمح لمستخدميه بالوصول مجدداً.",
        modalSuspendDescription:
          "سيُعلّق وصول مستخدمي المستأجر حتى تتم إعادة تفعيله.",
        modalDeleteDescription:
          "سيُنقل المستأجر إلى حالة الحذف المؤقت وفق قيود الفوترة والعمليات.",
        typeTenantName: "اكتب اسم المستأجر بالضبط للتأكيد",
        close: "إغلاق",
        cancel: "إلغاء",
        confirm: "تأكيد الإجراء",
        executing: "جارٍ التنفيذ…",
      }
    : {
        isolation: "Multi-tenant isolation",
        matchingTenants: "Matching tenants",
        visibleRows: (count: number) => `${count} rows on this page`,
        search: "Search tenants",
        searchPlaceholder:
          "Search name, company, country, database, or owner email",
        statusFilter: "Filter by status",
        provisioningFailed: "Provisioning failed",
        databaseServerFilter: "Filter by database server",
        databaseServerLoading: "Loading database server registry…",
        databaseServerForbidden:
          "Database-server read permission is required for this filter.",
        databaseServerUnavailable: "Database server registry is unavailable.",
        infrastructure: "Infrastructure",
        subscription: "Subscription",
        databaseServer: "Database server",
        storageServer: "Storage server",
        seats: (count: number) => `${count} seats`,
        details: "Details",
        activate: "Activate",
        suspend: "Suspend",
        reprovision: "Retry provisioning",
        delete: "Soft delete",
        loading: "Loading tenants…",
        noTrustedResults:
          "Trusted results could not be displayed. Retry the request.",
        retry: "Retry",
        dismiss: "Dismiss",
        previous: "Previous",
        next: "Next",
        pagination: (page: number, totalPages: number, total: number) =>
          `Page ${page} of ${totalPages} · ${total} total`,
        modalActivateTitle: "Confirm tenant activation",
        modalSuspendTitle: "Confirm tenant suspension",
        modalDeleteTitle: "Confirm tenant soft deletion",
        modalActivateDescription:
          "The tenant becomes active and its users can access it again.",
        modalSuspendDescription:
          "Tenant-user access remains suspended until the tenant is activated again.",
        modalDeleteDescription:
          "The tenant is soft-deleted subject to billing and operation safeguards.",
        typeTenantName: "Type the exact tenant name to confirm",
        close: "Close",
        cancel: "Cancel",
        confirm: "Confirm action",
        executing: "Executing…",
      };
}
