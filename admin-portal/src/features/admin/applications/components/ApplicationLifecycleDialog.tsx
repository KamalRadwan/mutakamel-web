import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
      setError(submissionError instanceof Error ? submissionError.message : t.applications.detail.lifecycle.failed);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="lifecycle-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"><header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><h2 id="lifecycle-title" className="text-sm font-black">{t.applications.detail.lifecycle[action]} {t.applications.detail.lifecycle.titleSuffix}</h2><p className="mt-1 text-xs text-slate-500">{t.applications.detail.lifecycle.transitionPrefix} {currentStatus} {t.applications.detail.lifecycle.transitionJoin} {targetStatus}.</p></div><button type="button" onClick={onClose} aria-label={t.applications.detail.configuration.close} className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header><form onSubmit={submit} className="space-y-4 p-5"><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t.applications.detail.lifecycle.reason}<textarea autoFocus required maxLength={256} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" /></label>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}<footer className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t.applications.cancel}</button><button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">{isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t.applications.detail.lifecycle.confirm} {t.applications.detail.lifecycle[action]}</button></footer></form></section></div>;
}
