import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Button,
} from "@/design-system";
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{mode === "metadata" ? copy.metadataTitle : copy.policyTitle}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {copy.revisionPrefix} {mode === "metadata" ? application.catalogueRevision : application.databasePolicy.policyRevision} {copy.revisionSuffix}
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {mode === "metadata" ? (
            <>
              {application.publicationStatus === "PUBLISHED" && (
                <div role="note" className="flex gap-3 rounded-lg border border-warn-200 bg-warn-50 p-3 text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold">{copy.publicationInvalidationTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed">{copy.publicationInvalidationDescription}</p>
                  </div>
                </div>
              )}
              <Field label={copy.name}>
                {(fp) => <Input {...fp} required maxLength={128} value={name} onChange={(event) => setName(event.target.value)} />}
              </Field>
              <Field label={copy.description}>
                {(fp) => <Textarea {...fp} rows={3} maxLength={512} value={description} onChange={(event) => setDescription(event.target.value)} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.commercialMode}>
                  {(fp) => (
                    <Select value={commercialMode} onValueChange={(value) => setCommercialMode(value as ApplicationView["commercialMode"])}>
                      <SelectTrigger id={fp.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NON_BILLABLE">{copy.nonBillable}</SelectItem>
                        <SelectItem value="INCLUDED">{copy.included}</SelectItem>
                        <SelectItem value="SUBSCRIPTION">{copy.subscription}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <Field label={copy.visibility}>
                  {(fp) => (
                    <Select value={visibility} onValueChange={(value) => setVisibility(value as ApplicationView["catalogueVisibility"])}>
                      <SelectTrigger id={fp.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">{copy.public}</SelectItem>
                        <SelectItem value="INTERNAL">{copy.internal}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle label={copy.enableOnNewServers} checked={enableOnNewServers} onChange={setEnableOnNewServers} />
                <Toggle label={copy.automaticRotation} checked={rotationEnabled} onChange={setRotationEnabled} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={copy.intervalHours}>
                  {(fp) => <Input {...fp} type="number" min={24} max={8760} value={rotationIntervalHours} onChange={(event) => setRotationIntervalHours(event.target.value)} />}
                </Field>
                <Field label={copy.utcStartHour}>
                  {(fp) => <Input {...fp} type="number" min={0} max={23} value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />}
                </Field>
                <Field label={copy.windowHours}>
                  {(fp) => <Input {...fp} type="number" min={1} max={24} value={windowHours} onChange={(event) => setWindowHours(event.target.value)} />}
                </Field>
              </div>
              <Field label={copy.changeReason}>
                {(fp) => <Textarea {...fp} required maxLength={256} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />}
              </Field>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300">
              {error}
            </p>
          )}
          <footer className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {copy.save}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-xs font-semibold text-foreground">
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      {label}
    </label>
  );
}
