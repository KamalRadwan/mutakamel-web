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
  const { dir, t } = useI18n();
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
      <DialogContent dir={dir}>
        <DialogHeader className="flex-row items-start gap-3 space-y-0">
          <span
            className={`shrink-0 rounded-lg p-2 ${
              isCaution
                ? "bg-warning-subtle text-warning-subtle-foreground"
                : "bg-info-subtle text-info-subtle-foreground"
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
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-muted px-4 py-3 text-xs">
              <dt className="text-muted-foreground">{"applicationKey" in action ? copy.applicationLabel : copy.serviceLabel}</dt>
              <dd className="font-semibold text-foreground">{"applicationKey" in action ? action.applicationKey : "Provisioning"}</dd>
              <dt className="text-muted-foreground">{copy.principalLabel}</dt>
              <dd className="break-all font-mono text-foreground">{action.databasePrincipal}</dd>
              <dt className="text-muted-foreground">{copy.expectedRevisionLabel}</dt>
              <dd className="font-mono text-foreground">{action.expectedCredentialRevision}</dd>
            </dl>
          )}

          <div className="flex gap-2 rounded-lg border border-info/30 bg-info-subtle px-3 py-2.5 text-xs text-info-subtle-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{copy.safetyNotice}</p>
          </div>

          <Field label={copy.reasonLabel} hint={copy.reasonHint.replace("{{count}}", String(reason.trim().length))} required>
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                rows={3}
                minLength={8}
                maxLength={500}
                autoFocus
                placeholder={copy.reasonPlaceholder}
              />
            )}
          </Field>

          {error && (
            <div ref={errorRef} tabIndex={-1} className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2.5 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" role="alert">
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
            loading={pending}
            disabled={reason.trim().length < 8}
          >
            {entry.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
