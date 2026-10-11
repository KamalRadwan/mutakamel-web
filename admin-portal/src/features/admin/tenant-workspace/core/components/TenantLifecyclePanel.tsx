"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  ConfirmActionModal,
} from "@/design-system";
import type { useTenantCoreWorkspace } from "../hooks/useTenantCoreWorkspace";
import {
  canAbandonTenantDestroy,
  canResumeTenantDestroy,
  tenantDestroyHoldsTenant,
} from "../model/destroy";
import {
  tenantWorkspaceCopy,
  type TenantWorkspaceLocale,
} from "./copy";
import { TenantDestroyStatus } from "./TenantDestroyStatus";

type LifecycleAction =
  | "suspend"
  | "activate"
  | "reprovision"
  | "cancel-provisioning"
  | "soft-delete"
  | "restore"
  | "destroy"
  | "abandon-destroy"
  | "resume-destroy";

/** Actions confirmed by the shared dialog; abandon and resume have their own. */
type DialogAction = Exclude<LifecycleAction, "abandon-destroy" | "resume-destroy">;

const DESTROY_STATUS_ID = "tenant-destroy-status";

export interface TenantLifecyclePanelProps {
  locale: TenantWorkspaceLocale;
  workspace: ReturnType<typeof useTenantCoreWorkspace>;
}

