"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { PageHeader, Button } from "@/design-system";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useFatalAlertSettings } from "./hooks/useFatalAlertSettings";
import type {
  FatalAlertFormState,
  FatalAlertValidationErrors,
} from "./fatal-alert-contract";

export default function FatalAlertSettingsPage() {
  const state = useFatalAlertSettings();
  const toast = useToast();
  const [showToken, setShowToken] = useState(false);
  const { lang } = state;
  const pending = state.mutation.phase === "PENDING";

  const save = async () => {
    const succeeded = await state.save();
    if (succeeded) {
      toast.success(
        lang === "ar" ? "تم حفظ إعدادات التنبيه" : "Fatal-alert settings saved",
        lang === "ar"
          ? "سيقرأ Realtime الإعداد الجديد خلال 30 ثانية دون إعادة تشغيل."
          : "Realtime will adopt the new configuration within 30 seconds without a restart.",
      );
    } else {
      toast.error(
        lang === "ar" ? "تعذر حفظ الإعداد" : "Save failed",
        mutationMessage(
          state.mutation.localCode ?? state.mutation.error?.errorCode,
          lang,
        ),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "ar" ? "تنبيهات Realtime الحرجة" : "Realtime Fatal Alerts"}
        action={
          state.canSaveCritical ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => void save()}
              disabled={!state.hasUnsavedChanges || pending || state.loadState !== "READY"}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {lang === "ar" ? "حفظ الإعداد" : "Save configuration"}
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
              <p role="note" className="rounded-lg border border-border bg-ink-100 p-3 text-sm text-foreground dark:bg-ink-800">
                {lang === "ar"
                  ? "العرض فقط؛ يتطلب الحفظ صلاحيتي admin.settings.update و admin.settings.critical."
                  : "Read-only view; saving requires admin.settings.update and admin.settings.critical."}
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
  const locale = state.lang === "ar" ? "ar-EG" : "en-US";
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-4">
      <EvidenceItem label={state.lang === "ar" ? "الإرسال" : "Delivery"} value={config.enabled ? (state.lang === "ar" ? "مفعّل" : "Enabled") : (state.lang === "ar" ? "متوقف" : "Disabled")} />
      <EvidenceItem label={state.lang === "ar" ? "التهيئة" : "Configuration"} value={config.configured ? (state.lang === "ar" ? "مكتملة" : "Complete") : (state.lang === "ar" ? "غير مكتملة" : "Incomplete")} />
      <EvidenceItem label={state.lang === "ar" ? "المراجعة" : "Revision"} value={config.revision === null ? "—" : String(config.revision)} />
      <EvidenceItem label={state.lang === "ar" ? "آخر تحديث" : "Updated"} value={config.updatedAt ? new Date(config.updatedAt).toLocaleString(locale) : "—"} />
    </section>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-ink-100 p-3 dark:bg-ink-800"><span className="block text-xs font-semibold text-muted-foreground">{label}</span><strong className="mt-1 block">{value}</strong></div>;
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
  return (
    <form aria-label={lang === "ar" ? "إعداد التنبيهات الحرجة" : "Fatal alert configuration"} onSubmit={(event) => event.preventDefault()} className="grid gap-5 rounded-lg border border-border bg-card p-5 lg:grid-cols-2">
      <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-border bg-ink-100 px-4 dark:bg-ink-900 lg:col-span-2">
        <span><strong className="block text-sm">{lang === "ar" ? "تفعيل إرسال التنبيهات" : "Enable fatal-alert delivery"}</strong><span className="text-xs text-muted-foreground">{lang === "ar" ? "يُطبّق Realtime التغيير خلال 30 ثانية." : "Realtime applies changes within 30 seconds."}</span></span>
        <input type="checkbox" checked={form.enabled} disabled={disabled} onChange={(event) => onUpdate("enabled", event.target.checked)} className="size-5 accent-danger-600" />
      </label>
      <Field id="fatal-alert-url" label={lang === "ar" ? "Webhook URL" : "Webhook URL"} type="url" value={form.webhookUrl} maxLength={2048} disabled={disabled} error={errors.webhookUrl} lang={lang} onChange={(value) => onUpdate("webhookUrl", value)} />
      <Field id="fatal-alert-timeout" label={lang === "ar" ? "مهلة الطلب بالمللي ثانية" : "Request timeout (ms)"} type="text" value={form.timeoutMs} maxLength={6} disabled={disabled} error={errors.timeoutMs} lang={lang} onChange={(value) => onUpdate("timeoutMs", value)} />
      <div className="grid gap-1.5 lg:col-span-2">
        <label htmlFor="fatal-alert-token" className="text-xs font-semibold">{lang === "ar" ? "Bearer Token (للكتابة فقط)" : "Bearer token (write-only)"}</label>
        <div className="relative">
          <input id="fatal-alert-token" type={showToken ? "text" : "password"} autoComplete="new-password" value={token} maxLength={2048} disabled={disabled} placeholder={configured ? (lang === "ar" ? "اتركه فارغاً للاحتفاظ بالرمز الحالي" : "Leave blank to retain the current token") : (lang === "ar" ? "مطلوب عند التهيئة الأولى" : "Required for initial configuration")} aria-invalid={Boolean(errors.webhookToken)} aria-describedby={errors.webhookToken ? "fatal-alert-token-error" : undefined} onChange={(event) => onToken(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-ink-100 ps-3 pe-11 font-mono text-sm outline-none focus:border-danger-500 dark:bg-ink-900 disabled:opacity-50" />
          <button type="button" onClick={onToggleToken} disabled={disabled} aria-label={showToken ? (lang === "ar" ? "إخفاء الرمز" : "Hide token") : (lang === "ar" ? "إظهار الرمز" : "Show token")} className="absolute end-3 top-3 text-muted-foreground disabled:opacity-40">{showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        <FieldError id="fatal-alert-token-error" code={errors.webhookToken} lang={lang} />
      </div>
      <p className="text-xs leading-5 text-muted-foreground lg:col-span-2">
        {lang === "ar"
          ? "لا يمكن تفعيل الإرسال قبل حفظ URL وToken صالحين. تعطيل المفتاح يحتفظ بالإعداد المشفّر لإعادة التفعيل لاحقاً."
          : "Delivery cannot be enabled until a valid URL and token are saved. Disabling retains the encrypted configuration for later re-enablement."}
      </p>
    </form>
  );
}

function Field({ id, label, type, value, maxLength, disabled, error, lang, onChange }: { id: string; label: string; type: "text" | "url"; value: string; maxLength: number; disabled: boolean; error?: string; lang: "ar" | "en"; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return <div className="grid gap-1.5"><label htmlFor={id} className="text-xs font-semibold">{label}</label><input id={id} type={type} value={value} maxLength={maxLength} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-lg border border-border bg-ink-100 px-3 font-mono text-sm outline-none focus:border-danger-500 dark:bg-ink-900 disabled:opacity-50" /><FieldError id={errorId} code={error} lang={lang} /></div>;
}

function FieldError({ id, code, lang }: { id: string; code?: string; lang: "ar" | "en" }) {
  if (!code) return null;
  const messages: Record<string, { en: string; ar: string }> = {
    INVALID_WEBHOOK_URL: { en: "Enter an HTTP(S) URL without embedded credentials.", ar: "أدخل رابط HTTP(S) صالحاً بدون بيانات اعتماد داخله." },
    TOKEN_REQUIRED: { en: "Initial configuration requires a bearer token.", ar: "يتطلب الإعداد الأولي Bearer Token." },
    TOKEN_TOO_LONG: { en: "Token must not exceed 2048 UTF-8 bytes.", ar: "يجب ألا يتجاوز الرمز 2048 بايت UTF-8." },
    INVALID_TIMEOUT: { en: "Enter an integer from 1 to 120000 milliseconds.", ar: "أدخل رقماً صحيحاً من 1 إلى 120000 مللي ثانية." },
  };
  return <p id={id} role="alert" className="text-xs font-semibold text-danger-700 dark:text-danger-300">{messages[code]?.[lang] ?? (lang === "ar" ? "هذه القيمة غير صالحة." : "This value is invalid.")}</p>;
}

function MutationNotice({ state }: { state: ReturnType<typeof useFatalAlertSettings> }) {
  if (state.mutation.phase === "IDLE" || state.mutation.phase === "PENDING") return null;
  const succeeded = state.mutation.phase === "SUCCEEDED";
  return <p role={succeeded ? "status" : "alert"} className={`rounded-lg border p-3 text-sm font-semibold ${succeeded ? "border-brand-300 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100" : "border-danger-300 bg-danger-50 text-danger-950 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-100"}`}>{succeeded ? (state.lang === "ar" ? "تم حفظ الإعداد بنجاح." : "Configuration saved successfully.") : mutationMessage(state.mutation.localCode ?? state.mutation.error?.errorCode, state.lang)}{state.mutation.correlationId ? <code dir="ltr" className="ms-2">{state.mutation.correlationId}</code> : null}</p>;
}

function mutationMessage(code: string | undefined, lang: "ar" | "en"): string {
  if (code === "FATAL_ALERT_VALIDATION_FAILED") return lang === "ar" ? "راجع الحقول المميزة وأصلحها." : "Review and correct the highlighted fields.";
  if (code === "NO_FATAL_ALERT_CHANGES") return lang === "ar" ? "لا توجد تغييرات للحفظ." : "There are no changes to save.";
  const safeCode = code ?? "UNKNOWN_ERROR";
  return lang === "ar" ? `تعذر إكمال العملية بأمان. رمز الخطأ: ${safeCode}` : `The operation could not be completed safely. Error code: ${safeCode}`;
}
