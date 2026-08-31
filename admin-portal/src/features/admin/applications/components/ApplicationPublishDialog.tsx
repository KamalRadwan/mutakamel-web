"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenCheck } from "lucide-react";
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
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setReason("");
      setReasonError(null);
      setSubmissionError(null);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setReasonError(copy.reasonRequired);
      queueMicrotask(() => reasonRef.current?.focus());
      return;
    }

    setReasonError(null);
    setSubmissionError(null);
    try {
      await onConfirm({
        expectedCatalogueRevision: application.catalogueRevision,
        expectedPublicationRevision: application.publicationRevision,
        reason: normalizedReason,
      });
      onClose();
    } catch (submissionError) {
      setSubmissionError(submissionError instanceof Error ? submissionError.message : copy.failed);
      queueMicrotask(() => submissionErrorRef.current?.focus());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BookOpenCheck className="size-4 text-primary" aria-hidden="true" />
            {copy.title}
          </DialogTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-3 text-xs">
            <Revision label={copy.catalogueRevision} value={application.catalogueRevision} />
            <Revision label={copy.publicationRevision} value={application.publicationRevision} />
          </dl>

          <Field label={copy.reason} required error={reasonError ?? undefined}>
            {(fp) => (
              <Textarea
                {...fp}
                ref={reasonRef}
                autoFocus
                required
                invalid={Boolean(reasonError)}
                maxLength={256}
                rows={3}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder={copy.reasonPlaceholder}
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
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-foreground" dir="ltr">{value}</dd>
    </div>
  );
}
