import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, Button, StatusBadge } from "@/design-system";
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

  const bootstrapTone =
    server.credentialBootstrap.status === "READY"
      ? "bg-brand-500/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
      : server.credentialBootstrap.status === "DEGRADED"
        ? "bg-danger-500/10 text-danger-700 dark:bg-danger-500/15 dark:text-danger-400"
        : "bg-warn-500/10 text-warn-800 dark:bg-warn-500/15 dark:text-warn-300";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-muted p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
              <ShieldCheck className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              {d.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{d.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${bootstrapTone}`}>
              {server.credentialBootstrap.status}
            </span>
            <span className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
              {server.credentialBootstrap.readyPrincipals}/{server.credentialBootstrap.totalPrincipals}
            </span>
            {canBootstrapInitial &&
              server.status === "DRAFT" &&
              server.credentialBootstrap.status !== "READY" && (
                <Button type="button" variant="primary" size="sm" onClick={onRetryBootstrap} disabled={Boolean(credentialActionPending)} title={d.retrySetup}>
                  {d.retrySetup}
                </Button>
              )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {backupDependencyNeedsAttention && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-warn-200 bg-warn-50 px-4 py-3 text-warn-950 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{d.backupNeedsAttentionTitle}</p>
                <p className="mt-1 text-xs leading-5 text-warn-800 dark:text-warn-300">{d.backupNeedsAttentionSub}</p>
              </div>
              {canReadBackup && (
                <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
                  <Link href={`/backup/access?databaseServerId=${encodeURIComponent(server.id)}`}>{d.openBackup}</Link>
                </Button>
              )}
            </div>
          )}

          {provisioningPrincipal ? (
            <Card className="bg-muted p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{d.provisioningAccount}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-brand-700 dark:text-brand-400">
                    {provisioningPrincipal.databasePrincipal}
                  </p>
                </div>
                <div className="text-end">
                  <StatusBadge status={provisioningPrincipal.status} enumType="db-server" />
                  <p className="mt-1 font-mono text-xs text-muted-foreground">rev {provisioningPrincipal.credentialRevision}</p>
                </div>
              </div>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">{d.provisioningDesc}</p>

              {provisioningPrincipal.safeFailureCode && (
                <p className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 font-mono text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-400">
                  {provisioningPrincipal.safeFailureCode}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                {canRegenerate &&
                  ["READY", "DEFERRED"].includes(provisioningPrincipal.status) && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onSystemCredentialMutation("regenerate-system", provisioningPrincipal)}
                    >
                      {d.rotatePassword}
                    </Button>
                  )}
                {canReconcile &&
                  (provisioningPrincipal.status === "ROTATING" ||
                    provisioningPrincipal.status === "RECONCILING" ||
                    provisioningPrincipal.hasStagedCandidate) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-warn-300 text-warn-700 hover:bg-warn-100 dark:border-warn-800 dark:text-warn-300 dark:hover:bg-warn-950/40"
                      onClick={() => onSystemCredentialMutation("reconcile-system", provisioningPrincipal)}
                    >
                      {d.reconcile}
                    </Button>
                  )}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <SystemPrincipalRotationPolicy
                  binding={provisioningPrincipal}
                  canUpdate={canUpdate}
                  onSave={onUpdateProvisioningRotationPolicy}
                />
              </div>
            </Card>
          ) : (
            <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-900 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200">
              <p className="text-sm font-semibold">{d.provisioningUnavailableTitle}</p>
              <p className="mt-1 text-xs leading-5">{d.provisioningUnavailableSub}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
