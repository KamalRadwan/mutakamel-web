"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Field, Textarea, Button } from "@/design-system";
import type { ApplicationView, PublishApplicationDto } from "../types";

interface Props {
  isOpen: boolean;
  application: ApplicationView;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (dto: PublishApplicationDto) => Promise<unknown>;
}

export function ApplicationPublishDialog({
  isOpen,
  application,
  isSubmitting,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const copy = t.applications.detail.publication;
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setReason("");
      setError(null);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setError(copy.reasonRequired);
      return;
    }

    setError(null);
    try {
      await onConfirm({
        expectedCatalogueRevision: application.catalogueRevision,
        expectedPublicationRevision: application.publicationRevision,
        reason: normalizedReason,
      });
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : copy.failed,
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BookOpenCheck className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            {copy.title}
          </DialogTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-3 text-xs">
            <Revision label={copy.catalogueRevision} value={application.catalogueRevision} />
            <Revision label={copy.publicationRevision} value={application.publicationRevision} />
          </dl>

          <Field label={copy.reason}>
            {(fp) => (
              <Textarea
                {...fp}
                autoFocus
                required
                maxLength={256}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={copy.reasonPlaceholder}
              />
            )}
          </Field>

          {error && (
            <p role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300">
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {copy.confirm}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Revision({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-foreground" dir="ltr">{value}</dd>
    </div>
  );
}
