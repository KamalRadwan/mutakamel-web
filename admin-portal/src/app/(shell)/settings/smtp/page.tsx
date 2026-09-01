"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  History,
  Loader2,
  PlayCircle,
  Save,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import {
  Button,
  Field as FormField,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSmtpSettings } from "./hooks/useSmtpSettings";
import {
  SMTP_ALLOWED_PORTS,
  type SmtpFormState,
  type SmtpValidationErrors,
} from "./smtp-contract";

function dict(lang: "ar" | "en") {
  return (lang === "ar" ? ar : en).settings.smtp;
}

export default function SmtpSettingsPage() {
  const smtp = useSmtpSettings();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const { lang } = smtp;
  const copy = dict(lang);
  const pending = smtp.mutation.phase === "PENDING";

  const save = async () => {
    const succeeded = await smtp.saveConfig();
    if (succeeded) {
      toast.success(copy.toastSavedTitle, copy.toastSavedDescription);
    } else {
      toast.error(
        copy.toastSaveFailedTitle,
        safeMutationMessage(smtp.mutation.localCode ?? smtp.mutation.error?.errorCode, lang),
      );
    }
  };
  const verify = async () => {
    const succeeded = await smtp.verifyConnection();
    if (succeeded) {
      toast.success(copy.toastVerifiedTitle, copy.toastVerifiedDescription);
    } else {
      toast.error(
        copy.toastVerifyFailedTitle,
        safeMutationMessage(smtp.mutation.localCode ?? smtp.mutation.error?.errorCode, lang),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.pageTitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {smtp.canVerify ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void verify()}
                disabled={!smtp.canTestSavedConfig || pending}
                title={smtp.hasUnsavedChanges ? copy.verifyDisabledHint : undefined}
              >
                {pending && smtp.mutation.action === "VERIFY" ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <PlayCircle className="size-4" aria-hidden="true" />
                )}
                {copy.verifyButton}
              </Button>
            ) : null}
            {smtp.canSaveCritical ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => void save()}
                disabled={!smtp.hasUnsavedChanges || pending || smtp.configState !== "READY"}
              >
                {pending && smtp.mutation.action === "SAVE" ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {copy.saveButton}
              </Button>
            ) : null}
          </div>
        }
      />

      <SettingsResourceBoundary
        state={smtp.configState}
        error={smtp.configError}
        lang={lang}
        onRetry={() => void smtp.refetchConfig()}
      >
        {smtp.snapshot && smtp.form ? (
          <>
            <SmtpEvidence smtp={smtp} />
            <SmtpMutationNotice smtp={smtp} />
            {smtp.hasUnsavedChanges ? (
              <p role="status" className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm font-semibold text-warning-subtle-foreground">
                {copy.unsavedChangesNote}
              </p>
            ) : null}
            {!smtp.canSaveCritical ? (
              <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
                {copy.readOnlyNote}
              </p>
            ) : null}
            <SmtpForm
              form={smtp.form}
              password={smtp.password}
              errors={smtp.fieldErrors}
              lang={lang}
              disabled={!smtp.canSaveCritical || pending}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((current) => !current)}
              onUpdate={smtp.handleUpdate}
              onPassword={smtp.setPassword}
            />
          </>
        ) : null}
      </SettingsResourceBoundary>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            {copy.auditTitle}
          </h2>
        </div>
        <div className="p-4">
          <SettingsResourceBoundary
            state={smtp.auditState}
            error={smtp.auditError}
            lang={lang}
            onRetry={() => void smtp.refetchAudit()}
          >
            {smtp.auditLogs.length ? (
              <div className="divide-y divide-border">
                {smtp.auditLogs.map((log) => (
                  <article key={log.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <strong className="rounded-md bg-info-subtle px-2 py-1 text-info-subtle-foreground">
                        {log.action}
                      </strong>
                      {log.revision === null ? null : <code>r{log.revision}</code>}
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <UserCheck className="size-3.5" aria-hidden="true" />
                        {log.actor}
                      </span>
                      <time className="text-muted-foreground" dateTime={log.createdAt}>
                        {new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                      </time>
                    </div>
                    {log.changes.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {log.changes.map((change, index) => (
                          <li key={`${change.field}-${index}`} className="rounded-lg bg-muted px-2 py-1 font-mono text-xs text-foreground">
                            {change.label}: {String(change.previousValue ?? "—")} → {String(change.newValue ?? "—")}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="p-5 text-center text-xs text-muted-foreground">
                {copy.auditEmpty}
              </p>
            )}
          </SettingsResourceBoundary>
        </div>
      </section>
    </div>
  );
}

function SmtpEvidence({ smtp }: { smtp: ReturnType<typeof useSmtpSettings> }) {
  const { lang } = smtp;
  const copy = dict(lang).evidence;
  const config = smtp.snapshot?.data;
  if (!config) return null;
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-3">
      <Evidence label={copy.status} value={config.configured ? copy.configuredValue : copy.notConfiguredValue} />
      <Evidence label={copy.revision} value={config.revision === null ? "—" : String(config.revision)} />
      <Evidence label={copy.updated} value={config.updatedAt ? new Date(config.updatedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "—"} />
    </section>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-3"><span className="block text-xs font-semibold text-muted-foreground">{label}</span><strong className="mt-1 block">{value}</strong></div>;
}

function SmtpMutationNotice({ smtp }: { smtp: ReturnType<typeof useSmtpSettings> }) {
  if (smtp.mutation.phase === "IDLE" || smtp.mutation.phase === "PENDING") return null;
  const succeeded = smtp.mutation.phase === "SUCCEEDED";
  const copy = dict(smtp.lang).mutation;
  return (
    <p role={succeeded ? "status" : "alert"} className={`rounded-lg border p-3 text-sm font-semibold ${succeeded ? "border-success/30 bg-success-subtle text-success-subtle-foreground" : "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"}`}>
      {succeeded ? copy.succeeded : safeMutationMessage(smtp.mutation.localCode ?? smtp.mutation.error?.errorCode, smtp.lang)}
      {smtp.mutation.correlationId ? <code dir="ltr" className="ms-2">{smtp.mutation.correlationId}</code> : null}
    </p>
  );
}

function SmtpForm({ form, password, errors, lang, disabled, showPassword, onTogglePassword, onUpdate, onPassword }: {
  form: SmtpFormState;
  password: string;
  errors: SmtpValidationErrors;
  lang: "ar" | "en";
  disabled: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  onUpdate: <K extends keyof SmtpFormState>(field: K, value: SmtpFormState[K]) => void;
  onPassword: (value: string) => void;
}) {
  const copy = dict(lang).form;
  return (
    <form method="post" aria-label={copy.ariaLabel} onSubmit={(event) => event.preventDefault()} className="grid gap-5 rounded-lg border border-border bg-card p-5 lg:grid-cols-2">
      <TextField id="smtp-from-address" label={copy.fromAddress} type="email" value={form.fromAddress} maxLength={320} disabled={disabled} error={errors.fromAddress} lang={lang} onChange={(value) => onUpdate("fromAddress", value)} />
      <TextField id="smtp-from-name" label={copy.fromName} value={form.fromName} maxLength={200} disabled={disabled} error={errors.fromName} lang={lang} onChange={(value) => onUpdate("fromName", value)} />
      <TextField id="smtp-sender-domain" label={copy.senderDomain} value={form.senderDomain} maxLength={253} disabled={disabled} error={errors.senderDomain} lang={lang} onChange={(value) => onUpdate("senderDomain", value)} />
      <TextField id="smtp-host" label={copy.smtpHost} value={form.smtpHost} maxLength={253} disabled={disabled} error={errors.smtpHost} lang={lang} onChange={(value) => onUpdate("smtpHost", value)} />
      <SelectField id="smtp-port" label={copy.smtpPort} value={form.smtpPort} disabled={disabled} error={errors.smtpPort} lang={lang} onChange={(value) => onUpdate("smtpPort", value)} options={SMTP_ALLOWED_PORTS.map((port) => ({ value: String(port), label: String(port) }))} />
      <SelectField id="smtp-protocol" label={copy.protocol} value={form.smtpProtocol ?? ""} disabled={disabled} error={errors.smtpProtocol} lang={lang} onChange={(value) => onUpdate("smtpProtocol", value === "smtp" || value === "smtps" ? value : null)} options={[{ value: "smtp", label: "SMTP" }, { value: "smtps", label: "SMTPS" }]} />
      <SelectField id="smtp-secure" label={copy.secureTls} value={form.smtpSecure === null ? "" : String(form.smtpSecure)} disabled={disabled} error={errors.smtpSecure} lang={lang} onChange={(value) => onUpdate("smtpSecure", value === "true" ? true : value === "false" ? false : null)} options={[{ value: "true", label: copy.secureEnabled }, { value: "false", label: copy.secureDisabled }]} />
      <TextField id="smtp-username" label={copy.username} value={form.smtpUsername} maxLength={320} disabled={disabled} error={errors.smtpUsername} lang={lang} onChange={(value) => onUpdate("smtpUsername", value)} />
      <FormField
        id="smtp-password"
        label={copy.passwordLabel}
        error={fieldErrorMessage(errors.smtpPassword, lang)}
        labelAction={
          <Button type="button" variant="ghost" size="xs" onClick={onTogglePassword} disabled={disabled} aria-label={showPassword ? copy.hidePassword : copy.showPassword} aria-pressed={showPassword} className="h-auto px-1.5 py-1">
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </Button>
        }
      >
        {(field) => <Input {...field} type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} maxLength={1024} disabled={disabled} onChange={(event) => onPassword(event.target.value)} className="font-mono" />}
      </FormField>
      <p className="text-xs leading-5 text-muted-foreground lg:col-span-2">
        {copy.portsNote}
      </p>
    </form>
  );
}

function TextField({ id, label, type = "text", value, maxLength, disabled, error, lang, onChange }: { id: string; label: string; type?: "text" | "email"; value: string; maxLength: number; disabled: boolean; error?: string; lang: "ar" | "en"; onChange: (value: string) => void }) {
  return <FormField id={id} label={label} error={fieldErrorMessage(error, lang)}>{(field) => <Input {...field} type={type} value={value} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} />}</FormField>;
}

function SelectField({ id, label, value, disabled, error, lang, options, onChange }: { id: string; label: string; value: string; disabled: boolean; error?: string; lang: "ar" | "en"; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const copy = dict(lang).form;
  return <FormField id={id} label={label} error={fieldErrorMessage(error, lang)}>{(field) => <Select value={value || undefined} disabled={disabled} onValueChange={onChange}><SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]} aria-invalid={field["aria-invalid"]}><SelectValue placeholder={copy.selectPlaceholder} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>}</FormField>;
}

function fieldErrorMessage(code: string | undefined, lang: "ar" | "en"): string | undefined {
  return code ? fieldErrorCopy(code, lang) : undefined;
}

function fieldErrorCopy(code: string, lang: "ar" | "en"): string {
  const messages = dict(lang).fieldErrors;
  return (messages as Record<string, string>)[code] ?? messages.generic;
}

function safeMutationMessage(code: string | undefined, lang: "ar" | "en"): string {
  const copy = dict(lang).mutation;
  const safeCode = code ?? "UNKNOWN_ERROR";
  if (safeCode === "SAVE_BEFORE_VERIFY") return copy.saveBeforeVerify;
  if (safeCode === "SMTP_VALIDATION_FAILED") return copy.validationFailed;
  if (safeCode === "NO_SMTP_CHANGES") return copy.noChanges;
  return copy.generic(safeCode);
}
