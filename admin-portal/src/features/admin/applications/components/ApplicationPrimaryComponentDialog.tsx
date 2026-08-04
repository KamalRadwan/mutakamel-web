"use client";

import { Boxes, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useApplicationPrimaryComponentDialog } from "../hooks/useApplicationPrimaryComponentDialog";

interface Props {
  isOpen: boolean;
  applicationKey: string;
  technicalDefinitionRevision: string;
  isSubmitting: boolean;
  commandError: NormalizedApiError | null;
  canRetryExactIntent: boolean;
  onClose: () => void;
  onConfirm: (contractVersion: number, reason: string) => Promise<boolean>;
  onRetryExactIntent: () => Promise<boolean>;
  onClearCommandError: () => void;
}

export function ApplicationPrimaryComponentDialog({
  isOpen,
  applicationKey,
  technicalDefinitionRevision,
  isSubmitting,
  commandError,
  canRetryExactIntent,
  onClose,
  onConfirm,
  onRetryExactIntent,
  onClearCommandError,
}: Props) {
  const { t } = useI18n();
  const {
    dialogRef,
    initialFocusRef,
    contractVersion,
    setContractVersion,
    reason,
    setReason,
    validationError,
    close,
    onKeyDown,
    submit,
  } = useApplicationPrimaryComponentDialog({
    isOpen,
    isSubmitting,
    onClose,
    onConfirm,
    onClearCommandError,
  });

  if (!isOpen) return null;

  const isRecoverable =
    commandError?.errorCode === "GW.IDEM.IN_FLIGHT" ||
    (commandError?.httpStatus ?? 0) >= 500 ||
    commandError?.errorCode === "UNKNOWN_ERROR";
  const commandMessage = commandError?.errorCode === "APPLICATION_TECHNICAL_DEFINITION_REVISION_STALE"
    ? t.applications.technicalProvisioning.staleMessage
    : commandError?.httpStatus === 403
      ? t.applications.technicalProvisioning.forbiddenMessage
      : commandError?.message;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="primary-component-title"
        aria-describedby="primary-component-description"
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-cyan-300/40 bg-white shadow-2xl dark:border-cyan-900 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white dark:border-slate-800">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              {t.applications.technicalProvisioning.bindingEyebrow}
            </p>
            <h2 id="primary-component-title" className="mt-1 flex items-center gap-2 text-sm font-black">
              <Boxes className="h-4 w-4" />
              {t.applications.technicalProvisioning.bindingTitle}
            </h2>
            <p id="primary-component-description" className="mt-1 text-xs leading-relaxed text-slate-300">
              {t.applications.technicalProvisioning.bindingDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label={t.applications.technicalProvisioning.closeDialog}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-5 p-5">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
            <div className="flex items-center gap-2 text-xs font-black text-cyan-950 dark:text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              {t.applications.technicalProvisioning.derivedMapping}
            </div>
            <dl className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2">
              <Mapping label={t.applications.technicalProvisioning.applicationKey} value={applicationKey} />
              <Mapping label={t.applications.technicalProvisioning.componentKey} value={applicationKey} />
              <Mapping label={t.applications.technicalProvisioning.ownerApplication} value={applicationKey} />
              <Mapping label={t.applications.technicalProvisioning.workerTarget} value={`${applicationKey}-app`} />
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-300">
              {t.applications.technicalProvisioning.safeBoundary}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.applications.technicalProvisioning.contractVersion}
              <input
                ref={initialFocusRef}
                type="number"
                min={1}
                step={1}
                required
                value={contractVersion}
                onChange={(event) => setContractVersion(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.applications.technicalProvisioning.changeReason}
              <textarea
                required
                maxLength={256}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t.applications.technicalProvisioning.reasonPlaceholder}
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>

          <p className="font-mono text-[10px] text-slate-500">
            {t.applications.technicalProvisioning.revisionLabel}: {technicalDefinitionRevision}
          </p>

          {(validationError || commandError) && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <p>{validationError || commandMessage}</p>
              {commandError?.correlationId && (
                <p className="mt-1 font-mono text-[10px] opacity-75">
                  {t.applications.technicalProvisioning.correlationId}: {commandError.correlationId}
                </p>
              )}
            </div>
          )}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.applications.cancel}
            </button>
            {isRecoverable && canRetryExactIntent && (
              <button
                type="button"
                onClick={() => void onRetryExactIntent().then((completed) => completed && onClose())}
                disabled={isSubmitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.applications.technicalProvisioning.retryExactIntent}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || isRecoverable}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSubmitting
                ? t.applications.technicalProvisioning.linking
                : t.applications.technicalProvisioning.linkComponent}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Mapping({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-cyan-700 dark:text-cyan-300">{label}</dt>
      <dd className="mt-1 break-all font-mono font-black text-slate-900 dark:text-white" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
