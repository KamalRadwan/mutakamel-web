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
    <section className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-xs dark:border-border dark:bg-ink-900">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 dark:border-border">
        <h2 className="text-sm font-semibold text-foreground">
          {text.domains}
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {fqdn.fqdns.length}
        </span>
      </div>

      {permissions.canValidateFqdn && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={fqdn.candidate}
            disabled={busy}
            placeholder={text.domainPlaceholder}
            aria-label={text.domainFieldLabel}
            onChange={(event) => fqdn.setCandidate(event.target.value)}
            className="rounded-lg border border-border bg-ink-100 px-3 py-2 text-xs font-mono outline-hidden focus:border-brand-500 disabled:opacity-60 dark:bg-ink-800"
          />
          <button
            type="button"
            disabled={busy || !fqdn.candidate.trim()}
            onClick={() => void fqdn.preflight().catch(() => undefined)}
            className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-semibold text-brand-700 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300"
          >
            {fqdn.isPreflighting ? "…" : text.validate}
          </button>
          {permissions.canManageFqdns && (
            <button
              type="button"
              disabled={busy || !fqdn.canAdd}
              onClick={() => void fqdn.add().catch(() => undefined)}
              className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-ink-950 disabled:opacity-50 dark:bg-brand-400"
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
              ? "border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200"
              : "border-danger-300 bg-danger-50 text-danger-900 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
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
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold dark:border-border"
        >
          {text.reloadDomains}
        </button>
      ) : null}

      <div className="space-y-2">
        {fqdn.isLoadingFqdns ? (
          <p
            role="status"
            className="rounded-xl bg-ink-100 p-4 text-center text-xs text-muted-foreground dark:bg-ink-800/50"
          >
            {text.loadingDomains}
          </p>
        ) : fqdn.fqdns.length === 0 && !fqdn.listError ? (
          <p className="rounded-xl bg-ink-100 p-4 text-center text-xs text-muted-foreground dark:bg-ink-800/50">
            {text.noDomains}
          </p>
        ) : null}
        {fqdn.fqdns.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 dark:border-border"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-foreground">
                {row.fqdn}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-ink-100 px-2 py-0.5 dark:bg-ink-800">
                  {row.isPrimary ? text.primary : text.secondary}
                </span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono dark:bg-ink-800">
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
                    className="rounded-lg bg-brand-100 px-2.5 py-1.5 text-xs font-semibold text-brand-800 disabled:opacity-50 dark:bg-brand-950 dark:text-brand-200"
                  >
                    {text.promote}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoveId(row.id)}
                  className="rounded-lg bg-danger-100 px-2.5 py-1.5 text-xs font-semibold text-danger-800 disabled:opacity-50 dark:bg-danger-950 dark:text-danger-200"
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
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger-300 bg-danger-50 p-3 text-xs dark:border-danger-900 dark:bg-danger-950/30"
        >
          <span>{text.confirmRemoveDomain}</span>
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
              className="rounded-lg bg-danger-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {text.confirm}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoveId(null)}
              className="rounded-lg border border-border px-3 py-1.5 dark:border-border"
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
      className="rounded-xl border border-danger-300 bg-danger-50 p-3 text-xs text-danger-900 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
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
