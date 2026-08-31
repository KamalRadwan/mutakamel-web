import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Field, Textarea, Button } from "@/design-system";
import type { ApplicationLifecycleStatus } from "../types";

export type ApplicationLifecycleAction = "activate" | "deprecate" | "disable";

interface Props {
  action: ApplicationLifecycleAction | null;
  currentStatus: ApplicationLifecycleStatus;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
}

export function ApplicationLifecycleDialog({ action, currentStatus, isSubmitting, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (action) {
      queueMicrotask(() => {
        setReason("");
        setReasonError(null);
        setSubmissionError(null);
      });
    }
  }, [action]);

  if (!action) return null;
  const targetStatus = action === "activate" ? "ACTIVE" : action === "deprecate" ? "DEPRECATED" : "DISABLED";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError(t.applications.detail.lifecycle.reasonRequired);
      queueMicrotask(() => reasonRef.current?.focus());
      return;
    }
    setReasonError(null);
    setSubmissionError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (submissionError) {
      setSubmissionError(readSubmissionMessage(submissionError, t.applications.detail.lifecycle.failed));
      queueMicrotask(() => submissionErrorRef.current?.focus());
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t.applications.detail.lifecycle[action]} {t.applications.detail.lifecycle.titleSuffix}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t.applications.detail.lifecycle.transitionPrefix} {currentStatus} {t.applications.detail.lifecycle.transitionJoin} {targetStatus}.
          </p>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t.applications.detail.lifecycle.reason} required error={reasonError ?? undefined}>
            {(fp) => (
              <Textarea
                {...fp}
                ref={reasonRef}
                required
                invalid={Boolean(reasonError)}
                maxLength={256}
                rows={3}
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
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {t.applications.detail.lifecycle.confirm} {t.applications.detail.lifecycle[action]}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function readSubmissionMessage(value: unknown, fallback: string) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return fallback;
}
