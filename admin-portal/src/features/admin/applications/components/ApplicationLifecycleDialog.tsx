import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Field, Input, Textarea, Button } from "@/design-system";
import type { ApplicationLifecycleStatus } from "../types";
import { localizeApplicationError } from "../lib/application-error-copy";

export type ApplicationLifecycleAction = "activate" | "deprecate" | "disable";

interface Props {
  action: ApplicationLifecycleAction | null;
  applicationKey: string;
  currentStatus: ApplicationLifecycleStatus;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
}

export function ApplicationLifecycleDialog({ action, applicationKey, currentStatus, isSubmitting, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [confirmationKey, setConfirmationKey] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (action) {
      queueMicrotask(() => {
        setReason("");
        setConfirmationKey("");
        setReasonError(null);
        setSubmissionError(null);
      });
    }
  }, [action, applicationKey]);

  if (!action) return null;
  const targetStatus = action === "activate" ? "ACTIVE" : action === "deprecate" ? "DEPRECATED" : "DISABLED";
  const isDisable = action === "disable";
  const busy = isSubmitting || isConfirming;
  const disableAllowed = !isDisable || (
    (currentStatus === "ACTIVE" || currentStatus === "DEPRECATED") &&
    confirmationKey === applicationKey && reason.trim().length >= 8
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || confirmingRef.current || !disableAllowed) return;
    if (!reason.trim()) {
      setReasonError(t.applications.detail.lifecycle.reasonRequired);
      queueMicrotask(() => reasonRef.current?.focus());
      return;
    }
    setReasonError(null);
    setSubmissionError(null);
    confirmingRef.current = true;
    setIsConfirming(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (submissionError) {
      setSubmissionError(localizeApplicationError(submissionError, t));
      queueMicrotask(() => submissionErrorRef.current?.focus());
    } finally {
      confirmingRef.current = false;
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto p-3 sm:p-3.5">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t.applications.detail.lifecycle[action]} {t.applications.detail.lifecycle.titleSuffix}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t.applications.detail.lifecycle.transitionPrefix} {currentStatus} {t.applications.detail.lifecycle.transitionJoin} {targetStatus}.
          </p>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          {isDisable && <>
            <p role="alert" className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground">
              {t.applications.detail.lifecycle.disableWarning}
            </p>
            <Field label={t.applications.detail.lifecycle.confirmApplicationKey} hint={applicationKey} required>
              {(fp) => <Input {...fp} dir="ltr" autoComplete="off" spellCheck={false} disabled={busy} value={confirmationKey} onChange={(event) => setConfirmationKey(event.target.value)} />}
            </Field>
          </>}
          <Field label={t.applications.detail.lifecycle.reason} hideLabel={!isDisable} hint={isDisable ? t.applications.detail.lifecycle.disableReasonMinimum : undefined} required error={reasonError ?? undefined}>
            {(fp) => (
              <Textarea
                {...fp}
                ref={reasonRef}
                required
                disabled={busy}
                placeholder={`${t.applications.detail.lifecycle.reason} *`}
                invalid={Boolean(reasonError)}
                maxLength={256}
                rows={2}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError) setReasonError(null);
                }}
              />
            )}
          </Field>
          {submissionError && (
            <div
              ref={submissionErrorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {submissionError}
            </div>
          )}
          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            <Button type="submit" variant={isDisable ? "destructive" : "primary"} size="sm" loading={busy} disabled={!disableAllowed}>
              {t.applications.detail.lifecycle.confirm} {t.applications.detail.lifecycle[action]}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
