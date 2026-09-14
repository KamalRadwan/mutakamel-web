"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, KeyRound, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { DatabaseCredentialAction } from "../types";

interface DatabaseCredentialActionDialogProps {
  action: DatabaseCredentialAction | null;
  reason: string;
  error: string | null;
  errorCode?: string;
  correlationId?: string;
  pending: boolean;
  submitDisabled?: boolean;
  refreshError?: string | null;
  onRefresh?: () => Promise<void>;
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
  errorCode,
  correlationId,
  pending,
  submitDisabled = false,
  refreshError,
  onRefresh,
  onReasonChange,
  onClose,
  onSubmit,
}: DatabaseCredentialActionDialogProps) {
  const { dir, lang, t } = useI18n();
  const copy = t.databaseServerDetail.credentialDialog;
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (!action) return null;

  const entry = copy[ACTION_COPY_KEY[action.kind]];
  const isCaution = CAUTION_KINDS.has(action.kind);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent dir={dir} className="max-w-md p-3 sm:p-3.5">
        <DialogHeader className="flex-row items-center gap-2.5 space-y-0 pb-2 border-b border-border">
          <span
            className={`shrink-0 rounded-lg p-1.5 ${
              isCaution
                ? "bg-warning-subtle text-warning-subtle-foreground"
                : "bg-info-subtle text-info-subtle-foreground"
            }`}
          >
            {isCaution ? <KeyRound className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
          </span>
          <div>
            <DialogTitle className="text-sm font-semibold">{entry.title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">{entry.description}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {action.kind !== "retry-bootstrap" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted p-2.5 text-xs">
              <dt className="text-muted-foreground">{"applicationKey" in action ? copy.applicationLabel : copy.serviceLabel}</dt>
              <dd className="font-semibold text-foreground">{"applicationKey" in action ? action.applicationKey : "Provisioning"}</dd>
              <dt className="text-muted-foreground">{copy.principalLabel}</dt>
              <dd className="break-all font-mono text-foreground">{action.databasePrincipal}</dd>
              <dt className="text-muted-foreground">{copy.expectedRevisionLabel}</dt>
              <dd className="font-mono text-foreground">{action.expectedCredentialRevision}</dd>
            </dl>
          )}

          <div className="flex gap-2 rounded-md border border-info/30 bg-info-subtle p-2 text-xs text-info-subtle-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>{copy.safetyNotice}</p>
          </div>

          <Field label={copy.reasonLabel} hideLabel hint={copy.reasonHint.replace("{{count}}", String(reason.trim().length))} required>
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                rows={2}
                minLength={8}
                maxLength={500}
                autoFocus
                placeholder={`${copy.reasonPlaceholder || copy.reasonLabel} *`}
              />
            )}
          </Field>

          {error && (
            <div ref={errorRef} tabIndex={-1} className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle p-2 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p>{error}</p>
                {errorCode && <code className="block break-words font-mono" dir="ltr">{errorCode}</code>}
                {correlationId && (
                  <p>
                    {lang === "ar" ? "معرّف التتبّع" : "Correlation ID"}: {" "}
                    <code className="break-all font-mono" dir="ltr">{correlationId}</code>
                  </p>
                )}
              </div>
            </div>
          )}
          {refreshError && (
            <div role="alert" className="space-y-2 rounded-md border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground">
              <p>{refreshError}</p>
              {onRefresh && (
                <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => void onRefresh()}>
                  {lang === "ar" ? "تحديث الحالة" : "Refresh status"}
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            {copy.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void onSubmit()}
            loading={pending}
            disabled={submitDisabled || reason.trim().length < 8}
          >
            {entry.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
