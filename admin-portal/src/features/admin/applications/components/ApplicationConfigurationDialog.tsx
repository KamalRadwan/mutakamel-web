import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { ApplicationView, UpdateApplicationDatabasePolicyDto, UpdateApplicationDto } from "../types";

interface Props {
  mode: "metadata" | "policy" | null;
  application: ApplicationView;
  isSubmitting: boolean;
  onClose: () => void;
  onUpdateMetadata: (dto: UpdateApplicationDto) => Promise<unknown>;
  onUpdatePolicy: (dto: UpdateApplicationDatabasePolicyDto) => Promise<unknown>;
}

export function ApplicationConfigurationDialog({ mode, application, isSubmitting, onClose, onUpdateMetadata, onUpdatePolicy }: Props) {
  const { t } = useI18n();
  const copy = t.applications.detail.configuration;
  const [name, setName] = useState(application.name);
  const [description, setDescription] = useState(application.description ?? "");
  const [commercialMode, setCommercialMode] = useState(application.commercialMode);
  const [visibility, setVisibility] = useState(application.catalogueVisibility);
  const [enableOnNewServers, setEnableOnNewServers] = useState(application.databasePolicy.enableOnNewServers);
  const [rotationEnabled, setRotationEnabled] = useState(application.databasePolicy.rotationEnabled);
  const [rotationIntervalHours, setRotationIntervalHours] = useState(String(application.databasePolicy.rotationIntervalHours));
  const [windowStart, setWindowStart] = useState(String(application.databasePolicy.maintenanceWindowStartUtc));
  const [windowHours, setWindowHours] = useState(String(application.databasePolicy.maintenanceWindowHours));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mode) return;
    queueMicrotask(() => {
      setName(application.name);
      setDescription(application.description ?? "");
      setCommercialMode(application.commercialMode);
      setVisibility(application.catalogueVisibility);
      setEnableOnNewServers(application.databasePolicy.enableOnNewServers);
      setRotationEnabled(application.databasePolicy.rotationEnabled);
      setRotationIntervalHours(String(application.databasePolicy.rotationIntervalHours));
      setWindowStart(String(application.databasePolicy.maintenanceWindowStartUtc));
      setWindowHours(String(application.databasePolicy.maintenanceWindowHours));
      setReason("");
      setError(null);
    });
  }, [application, mode]);

  if (!mode) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (mode === "metadata") {
        await onUpdateMetadata({
          expectedCatalogueRevision: application.catalogueRevision,
          name: name.trim(),
          description: description.trim() || null,
          commercialMode,
          catalogueVisibility: visibility,
        });
      } else {
        if (reason.trim().length < 1) throw new Error(copy.reasonRequired);
        await onUpdatePolicy({
          expectedPolicyRevision: application.databasePolicy.policyRevision,
          enableOnNewServers,
          rotationEnabled,
          rotationIntervalHours: Number(rotationIntervalHours),
          maintenanceWindowStartUtc: Number(windowStart),
          maintenanceWindowHours: Number(windowHours),
          reason: reason.trim(),
        });
      }
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : copy.failed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="application-configuration-title" className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div><h2 id="application-configuration-title" className="text-sm font-black">{mode === "metadata" ? copy.metadataTitle : copy.policyTitle}</h2><p className="mt-1 text-xs text-slate-500">{copy.revisionPrefix} {mode === "metadata" ? application.catalogueRevision : application.databasePolicy.policyRevision} {copy.revisionSuffix}</p></div>
          <button type="button" onClick={onClose} aria-label={copy.close} className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={submit} className="space-y-4 p-5">
          {mode === "metadata" ? <>
            {application.publicationStatus === "PUBLISHED" && (
              <div role="note" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-black">{copy.publicationInvalidationTitle}</p>
                  <p className="mt-1 text-[11px] leading-relaxed">{copy.publicationInvalidationDescription}</p>
                </div>
              </div>
            )}
            <Field label={copy.name}><input required maxLength={128} value={name} onChange={(event) => setName(event.target.value)} className="field" /></Field>
            <Field label={copy.description}><textarea rows={3} maxLength={512} value={description} onChange={(event) => setDescription(event.target.value)} className="field resize-none" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.commercialMode}><select value={commercialMode} onChange={(event) => setCommercialMode(event.target.value as ApplicationView["commercialMode"])} className="field"><option value="NON_BILLABLE">{copy.nonBillable}</option><option value="INCLUDED">{copy.included}</option><option value="SUBSCRIPTION">{copy.subscription}</option></select></Field>
              <Field label={copy.visibility}><select value={visibility} onChange={(event) => setVisibility(event.target.value as ApplicationView["catalogueVisibility"])} className="field"><option value="PUBLIC">{copy.public}</option><option value="INTERNAL">{copy.internal}</option></select></Field>
            </div>
          </> : <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle label={copy.enableOnNewServers} checked={enableOnNewServers} onChange={setEnableOnNewServers} />
              <Toggle label={copy.automaticRotation} checked={rotationEnabled} onChange={setRotationEnabled} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={copy.intervalHours}><input type="number" min={24} max={8760} value={rotationIntervalHours} onChange={(event) => setRotationIntervalHours(event.target.value)} className="field" /></Field>
              <Field label={copy.utcStartHour}><input type="number" min={0} max={23} value={windowStart} onChange={(event) => setWindowStart(event.target.value)} className="field" /></Field>
              <Field label={copy.windowHours}><input type="number" min={1} max={24} value={windowHours} onChange={(event) => setWindowHours(event.target.value)} className="field" /></Field>
            </div>
            <Field label={copy.changeReason}><textarea required maxLength={256} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="field resize-none" /></Field>
          </>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
          <footer className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t.applications.cancel}</button><button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">{isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{copy.save}</button></footer>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}<div className="mt-1.5 [&_.field]:w-full [&_.field]:rounded-xl [&_.field]:border [&_.field]:border-slate-300 [&_.field]:bg-white [&_.field]:px-3 [&_.field]:py-2.5 [&_.field]:text-sm [&_.field]:outline-none [&_.field]:focus:border-violet-500 dark:[&_.field]:border-slate-700 dark:[&_.field]:bg-slate-950">{children}</div></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold dark:border-slate-800"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-violet-600" />{label}</label>; }
