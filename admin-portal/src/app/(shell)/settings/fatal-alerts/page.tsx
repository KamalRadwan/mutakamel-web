"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { Button, Field as FormField, Input, PageHeader, Switch } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useFatalAlertSettings } from "./hooks/useFatalAlertSettings";
import type {
  FatalAlertFormState,
  FatalAlertValidationErrors,
} from "./fatal-alert-contract";

function dict(lang: "ar" | "en") {
  return (lang === "ar" ? ar : en).settings.fatalAlerts;
}

export default function FatalAlertSettingsPage() {
  const state = useFatalAlertSettings();
  const toast = useToast();
  const [showToken, setShowToken] = useState(false);
  const { lang } = state;
  const copy = dict(lang);
  const pending = state.mutation.phase === "PENDING";

  const save = async () => {
    const succeeded = await state.save();
    if (succeeded) {
      toast.success(copy.toastSavedTitle, copy.toastSavedDescription);
    } else {
      toast.error(
        copy.toastFailedTitle,
        mutationMessage(state.mutation.localCode ?? state.mutation.error?.errorCode, lang),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        action={
          state.canSaveCritical ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => void save()}
              disabled={!state.hasUnsavedChanges || pending || state.loadState !== "READY"}
            >
              {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              {copy.saveButton}
            </Button>
          ) : undefined
        }
      />

      <SettingsResourceBoundary
        state={state.loadState}
        error={state.loadError}
        lang={lang}
        onRetry={() => void state.refetch()}
      >
        {state.snapshot && state.form ? (
          <>
            <Evidence state={state} />
            <MutationNotice state={state} />
            {!state.canSaveCritical ? (
              <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
                {copy.readOnlyNote}
              </p>
            ) : null}
            <FatalAlertForm
              form={state.form}
              token={state.token}
              errors={state.fieldErrors}
              configured={state.snapshot.data.configured}
              lang={lang}
              disabled={!state.canSaveCritical || pending}
              showToken={showToken}
              onToggleToken={() => setShowToken((current) => !current)}
              onUpdate={state.update}
              onToken={state.setToken}
            />
          </>
        ) : null}
      </SettingsResourceBoundary>
    </div>
  );
}

function Evidence({ state }: { state: ReturnType<typeof useFatalAlertSettings> }) {
  const config = state.snapshot?.data;
  if (!config) return null;
  const copy = dict(state.lang).evidence;
  const locale = state.lang === "ar" ? "ar-EG" : "en-US";
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-4">
      <EvidenceItem label={copy.delivery} value={config.enabled ? copy.enabledValue : copy.disabledValue} />
      <EvidenceItem label={copy.configuration} value={config.configured ? copy.completeValue : copy.incompleteValue} />
      <EvidenceItem label={copy.revision} value={config.revision === null ? "—" : String(config.revision)} />
      <EvidenceItem label={copy.updated} value={config.updatedAt ? new Date(config.updatedAt).toLocaleString(locale) : "—"} />
    </section>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-3"><span className="block text-xs font-semibold text-muted-foreground">{label}</span><strong className="mt-1 block">{value}</strong></div>;
}

function FatalAlertForm({ form, token, errors, configured, lang, disabled, showToken, onToggleToken, onUpdate, onToken }: {
  form: FatalAlertFormState;
  token: string;
  errors: FatalAlertValidationErrors;
  configured: boolean;
  lang: "ar" | "en";
  disabled: boolean;
  showToken: boolean;
  onToggleToken: () => void;
  onUpdate: <K extends keyof FatalAlertFormState>(field: K, value: FatalAlertFormState[K]) => void;
  onToken: (value: string) => void;
}) {
  const copy = dict(lang).form;
  return (
    <form aria-label={copy.ariaLabel} onSubmit={(event) => event.preventDefault()} className="grid gap-5 rounded-lg border border-border bg-card p-5 lg:grid-cols-2">
      <label htmlFor="fatal-alert-enabled" className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-input bg-muted px-4 lg:col-span-2">
        <span><strong className="block text-sm">{copy.enableLabel}</strong><span className="text-xs text-muted-foreground">{copy.enableHelp}</span></span>
        <Switch id="fatal-alert-enabled" checked={form.enabled} disabled={disabled} onCheckedChange={(enabled) => onUpdate("enabled", enabled)} />
      </label>
      <FatalAlertField id="fatal-alert-url" label={copy.webhookUrlLabel} type="url" value={form.webhookUrl} maxLength={2048} disabled={disabled} error={errors.webhookUrl} lang={lang} onChange={(value) => onUpdate("webhookUrl", value)} />
      <FatalAlertField id="fatal-alert-timeout" label={copy.timeoutLabel} type="text" value={form.timeoutMs} maxLength={6} disabled={disabled} error={errors.timeoutMs} lang={lang} onChange={(value) => onUpdate("timeoutMs", value)} />
      <FormField
        id="fatal-alert-token"
        label={copy.tokenLabel}
        error={fieldErrorMessage(errors.webhookToken, lang)}
        className="lg:col-span-2"
        labelAction={
          <Button type="button" variant="ghost" size="xs" onClick={onToggleToken} disabled={disabled} aria-label={showToken ? copy.hideToken : copy.showToken} aria-pressed={showToken} className="h-auto px-1.5 py-1">
            {showToken ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </Button>
        }
      >
        {(field) => <Input {...field} type={showToken ? "text" : "password"} autoComplete="new-password" value={token} maxLength={2048} disabled={disabled} placeholder={configured ? copy.tokenPlaceholderConfigured : copy.tokenPlaceholderRequired} onChange={(event) => onToken(event.target.value)} className="font-mono" />}
      </FormField>
      <p className="text-xs leading-5 text-muted-foreground lg:col-span-2">
        {copy.footerNote}
      </p>
    </form>
  );
}

function FatalAlertField({ id, label, type, value, maxLength, disabled, error, lang, onChange }: { id: string; label: string; type: "text" | "url"; value: string; maxLength: number; disabled: boolean; error?: string; lang: "ar" | "en"; onChange: (value: string) => void }) {
  return <FormField id={id} label={label} error={fieldErrorMessage(error, lang)}>{(field) => <Input {...field} type={type} value={value} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="font-mono" />}</FormField>;
}

function fieldErrorMessage(code: string | undefined, lang: "ar" | "en"): string | undefined {
  if (!code) return undefined;
  const copy = dict(lang).fieldErrors;
  const messages: Record<string, string> = {
    INVALID_WEBHOOK_URL: copy.invalidWebhookUrl,
    TOKEN_REQUIRED: copy.tokenRequired,
    TOKEN_TOO_LONG: copy.tokenTooLong,
    INVALID_TIMEOUT: copy.invalidTimeout,
  };
  return messages[code] ?? copy.generic;
}

function MutationNotice({ state }: { state: ReturnType<typeof useFatalAlertSettings> }) {
  if (state.mutation.phase === "IDLE" || state.mutation.phase === "PENDING") return null;
  const succeeded = state.mutation.phase === "SUCCEEDED";
  const copy = dict(state.lang);
  return <p role={succeeded ? "status" : "alert"} className={`rounded-lg border p-3 text-sm font-semibold ${succeeded ? "border-success/30 bg-success-subtle text-success-subtle-foreground" : "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"}`}>{succeeded ? copy.mutation.saved : mutationMessage(state.mutation.localCode ?? state.mutation.error?.errorCode, state.lang)}{state.mutation.correlationId ? <code dir="ltr" className="ms-2">{state.mutation.correlationId}</code> : null}</p>;
}

function mutationMessage(code: string | undefined, lang: "ar" | "en"): string {
  const copy = dict(lang).mutation;
  if (code === "FATAL_ALERT_VALIDATION_FAILED") return copy.validationFailed;
  if (code === "NO_FATAL_ALERT_CHANGES") return copy.noChanges;
  return copy.generic(code ?? "UNKNOWN_ERROR");
}
