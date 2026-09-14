import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Badge, Button, Card, StatusBadge } from "@/design-system";
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

  const bootstrapTone: "success" | "danger" | "warn" =
    server.credentialBootstrap.status === "READY"
      ? "success"
      : server.credentialBootstrap.status === "DEGRADED"
        ? "danger"
        : "warn";

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-border bg-muted p-3 sm:p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground rtl:normal-case rtl:tracking-normal">
              <ShieldCheck className="size-3.5 text-info" aria-hidden="true" />
              {d.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{d.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={bootstrapTone} className="px-2.5 py-1">
              {server.credentialBootstrap.status}
            </Badge>
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

        <div className="space-y-3 p-3 sm:p-3.5">
          {backupDependencyNeedsAttention && (
            <div
              role="alert"
              className="flex flex-col gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle p-2.5 text-warning-subtle-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-semibold">{d.backupNeedsAttentionTitle}</p>
                <p className="mt-0.5 text-xs leading-5">{d.backupNeedsAttentionSub}</p>
              </div>
              {canReadBackup && (
                <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
                  <Link href={`/backup/access?databaseServerId=${encodeURIComponent(server.id)}`}>{d.openBackup}</Link>
                </Button>
              )}
            </div>
          )}

          {provisioningPrincipal ? (
            <Card className="bg-muted p-3 sm:p-3.5">
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground rtl:normal-case rtl:tracking-normal">{d.provisioningAccount}</p>
                  <p className="mt-0.5 break-all font-mono text-xs font-semibold text-info-subtle-foreground">
                    {provisioningPrincipal.databasePrincipal}
                  </p>
                </div>
                <div className="text-end">
                  <StatusBadge status={provisioningPrincipal.status} enumType="db-server" />
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">rev {provisioningPrincipal.credentialRevision}</p>
                </div>
              </div>

              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{d.provisioningDesc}</p>

              {provisioningPrincipal.safeFailureCode && (
                <p role="alert" className="mt-2.5 rounded-lg border border-destructive/30 bg-destructive-subtle p-2 font-mono text-xs text-destructive-subtle-foreground">
                  {provisioningPrincipal.safeFailureCode}
                </p>
              )}

              <div className="mt-3 flex gap-2">
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
                      className="border-warning/40 text-warning-subtle-foreground hover:bg-warning-subtle"
                      onClick={() => onSystemCredentialMutation("reconcile-system", provisioningPrincipal)}
                    >
                      {d.reconcile}
                    </Button>
                  )}
              </div>

              <SystemPrincipalRotationPolicy
                binding={provisioningPrincipal}
                canUpdate={canUpdate}
                onSave={onUpdateProvisioningRotationPolicy}
              />
            </Card>
          ) : (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-subtle p-2.5 text-destructive-subtle-foreground">
              <p className="text-xs font-semibold">{d.provisioningUnavailableTitle}</p>
              <p className="mt-0.5 text-xs leading-5">{d.provisioningUnavailableSub}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
