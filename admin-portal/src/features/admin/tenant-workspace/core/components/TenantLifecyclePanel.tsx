"use client";

import { useState } from "react";
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
    destroy: text.destroy,
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
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {text.lifecycle}
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {tenant.status}
        </span>
      </div>

      {tenant.status === "PROVISIONING" && (
        <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          {workspace.pollExhausted ? text.pollExhausted : text.polling}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {tenant.status === "ACTIVE" &&
          workspace.permissions.canSuspendOrActivate && (
            <ActionButton
              label={text.suspend}
              disabled={busy}
              tone="amber"
              onClick={() => setConfirmation("suspend")}
            />
          )}
        {tenant.status === "SUSPENDED" &&
          workspace.permissions.canSuspendOrActivate && (
            <ActionButton
              label={text.activate}
              disabled={busy}
              tone="emerald"
              onClick={() => setConfirmation("activate")}
            />
          )}
        {tenant.status === "PROVISIONING_FAILED" &&
          workspace.permissions.canReprovisionOrCancel && (
            <ActionButton
              label={text.reprovision}
              disabled={busy}
              tone="blue"
              onClick={() => setConfirmation("reprovision")}
            />
          )}
        {tenant.status === "PROVISIONING" &&
          workspace.permissions.canReprovisionOrCancel && (
            <ActionButton
              label={text.cancelProvisioning}
              disabled={busy}
              tone="amber"
              onClick={() => setConfirmation("cancel-provisioning")}
            />
          )}
        {tenant.status !== "DELETED" && workspace.permissions.canSoftDelete && (
          <ActionButton
            label={text.softDelete}
            disabled={busy}
            tone="rose"
            onClick={() => setConfirmation("soft-delete")}
          />
        )}
        {tenant.status === "DELETED" && workspace.permissions.canDestroy && (
          <ActionButton
            label={text.destroy}
            disabled={busy}
            tone="rose"
            onClick={() => setConfirmation("destroy")}
          />
        )}
      </div>

      {confirmation && (
        <div
          role="alertdialog"
          aria-label={actionLabel[confirmation]}
          className="space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
        >
          <p className="font-semibold">
            {locale === "ar"
              ? `تأكيد الإجراء: ${actionLabel[confirmation]}`
              : `Confirm action: ${actionLabel[confirmation]}`}
          </p>
          {confirmation === "destroy" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={destroySubscriptions}
                onChange={(event) =>
                  setDestroySubscriptions(event.target.checked)
                }
              />
              <span>{text.destroySubscriptions}</span>
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
              className="rounded-lg bg-rose-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {text.confirm}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmation(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold dark:border-slate-700"
            >
              {text.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionButton({
  label,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  disabled: boolean;
  tone: "amber" | "blue" | "emerald" | "rose";
  onClick: () => void;
}) {
  const tones = {
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    emerald:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  } as const;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}
