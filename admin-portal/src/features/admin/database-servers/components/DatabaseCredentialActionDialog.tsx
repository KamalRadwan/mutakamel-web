"use client";

import { AlertTriangle, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import type { DatabaseCredentialAction } from "../types";

interface DatabaseCredentialActionDialogProps {
  action: DatabaseCredentialAction | null;
  reason: string;
  error: string | null;
  pending: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}

const actionCopy = {
  "retry-bootstrap": {
    title: "Retry server registration setup",
    description:
      "Core will resume every incomplete access binding from its exact persisted recovery state. Passwords remain inside the service boundary.",
    submit: "Retry setup",
    tone: "blue",
  },
  regenerate: {
    title: "Rotate application password",
    description:
      "Core will keep the database principal fixed, rotate its password, invalidate affected pools, and advance the credential revision.",
    submit: "Rotate password",
    tone: "amber",
  },
  reconcile: {
    title: "Reconcile uncertain rotation",
    description:
      "Core will verify and promote the already staged encrypted candidate. It will not generate a different password.",
    submit: "Reconcile rotation",
    tone: "amber",
  },
  "regenerate-system": {
    title: "Rotate provisioning password",
    description:
      "Core will preserve the fixed principal, rotate its encrypted password, and advance its fenced credential revision.",
    submit: "Rotate password",
    tone: "amber",
  },
  "reconcile-system": {
    title: "Reconcile provisioning principal",
    description:
      "Core will reapply and verify the exact staged candidate without creating a different password.",
    submit: "Reconcile rotation",
    tone: "amber",
  },
} as const;

export function DatabaseCredentialActionDialog({
  action,
  reason,
  error,
  pending,
  onReasonChange,
  onClose,
  onSubmit,
}: DatabaseCredentialActionDialogProps) {
  if (!action) return null;

  const copy = actionCopy[action.kind];
  const isCaution = copy.tone === "amber";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-action-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-2 ${
                isCaution
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              }`}
            >
              {isCaution ? <KeyRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="credential-action-title" className="text-base font-semibold text-slate-950 dark:text-white">
                {copy.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {copy.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {action.kind !== "retry-bootstrap" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-4 py-3 text-xs dark:bg-slate-800/60">
              <dt className="text-slate-500 dark:text-slate-400">{"applicationKey" in action ? "Application" : "Service"}</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{"applicationKey" in action ? action.applicationKey : "Provisioning"}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Principal</dt>
              <dd className="break-all font-mono text-slate-700 dark:text-slate-300">{action.databasePrincipal}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Expected revision</dt>
              <dd className="font-mono text-slate-700 dark:text-slate-300">{action.expectedCredentialRevision}</dd>
            </dl>
          )}

          <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              No password will be returned, displayed, copied, downloaded, or stored by this browser. The response contains only safe status and revision evidence.
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Operator reason
            </span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder="Explain why this credential operation is required"
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <span className="mt-1 block text-xs text-slate-400">{reason.trim().length}/500 · minimum 8 characters</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/70">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={pending || reason.trim().length < 8}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isCaution ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
