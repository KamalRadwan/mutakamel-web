import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (action) {
      queueMicrotask(() => {
        setReason("");
        setError(null);
      });
    }
  }, [action]);

  if (!action) return null;
  const targetStatus = action === "activate" ? "ACTIVE" : action === "deprecate" ? "DEPRECATED" : "DISABLED";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return setError(t.applications.detail.lifecycle.reasonRequired);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (submissionError) {
      setError(readSubmissionMessage(submissionError, t.applications.detail.lifecycle.failed));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t.applications.detail.lifecycle[action]} {t.applications.detail.lifecycle.titleSuffix}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t.applications.detail.lifecycle.transitionPrefix} {currentStatus} {t.applications.detail.lifecycle.transitionJoin} {targetStatus}.
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.applications.detail.lifecycle.reason}>
            {(fp) => (
              <Textarea {...fp} required maxLength={256} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            )}
          </Field>
          {error && (
            <p role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300">
              {error}
            </p>
          )}
          <footer className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
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
