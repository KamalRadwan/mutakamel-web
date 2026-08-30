import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
  const { lang, t } = useI18n();
  const copy = t.applications.detail.configuration;
  const validationCopy = configurationValidationCopy(lang);
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);

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
      setFieldErrors({});
      setSubmissionError(null);
    });
  }, [application, mode]);

  if (!mode) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (mode === "metadata" && !name.trim()) nextErrors["application-name"] = validationCopy.nameRequired;
    if (mode === "policy") {
      validateIntegerRange(rotationIntervalHours, 24, 8760, validationCopy.intervalInvalid, "application-rotation-interval", nextErrors);
      validateIntegerRange(windowStart, 0, 23, validationCopy.startInvalid, "application-window-start", nextErrors);
      validateIntegerRange(windowHours, 1, 24, validationCopy.windowInvalid, "application-window-hours", nextErrors);
      if (!reason.trim()) nextErrors["application-policy-reason"] = copy.reasonRequired;
    }
    setFieldErrors(nextErrors);
    setSubmissionError(null);
    const invalidIds = Object.keys(nextErrors);
    if (invalidIds.length > 0) {
      queueMicrotask(() => {
        if (invalidIds.length === 1) document.getElementById(invalidIds[0])?.focus();
        else errorSummaryRef.current?.focus();
      });
      return;
    }

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
      setSubmissionError(submissionError instanceof Error ? submissionError.message : copy.failed);
      queueMicrotask(() => submissionErrorRef.current?.focus());
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{mode === "metadata" ? copy.metadataTitle : copy.policyTitle}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {copy.revisionPrefix} {mode === "metadata" ? application.catalogueRevision : application.databasePolicy.policyRevision} {copy.revisionSuffix}
          </p>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {Object.keys(fieldErrors).length > 1 && (
            <div
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-destructive bg-destructive-subtle p-3 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-semibold">{validationCopy.summary}</p>
              <ul className="mt-2 list-disc space-y-1 ps-5">
                {Object.entries(fieldErrors).map(([id, message]) => (
                  <li key={id}>
                    <a className="underline underline-offset-2" href={`#${id}`}>{message}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mode === "metadata" ? (
            <>
              {application.publicationStatus === "PUBLISHED" && (
                <div role="note" className="flex gap-3 rounded-md border border-warning bg-warning-subtle p-3 text-warning-subtle-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold">{copy.publicationInvalidationTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed">{copy.publicationInvalidationDescription}</p>
                  </div>
                </div>
              )}
              <Field id="application-name" label={copy.name} required error={fieldErrors["application-name"]}>
                {(fp) => (
                  <Input
                    {...fp}
                    required
                    invalid={Boolean(fieldErrors["application-name"])}
                    maxLength={128}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearFieldError("application-name", setFieldErrors);
                    }}
                  />
                )}
              </Field>
              <Field label={copy.description}>
                {(fp) => <Textarea {...fp} rows={3} maxLength={512} value={description} onChange={(event) => setDescription(event.target.value)} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.commercialMode}>
                  {(fp) => (
                    <Select value={commercialMode} onValueChange={(value) => setCommercialMode(value as ApplicationView["commercialMode"])}>
                      <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
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
                      <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
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
                <Field id="application-rotation-interval" label={copy.intervalHours} error={fieldErrors["application-rotation-interval"]}>
                  {(fp) => <Input {...fp} invalid={Boolean(fieldErrors["application-rotation-interval"])} type="number" min={24} max={8760} value={rotationIntervalHours} onChange={(event) => { setRotationIntervalHours(event.target.value); clearFieldError("application-rotation-interval", setFieldErrors); }} />}
                </Field>
                <Field id="application-window-start" label={copy.utcStartHour} error={fieldErrors["application-window-start"]}>
                  {(fp) => <Input {...fp} invalid={Boolean(fieldErrors["application-window-start"])} type="number" min={0} max={23} value={windowStart} onChange={(event) => { setWindowStart(event.target.value); clearFieldError("application-window-start", setFieldErrors); }} />}
                </Field>
                <Field id="application-window-hours" label={copy.windowHours} error={fieldErrors["application-window-hours"]}>
                  {(fp) => <Input {...fp} invalid={Boolean(fieldErrors["application-window-hours"])} type="number" min={1} max={24} value={windowHours} onChange={(event) => { setWindowHours(event.target.value); clearFieldError("application-window-hours", setFieldErrors); }} />}
                </Field>
              </div>
              <Field id="application-policy-reason" label={copy.changeReason} required error={fieldErrors["application-policy-reason"]}>
                {(fp) => <Textarea {...fp} invalid={Boolean(fieldErrors["application-policy-reason"])} required maxLength={256} rows={2} value={reason} onChange={(event) => { setReason(event.target.value); clearFieldError("application-policy-reason", setFieldErrors); }} />}
              </Field>
            </>
          )}
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
          <footer className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {copy.save}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-md border border-input px-3 py-2 text-xs font-semibold text-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <label htmlFor={id} className="cursor-pointer">{label}</label>
    </div>
  );
}

function validateIntegerRange(
  rawValue: string,
  minimum: number,
  maximum: number,
  message: string,
  fieldId: string,
  errors: Record<string, string>,
) {
  if (!rawValue.trim()) {
    errors[fieldId] = message;
    return;
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) errors[fieldId] = message;
}

function clearFieldError(
  fieldId: string,
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  setErrors((current) => {
    if (!current[fieldId]) return current;
    const next = { ...current };
    delete next[fieldId];
    return next;
  });
}

function configurationValidationCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        summary: "راجع الحقول التالية قبل الحفظ.",
        nameRequired: "اسم التطبيق مطلوب.",
        intervalInvalid: "يجب أن تكون فترة التدوير عددًا صحيحًا بين 24 و8760 ساعة.",
        startInvalid: "يجب أن تكون ساعة البدء بالتوقيت العالمي عددًا صحيحًا بين 0 و23.",
        windowInvalid: "يجب أن تكون مدة نافذة الصيانة عددًا صحيحًا بين 1 و24 ساعة.",
      }
    : {
        summary: "Review the following fields before saving.",
        nameRequired: "Application name is required.",
        intervalInvalid: "Rotation interval must be an integer from 24 to 8,760 hours.",
        startInvalid: "UTC start hour must be an integer from 0 to 23.",
        windowInvalid: "Maintenance window must be an integer from 1 to 24 hours.",
      };
}
