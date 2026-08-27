"use client";

import { AlertTriangle, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
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

const ACTION_COPY_KEY: Record<
  DatabaseCredentialAction["kind"],
  keyof Omit<
    Dictionary["databaseServerDetail"]["credentialDialog"],
    "applicationLabel" | "serviceLabel" | "principalLabel" | "expectedRevisionLabel" | "safetyNotice" | "reasonLabel" | "reasonPlaceholder" | "reasonHint" | "cancel" | "close"
  >
> = {
  "retry-bootstrap": "retryBootstrap",
  regenerate: "regenerate",
  reconcile: "reconcile",
  "regenerate-system": "regenerateSystem",
  "reconcile-system": "reconcileSystem",
};

const CAUTION_KINDS = new Set<DatabaseCredentialAction["kind"]>([
  "regenerate",
  "reconcile",
  "regenerate-system",
  "reconcile-system",
]);

export function DatabaseCredentialActionDialog({
  action,
  reason,
  error,
  pending,
  onReasonChange,
  onClose,
  onSubmit,
}: DatabaseCredentialActionDialogProps) {
  const { t } = useI18n();
  const copy = t.databaseServerDetail.credentialDialog;

  if (!action) return null;

  const entry = copy[ACTION_COPY_KEY[action.kind]];
  const isCaution = CAUTION_KINDS.has(action.kind);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader className="flex-row items-start gap-3 space-y-0">
          <span
            className={`shrink-0 rounded-lg p-2 ${
              isCaution
                ? "bg-warn-100 text-warn-700 dark:bg-warn-950/50 dark:text-warn-300"
                : "bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
            }`}
          >
            {isCaution ? <KeyRound className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div>
            <DialogTitle className="text-base">{entry.title}</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5">{entry.description}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {action.kind !== "retry-bootstrap" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-ink-100 px-4 py-3 text-xs dark:bg-ink-800/60">
              <dt className="text-muted-foreground">{"applicationKey" in action ? copy.applicationLabel : copy.serviceLabel}</dt>
              <dd className="font-semibold text-foreground">{"applicationKey" in action ? action.applicationKey : "Provisioning"}</dd>
              <dt className="text-muted-foreground">{copy.principalLabel}</dt>
              <dd className="break-all font-mono text-foreground">{action.databasePrincipal}</dd>
              <dt className="text-muted-foreground">{copy.expectedRevisionLabel}</dt>
              <dd className="font-mono text-foreground">{action.expectedCredentialRevision}</dd>
            </dl>
          )}

          <div className="flex gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{copy.safetyNotice}</p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-foreground">
              {copy.reasonLabel}
            </span>
            <Textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={3}
              maxLength={500}
              autoFocus
              placeholder={copy.reasonPlaceholder}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {copy.reasonHint.replace("{{count}}", String(reason.trim().length))}
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-xs text-danger-700 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-300" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {copy.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSubmit()}
            disabled={pending || reason.trim().length < 8}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {entry.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