export function TenantLifecyclePanel({
  locale,
  workspace,
}: TenantLifecyclePanelProps) {
  const text = tenantWorkspaceCopy(locale);
  const tenant = workspace.tenant;
  const [confirmation, setConfirmation] = useState<LifecycleAction | null>(
    null,
  );
  if (!tenant) return null;

  const deleted = tenant.status === "DELETED";
  const destroyOperation = deleted ? workspace.destroyOperation : null;
  // A request that was not abandoned holds the tenant: Core refuses restore
  // and answers a new destroy with that same request.
  const heldByDestruction = tenantDestroyHoldsTenant(destroyOperation);
  // Abandon is offered only before the drop was authorized; a request that
  // halted after it is resumed instead, which Core does on a new request.
  const canAbandon =
    workspace.permissions.canDestroy && canAbandonTenantDestroy(destroyOperation);
  const canResume =
    workspace.permissions.canDestroy && canResumeTenantDestroy(destroyOperation);
  const busy = workspace.mutation.name !== null;
  const heldReason = heldByDestruction ? `${DESTROY_STATUS_ID}-hint` : undefined;
  const actionLabel: Record<DialogAction, string> = {
    suspend: text.suspend,
    activate: text.activate,
    reprovision: text.reprovision,
    "cancel-provisioning": text.cancelProvisioning,
    "soft-delete": text.softDelete,
    restore: text.restore,
    destroy: text.destroy,
  };
  const actionHint: Partial<Record<DialogAction, string>> = {
    restore: text.restoreHint,
    destroy: text.destroyHint,
  };
  const dialogAction =
    confirmation === "abandon-destroy" || confirmation === "resume-destroy"
      ? null
      : confirmation;
  const en = tenantWorkspaceCopy("en");
  const ar = tenantWorkspaceCopy("ar");

  const confirm = async () => {
    if (!dialogAction) return;
    try {
      if (dialogAction === "suspend") await workspace.suspend();
      if (dialogAction === "activate") await workspace.activate();
      if (dialogAction === "reprovision") await workspace.reprovision();
      if (dialogAction === "cancel-provisioning") {
        await workspace.cancelProvisioning();
      }
      if (dialogAction === "soft-delete") await workspace.softDelete();
      if (dialogAction === "restore") await workspace.restore();
      if (dialogAction === "destroy") {
        await workspace.destroy(false);
      }
      setConfirmation(null);
    } catch {
      // The hook exposes normalized failure evidence beside the controls.
    }
  };

  // Sent once; the dialog closes either way. This modal cannot hold an error,
  // and a notice behind an open modal is unreadable, so a rejection lands in
  // the workspace alert and, for a request Core already moved on, in the
  // refreshed status block. A transient failure keeps its idempotency key for
  // the exact retry.
  const confirmAbandon = async () => {
    try {
      await workspace.abandonDestruction();
    } catch {
      // Shown by the workspace alert and the destruction status block.
    } finally {
      setConfirmation(null);
    }
  };

  // Same contract as abandon: sent once, the dialog closes either way, and a
  // rejection lands in the workspace alert. Success shows in the status block,
  // whose phase changes back to the one Worker now advances.
  const confirmResume = async () => {
    try {
      await workspace.resumeDestruction();
    } catch {
      // Shown by the workspace alert.
    } finally {
      setConfirmation(null);
    }
  };

  return (
    <section aria-labelledby="tenant-lifecycle-title">
    <Card className="space-y-3 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <h2 id="tenant-lifecycle-title" className="text-xs font-semibold text-foreground">
          {text.lifecycle}
        </h2>
        <Badge tone={tenant.status === "ACTIVE" ? "success" : tenant.status === "SUSPENDED" ? "warn" : tenant.status === "PROVISIONING_FAILED" ? "danger" : "neutral"} className="font-mono">
          {tenant.status}
        </Badge>
      </div>

      {tenant.status === "PROVISIONING" && (
        <p role="status" aria-live="polite" className="rounded-lg bg-info-subtle p-3 text-xs text-info-subtle-foreground">
          {workspace.pollExhausted ? text.pollExhausted : text.polling}
        </p>
      )}

      {deleted ? (
        <TenantDestroyStatus
          id={DESTROY_STATUS_ID}
          locale={locale}
          operation={destroyOperation}
          loadError={workspace.destroyError}
          polling={workspace.destroyPolling}
          notAbandonable={
            workspace.mutation.error?.errorCode ===
            "TENANT_DESTROY_NOT_ABANDONABLE"
          }
          onRefresh={() => void workspace.refreshDestruction()}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tenant.status === "ACTIVE" &&
          workspace.permissions.canSuspendOrActivate && (
            <ActionButton
              label={text.suspend}
              disabled={busy}
              variant="secondary"
              onClick={() => setConfirmation("suspend")}
            />
          )}
        {tenant.status === "SUSPENDED" &&
          workspace.permissions.canSuspendOrActivate && (
            <ActionButton
              label={text.activate}
              disabled={busy}
              variant="primary"
              onClick={() => setConfirmation("activate")}
            />
          )}
        {tenant.status === "PROVISIONING_FAILED" &&
          workspace.permissions.canReprovisionOrCancel && (
            <ActionButton
              label={text.reprovision}
              disabled={busy}
              variant="primary"
              onClick={() => setConfirmation("reprovision")}
            />
          )}
        {tenant.status === "PROVISIONING" &&
          workspace.permissions.canReprovisionOrCancel && (
            <ActionButton
              label={text.cancelProvisioning}
              disabled={busy}
              variant="secondary"
              onClick={() => setConfirmation("cancel-provisioning")}
            />
          )}
        {tenant.status !== "DELETED" && workspace.permissions.canSoftDelete && (
          <ActionButton
            label={text.softDelete}
            disabled={busy}
            variant="destructive"
            onClick={() => setConfirmation("soft-delete")}
          />
        )}
        {/* While destruction holds the tenant, the operator's way forward
            leads the deleted tenant's actions: abandon before the drop was
            authorized (the one way back), resume after it halted. */}
        {canAbandon && (
          <ActionButton
            label={text.abandonDestroy}
            disabled={busy}
            variant="secondary"
            onClick={() => setConfirmation("abandon-destroy")}
          />
        )}
        {canResume && (
          <ActionButton
            label={text.resumeDestroy}
            disabled={busy}
            variant="destructive"
            onClick={() => setConfirmation("resume-destroy")}
          />
        )}
        {/* Restore is offered before destroy so the reversible action is the
            first one an admin reaches on a deleted tenant. */}
        {deleted && workspace.permissions.canRestore && (
          <ActionButton
            label={text.restore}
            disabled={busy || heldByDestruction}
            describedBy={heldReason}
            variant="primary"
            onClick={() => setConfirmation("restore")}
          />
        )}
        {deleted && workspace.permissions.canDestroy && (
          <ActionButton
            label={text.destroy}
            disabled={busy || heldByDestruction}
            describedBy={heldReason}
            variant="destructive"
            onClick={() => setConfirmation("destroy")}
          />
        )}
      </div>

      <AlertDialog open={dialogAction !== null} onOpenChange={(open) => !open && setConfirmation(null)}>
        {dialogAction ? (
          <AlertDialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionLabel[dialogAction]}</AlertDialogTitle>
              <AlertDialogDescription>
                {text.confirmAction(actionLabel[dialogAction])}
                {actionHint[dialogAction] ? (
                  <span className="mt-2 block">{actionHint[dialogAction]}</span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{text.cancel}</AlertDialogCancel>
              <AlertDialogAction
                destructive={dialogAction === "soft-delete" || dialogAction === "destroy"}
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
              >
                {text.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

      <ConfirmActionModal
        isOpen={confirmation === "abandon-destroy"}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmAbandon}
        titleEn={en.abandonConfirmTitle(tenant.name)}
        titleAr={ar.abandonConfirmTitle(tenant.name)}
        descriptionEn={en.abandonConfirmDescription(tenant.name)}
        descriptionAr={ar.abandonConfirmDescription(tenant.name)}
        confirmTextEn={en.abandonDestroy}
        confirmTextAr={ar.abandonDestroy}
        loadingLabel={text.abandoning}
        variant="warning"
        isLoading={workspace.mutation.name === "abandon-destroy"}
      />

      <ConfirmActionModal
        isOpen={confirmation === "resume-destroy"}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmResume}
        titleEn={en.resumeConfirmTitle(tenant.name)}
        titleAr={ar.resumeConfirmTitle(tenant.name)}
        descriptionEn={en.resumeConfirmDescription(tenant.name)}
        descriptionAr={ar.resumeConfirmDescription(tenant.name)}
        confirmTextEn={en.resumeDestroy}
        confirmTextAr={ar.resumeDestroy}
        loadingLabel={text.resuming}
        variant="danger"
        isLoading={workspace.mutation.name === "resume-destroy"}
      />
    </Card>
    </section>
  );
}

function ActionButton({
  label,
  disabled,
  describedBy,
  variant,
  onClick,
}: {
  label: string;
  disabled: boolean;
  describedBy?: string;
  variant: "primary" | "secondary" | "destructive";
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
