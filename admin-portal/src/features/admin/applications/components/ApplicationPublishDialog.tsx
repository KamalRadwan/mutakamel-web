"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, Loader2, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-publish-title"
        aria-describedby="application-publish-description"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-violet-300/40 bg-white shadow-2xl dark:border-violet-900 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white dark:border-slate-800">
          <div>
            <h2 id="application-publish-title" className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenCheck className="h-4 w-4 text-violet-300" />
              {copy.title}
            </h2>
            <p id="application-publish-description" className="mt-1 text-xs leading-relaxed text-slate-300">
              {copy.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t.applications.detail.configuration.close}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4 p-5">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
            <Revision label={copy.catalogueRevision} value={application.catalogueRevision} />
            <Revision label={copy.publicationRevision} value={application.publicationRevision} />
          </dl>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {copy.reason}
            <textarea
              autoFocus
              required
              maxLength={256}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.reasonPlaceholder}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.applications.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {copy.confirm}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Revision({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold" dir="ltr">{value}</dd>
    </div>
  );
}
