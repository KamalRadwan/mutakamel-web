import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type { ApplicationView } from "@/features/admin/applications/types";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

interface Props {
  isOpen: boolean;
  boundApplicationKeys: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onBootstrap: (applicationKey: string, expectedCatalogueRevision: string, expectedPolicyRevision: string, reason: string) => Promise<unknown>;
}

export function AddDatabaseApplicationDialog({ isOpen, boundApplicationKeys, isSubmitting, onClose, onBootstrap }: Props) {
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boundKeyFingerprint = boundApplicationKeys.join(",");
  const boundKeys = useMemo(() => new Set(boundKeyFingerprint ? boundKeyFingerprint.split(",") : []), [boundKeyFingerprint]);
  const available = useMemo(() => applications.filter((application) => !boundKeys.has(application.key) && application.lifecycleStatus === "ACTIVE" && application.publicationStatus === "PUBLISHED" && application.databaseAccessMode === "TENANT_DATABASE"), [applications, boundKeys]);
  const selected = available.find((application) => application.key === selectedKey) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setIsLoading(true);
      setError(null);
      setReason("");
      applicationsApi.list({ page: 1, limit: 100, lifecycleStatus: "ACTIVE", publicationStatus: "PUBLISHED", databaseAccessMode: "TENANT_DATABASE" })
        .then(({ data }) => {
          setApplications(data);
          setSelectedKey(data.find((application) => !boundKeys.has(application.key) && application.lifecycleStatus === "ACTIVE" && application.publicationStatus === "PUBLISHED" && application.databaseAccessMode === "TENANT_DATABASE")?.key ?? "");
        })
        .catch((requestError) => setError(normalizeApiError(requestError).message))
        .finally(() => setIsLoading(false));
    });
  }, [boundKeys, isOpen]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return setError("Select an eligible Application.");
    if (reason.trim().length < 8) return setError("Enter a reason of at least 8 characters.");
    setError(null);
    try {
      await onBootstrap(selected.key, selected.catalogueRevision, selected.databasePolicy.policyRevision, reason.trim());
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Application access could not be initialized.");
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="add-database-application-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"><header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div><h2 id="add-database-application-title" className="flex items-center gap-2 text-sm font-black"><Plus className="h-4 w-4 text-blue-500" />Add Application access</h2><p className="mt-1 text-xs text-slate-500">Core creates the fixed principal and password. No secret is returned to this portal.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header><form onSubmit={submit} className="space-y-4 p-5">{isLoading ? <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading eligible Applications…</div> : !available.length ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-slate-700">Every eligible ACTIVE + PUBLISHED Application already has a binding.</div> : <><label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Application<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950">{available.map((application) => <option key={application.id} value={application.key}>{application.name} · {application.databasePrincipal}</option>)}</select></label>{selected && <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/30"><div><span className="block text-[10px] font-bold uppercase text-blue-600">Catalogue revision</span><code>{selected.catalogueRevision}</code></div><div><span className="block text-[10px] font-bold uppercase text-blue-600">Policy revision</span><code>{selected.databasePolicy.policyRevision}</code></div></div>}<label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Operational reason<textarea required minLength={8} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950" /></label></>}{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}<footer className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button><button type="submit" disabled={isSubmitting || isLoading || !available.length} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">{isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Initialize access</button></footer></form></section></div>;
}
