"use client";

import { useState } from "react";
import type { useTenantFqdnManagement } from "../hooks/useTenantFqdnManagement";
import { canPromoteLegacyPrimary } from "../model/readers";
import type { TenantCorePermissions, TenantView } from "../types";
import { tenantWorkspaceCopy, type TenantWorkspaceLocale } from "./copy";

export interface TenantFqdnPanelProps {
  locale: TenantWorkspaceLocale;
  tenant: TenantView;
  permissions: Pick<
    TenantCorePermissions,
    "canRead" | "canValidateFqdn" | "canManageFqdns"
  >;
  fqdn: ReturnType<typeof useTenantFqdnManagement>;
}

export function TenantFqdnPanel({
  locale,
  tenant,
  permissions,
  fqdn,
}: TenantFqdnPanelProps) {
  const text = tenantWorkspaceCopy(locale);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const busy = fqdn.isPreflighting || fqdn.mutation.name !== null;
  const canMutate = tenant.status === "ACTIVE" && permissions.canManageFqdns;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {text.domains}
        </h2>
        <span className="text-xs font-semibold text-slate-500">
          {fqdn.fqdns.length}
        </span>
      </div>

      {permissions.canValidateFqdn && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={fqdn.candidate}
            disabled={busy}
            placeholder={text.domainPlaceholder}
            aria-label={locale === "ar" ? "النطاق" : "Domain"}
            onChange={(event) => fqdn.setCandidate(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono outline-hidden focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="button"
            disabled={busy || !fqdn.candidate.trim()}
            onClick={() => void fqdn.preflight().catch(() => undefined)}
            className="rounded-xl border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300"
          >
            {fqdn.isPreflighting ? "…" : text.validate}
          </button>
          {permissions.canManageFqdns && (
            <button
              type="button"
              disabled={busy || !fqdn.canAdd}
              onClick={() => void fqdn.add().catch(() => undefined)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {text.addDomain}
            </button>
          )}
        </div>
      )}

      {fqdn.evidence && (
        <div
          role="status"
          className={`rounded-xl border p-3 text-xs ${
            fqdn.evidence.available
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          }`}
        >
          <p className="font-semibold">{fqdn.evidence.message}</p>
          {fqdn.evidence.available && !fqdn.evidence.valid && (
            <p className="mt-1">{text.pendingDns}</p>
          )}
        </div>
      )}

      <InlineError
        locale={locale}
        error={fqdn.listError ?? fqdn.preflightError ?? fqdn.mutation.error}
      />

      {fqdn.listError ? (
        <button
          type="button"
          onClick={() => void fqdn.reloadFqdns()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
        >
          {locale === "ar" ? "إعادة تحميل النطاقات" : "Reload domains"}
        </button>
      ) : null}

      <div className="space-y-2">
        {fqdn.isLoadingFqdns ? (
          <p
            role="status"
            className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50"
          >
            {locale === "ar" ? "جارٍ تحميل النطاقات…" : "Loading domains…"}
          </p>
        ) : fqdn.fqdns.length === 0 && !fqdn.listError ? (
          <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50">
            {text.noDomains}
          </p>
        ) : null}
        {fqdn.fqdns.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                {row.fqdn}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {row.isPrimary ? text.primary : text.secondary}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">
                  {row.validationStatus}
                </span>
              </div>
            </div>
            {canMutate && !row.isPrimary && (
              <div className="flex gap-2">
                {canPromoteLegacyPrimary(tenant, row) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void fqdn.promote(row.id).catch(() => undefined)
                    }
                    className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50 dark:bg-emerald-950 dark:text-emerald-200"
                  >
                    {text.promote}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoveId(row.id)}
                  className="rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-50 dark:bg-rose-950 dark:text-rose-200"
                >
                  {text.remove}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {removeId && (
        <div
          role="alertdialog"
          aria-label={text.remove}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/30"
        >
          <span>
            {locale === "ar"
              ? "تأكيد إزالة هذا النطاق؟"
              : "Confirm removal of this domain?"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const id = removeId;
                void fqdn
                  .remove(id)
                  .then(() => setRemoveId(null))
                  .catch(() => undefined);
              }}
              className="rounded-lg bg-rose-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {text.confirm}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoveId(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700"
            >
              {text.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function InlineError({
  locale,
  error,
}: {
  locale: TenantWorkspaceLocale;
  error: { message: string; correlationId?: string } | null;
}) {
  if (!error) return null;
  const text = tenantWorkspaceCopy(locale);
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
    >
      <p>{error.message}</p>
      {error.correlationId && (
        <p className="mt-1 font-mono text-xs">
          {text.correlation}: {error.correlationId}
        </p>
      )}
    </div>
  );
}
