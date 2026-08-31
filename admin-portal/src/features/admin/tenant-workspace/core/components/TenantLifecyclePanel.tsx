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
  Checkbox,
} from "@/design-system";
import type { useTenantCoreWorkspace } from "../hooks/useTenantCoreWorkspace";
import {
  tenantWorkspaceCopy,
  type TenantWorkspaceLocale,
} from "./copy";

type LifecycleAction =
  | "suspend"
  | "activate"
  | "reprovision"
  | "cancel-provisioning"
  | "soft-delete"
  | "restore"
  | "destroy";

export interface TenantLifecyclePanelProps {
  locale: TenantWorkspaceLocale;
  workspace: ReturnType<typeof useTenantCoreWorkspace>;
  onDestroyed?: () => void;
}

export function TenantLifecyclePanel({
  locale,
  workspace,
  onDestroyed,
}: TenantLifecyclePanelProps) {
  const text = tenantWorkspaceCopy(locale);
  const tenant = workspace.tenant;
  const [confirmation, setConfirmation] = useState<LifecycleAction | null>(
    null,
  );
  const [destroySubscriptions, setDestroySubscriptions] = useState(false);
  if (!tenant) return null;

  const busy = workspace.mutation.name !== null;
  const actionLabel: Record<LifecycleAction, string> = {
    suspend: text.suspend,
    activate: text.activate,
    reprovision: text.reprovision,
    "cancel-provisioning": text.cancelProvisioning,
    "soft-delete": text.softDelete,
    restore: text.restore,
    destroy: text.destroy,
  };
  const actionHint: Partial<Record<LifecycleAction, string>> = {
    restore: text.restoreHint,
    destroy: text.destroyHint,
  };

  const confirm = async () => {
    if (!confirmation) return;
    try {
      if (confirmation === "suspend") await workspace.suspend();
      if (confirmation === "activate") await workspace.activate();
      if (confirmation === "reprovision") await workspace.reprovision();
      if (confirmation === "cancel-provisioning") {
        await workspace.cancelProvisioning();
      }
      if (confirmation === "soft-delete") await workspace.softDelete();
      if (confirmation === "restore") await workspace.restore();
      if (confirmation === "destroy") {
        await workspace.destroy(destroySubscriptions);
        onDestroyed?.();
      }
      setConfirmation(null);
    } catch {
      // The hook exposes normalized failure evidence beside the controls.
    }
  };

  return (
    <section aria-labelledby="tenant-lifecycle-title">
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h2 id="tenant-lifecycle-title" className="text-sm font-semibold text-foreground">
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
        {/* Restore is offered before destroy so the reversible action is the
            first one an admin reaches on a deleted tenant. */}
        {tenant.status === "DELETED" && workspace.permissions.canRestore && (
          <ActionButton
            label={text.restore}
            disabled={busy}
            variant="primary"
            onClick={() => setConfirmation("restore")}
          />
        )}
        {tenant.status === "DELETED" && workspace.permissions.canDestroy && (
          <ActionButton
            label={text.destroy}
            disabled={busy}
            variant="destructive"
            onClick={() => setConfirmation("destroy")}
          />
        )}
      </div>

      <AlertDialog open={confirmation !== null} onOpenChange={(open) => !open && setConfirmation(null)}>
        {confirmation ? (
          <AlertDialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionLabel[confirmation]}</AlertDialogTitle>
              <AlertDialogDescription>
                {text.confirmAction(actionLabel[confirmation])}
                {actionHint[confirmation] ? (
                  <span className="mt-2 block">{actionHint[confirmation]}</span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {confirmation === "destroy" ? (
              <label htmlFor="destroy-subscriptions" className="flex min-h-11 items-center gap-3 text-sm text-foreground">
                <Checkbox
                  id="destroy-subscriptions"
                  name="destroySubscriptions"
                  checked={destroySubscriptions}
                  onCheckedChange={(checked) => setDestroySubscriptions(checked === true)}
                />
                <span>{text.destroySubscriptions}</span>
              </label>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{text.cancel}</AlertDialogCancel>
              <AlertDialogAction
                destructive={confirmation === "soft-delete" || confirmation === "destroy"}
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
    </Card>
    </section>
  );
}

function ActionButton({
  label,
  disabled,
  variant,
  onClick,
}: {
  label: string;
  disabled: boolean;
  variant: "primary" | "secondary" | "destructive";
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
