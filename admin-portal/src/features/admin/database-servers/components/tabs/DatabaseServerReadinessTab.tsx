import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SystemPrincipalRotationPolicy } from "../SystemPrincipalRotationPolicy";
import { useI18n } from "@/i18n/I18nContext";
import type { DatabaseServerView, DatabaseServerProvisioningPrincipalBindingView, UpdateDatabaseServerSystemPrincipalRotationDto } from "../../types";

interface DatabaseServerReadinessTabProps {
  server: DatabaseServerView;
  provisioningPrincipal?: DatabaseServerProvisioningPrincipalBindingView;
  backupDependencyNeedsAttention: boolean;
  canBootstrapInitial: boolean;
  canReadBackup: boolean;
  canRegenerate: boolean;
  canReconcile: boolean;
  canUpdate: boolean;
  credentialActionPending: string | null;
  onRetryBootstrap: () => void;
  onSystemCredentialMutation: (
    action: "regenerate-system" | "reconcile-system",
    binding: DatabaseServerProvisioningPrincipalBindingView,
  ) => void;
  onUpdateProvisioningRotationPolicy: (
    dto: UpdateDatabaseServerSystemPrincipalRotationDto,
  ) => Promise<unknown>;
}

export function DatabaseServerReadinessTab({
  server,
  provisioningPrincipal,
  backupDependencyNeedsAttention,
  canBootstrapInitial,
  canReadBackup,
  canRegenerate,
  canReconcile,
  canUpdate,
  credentialActionPending,
  onRetryBootstrap,
  onSystemCredentialMutation,
  onUpdateProvisioningRotationPolicy,
}: DatabaseServerReadinessTabProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.readiness;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Access Readiness Panel */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              {d.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {d.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                server.credentialBootstrap.status === "READY"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : server.credentialBootstrap.status === "DEGRADED"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {server.credentialBootstrap.status}
            </span>

            <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {server.credentialBootstrap.readyPrincipals}/{server.credentialBootstrap.totalPrincipals}
            </span>

            {canBootstrapInitial &&
              server.status === "DRAFT" &&
              server.credentialBootstrap.status !== "READY" && (
                <button
                  type="button"
                  onClick={onRetryBootstrap}
                  disabled={Boolean(credentialActionPending)}
                  title={d.retrySetup}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {d.retrySetup}
                </button>
              )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Backup Dependency Alert */}
          {backupDependencyNeedsAttention && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{d.backupNeedsAttentionTitle}</p>
                <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
                  {d.backupNeedsAttentionSub}
                </p>
              </div>
              {canReadBackup && (
                <Link
                  href={`/backup/access?databaseServerId=${encodeURIComponent(server.id)}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950"
                >
                  {d.openBackup}
                </Link>
              )}
            </div>
          )}

          {/* Provisioning Principal Card */}
          {provisioningPrincipal ? (
            <article className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {d.provisioningAccount}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {provisioningPrincipal.databasePrincipal}
                  </p>
                </div>
                <div className="text-end">
                  <StatusBadge status={provisioningPrincipal.status} enumType="db-server" />
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    rev {provisioningPrincipal.credentialRevision}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {d.provisioningDesc}
              </p>

              {provisioningPrincipal.safeFailureCode && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 font-mono text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {provisioningPrincipal.safeFailureCode}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                {canRegenerate &&
                  ["READY", "DEFERRED"].includes(provisioningPrincipal.status) && (
                    <button
                      type="button"
                      onClick={() =>
                        onSystemCredentialMutation("regenerate-system", provisioningPrincipal)
                      }
                      className="rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                    >
                      {d.rotatePassword}
                    </button>
                  )}

                {canReconcile &&
                  (provisioningPrincipal.status === "ROTATING" ||
                    provisioningPrincipal.status === "RECONCILING" ||
                    provisioningPrincipal.hasStagedCandidate) && (
                    <button
                      type="button"
                      onClick={() =>
                        onSystemCredentialMutation("reconcile-system", provisioningPrincipal)
                      }
                      className="rounded-xl bg-amber-100 hover:bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 transition cursor-pointer"
                    >
                      {d.reconcile}
                    </button>
                  )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <SystemPrincipalRotationPolicy
                  binding={provisioningPrincipal}
                  canUpdate={canUpdate}
                  onSave={onUpdateProvisioningRotationPolicy}
                />
              </div>
            </article>
          ) : (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <p className="text-sm font-semibold">{d.provisioningUnavailableTitle}</p>
              <p className="mt-1 text-xs leading-5">{d.provisioningUnavailableSub}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
