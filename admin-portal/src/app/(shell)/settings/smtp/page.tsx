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
import { PageHeader, Button } from "@/design-system";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSmtpSettings } from "./hooks/useSmtpSettings";
import {
  SMTP_ALLOWED_PORTS,
  type SmtpFormState,
  type SmtpValidationErrors,
} from "./smtp-contract";

export default function SmtpSettingsPage() {
  const smtp = useSmtpSettings();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const { lang } = smtp;
  const pending = smtp.mutation.phase === "PENDING";

  const save = async () => {
    const succeeded = await smtp.saveConfig();
    if (succeeded) {
      toast.success(
        lang === "ar" ? "تم حفظ إعدادات SMTP" : "SMTP settings saved",
        lang === "ar"
          ? "أصبحت استجابة Core الموثوقة هي الحالة المعروضة."
          : "The authoritative Core response is now displayed.",
      );
    } else {
      toast.error(
        lang === "ar" ? "تعذر الحفظ" : "Save failed",
        safeMutationMessage(smtp.mutation.localCode ?? smtp.mutation.error?.errorCode, lang),
      );
    }
  };
  const verify = async () => {
    const succeeded = await smtp.verifyConnection();
    if (succeeded) {
      toast.success(
        lang === "ar" ? "تم التحقق من الاتصال" : "Connection verified",
        lang === "ar"
          ? "تحققت Core من الإعداد المحفوظ دون إرسال بريد."
          : "Core verified the saved configuration without sending email.",
      );
    } else {
      toast.error(
        lang === "ar" ? "فشل التحقق" : "Verification failed",
        safeMutationMessage(smtp.mutation.localCode ?? smtp.mutation.error?.errorCode, lang),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "ar" ? "بوابة البريد SMTP" : "SMTP Email Gateway"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {smtp.canVerify ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void verify()}
                disabled={!smtp.canTestSavedConfig || pending}
                title={
                  smtp.hasUnsavedChanges
                    ? lang === "ar"
                      ? "احفظ التغييرات قبل اختبار الإعداد المحفوظ."
                      : "Save changes before testing the persisted configuration."
                    : undefined
                }
              >
                {pending && smtp.mutation.action === "VERIFY" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PlayCircle className="size-4" />
                )}
                {lang === "ar" ? "اختبار الإعداد المحفوظ" : "Test saved configuration"}
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
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {lang === "ar" ? "حفظ الإعداد" : "Save configuration"}
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
              <p role="status" className="rounded-xl border border-warn-300 bg-warn-50 p-3 text-sm font-semibold text-warn-950 dark:border-warn-900 dark:bg-warn-950/30 dark:text-warn-100">
                {lang === "ar"
                  ? "لديك تغييرات غير محفوظة. اختبار الاتصال معطل حتى يحفظ Core الإعداد ويعيد استجابته الموثوقة."
                  : "Unsaved changes are present. Connection testing stays disabled until Core saves and returns the authoritative configuration."}
              </p>
            ) : null}
            {!smtp.canSaveCritical ? (
              <p role="note" className="rounded-xl border border-border bg-ink-100 p-3 text-sm text-foreground dark:border-border dark:bg-ink-800 dark:text-foreground">
                {lang === "ar"
                  ? "القراءة متاحة، لكن الحفظ يتطلب admin.settings.update و admin.settings.critical معاً."
                  : "Read-only view. Saving requires both admin.settings.update and admin.settings.critical."}
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
            <History className="size-4 text-muted-foreground" />
            {lang === "ar" ? "سجل SMTP الآمن" : "Redacted SMTP audit"}
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
                      <strong className="rounded-md bg-brand-50 px-2 py-1 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
                        {log.action}
                      </strong>
                      {log.revision === null ? null : <code>r{log.revision}</code>}
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <UserCheck className="size-3.5" />
                        {log.actor}
                      </span>
                      <time className="text-muted-foreground" dateTime={log.createdAt}>
                        {new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                      </time>
                    </div>
                    {log.changes.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {log.changes.map((change, index) => (
                          <li key={`${change.field}-${index}`} className="rounded-lg bg-ink-100 px-2 py-1 font-mono text-xs text-foreground dark:bg-ink-800 dark:text-foreground">
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
                {lang === "ar" ? "لا توجد سجلات SMTP بعد." : "No SMTP audit entries yet."}
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
  const config = smtp.snapshot?.data;
  if (!config) return null;
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-white p-4 text-sm dark:border-border dark:bg-ink-900 sm:grid-cols-3">
      <Evidence label={lang === "ar" ? "الحالة" : "Status"} value={config.configured ? (lang === "ar" ? "مهيأ" : "Configured") : (lang === "ar" ? "غير مهيأ" : "Not configured")} />
      <Evidence label={lang === "ar" ? "المراجعة" : "Revision"} value={config.revision === null ? "—" : String(config.revision)} />
      <Evidence label={lang === "ar" ? "آخر تحديث" : "Updated"} value={config.updatedAt ? new Date(config.updatedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "—"} />
    </section>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800"><span className="block text-xs font-semibold text-muted-foreground">{label}</span><strong className="mt-1 block">{value}</strong></div>;
}

function SmtpMutationNotice({ smtp }: { smtp: ReturnType<typeof useSmtpSettings> }) {
  if (smtp.mutation.phase === "IDLE" || smtp.mutation.phase === "PENDING") return null;
  const succeeded = smtp.mutation.phase === "SUCCEEDED";
  return (
    <p role={succeeded ? "status" : "alert"} className={`rounded-xl border p-3 text-sm font-semibold ${succeeded ? "border-brand-300 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100" : "border-danger-300 bg-danger-50 text-danger-950 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-100"}`}>
      {succeeded
        ? smtp.lang === "ar" ? "اكتملت العملية بنجاح." : "The operation completed successfully."
        : safeMutationMessage(smtp.mutation.localCode ?? smtp.mutation.error?.errorCode, smtp.lang)}
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
  return (
    <form aria-label={lang === "ar" ? "إعداد SMTP" : "SMTP configuration"} onSubmit={(event) => event.preventDefault()} className="grid gap-5 rounded-xl border border-border bg-white p-5 dark:border-border dark:bg-ink-900 lg:grid-cols-2">
      <TextField id="smtp-from-address" label={lang === "ar" ? "عنوان المرسل" : "From address"} type="email" value={form.fromAddress} maxLength={320} disabled={disabled} error={errors.fromAddress} lang={lang} onChange={(value) => onUpdate("fromAddress", value)} />
      <TextField id="smtp-from-name" label={lang === "ar" ? "اسم المرسل" : "From name"} value={form.fromName} maxLength={200} disabled={disabled} error={errors.fromName} lang={lang} onChange={(value) => onUpdate("fromName", value)} />
      <TextField id="smtp-sender-domain" label={lang === "ar" ? "نطاق المرسل" : "Sender domain"} value={form.senderDomain} maxLength={253} disabled={disabled} error={errors.senderDomain} lang={lang} onChange={(value) => onUpdate("senderDomain", value)} />
      <TextField id="smtp-host" label={lang === "ar" ? "مضيف SMTP" : "SMTP host"} value={form.smtpHost} maxLength={253} disabled={disabled} error={errors.smtpHost} lang={lang} onChange={(value) => onUpdate("smtpHost", value)} />
      <SelectField id="smtp-port" label={lang === "ar" ? "منفذ SMTP" : "SMTP port"} value={form.smtpPort} disabled={disabled} error={errors.smtpPort} lang={lang} onChange={(value) => onUpdate("smtpPort", value)} options={SMTP_ALLOWED_PORTS.map((port) => ({ value: String(port), label: String(port) }))} />
      <SelectField id="smtp-protocol" label={lang === "ar" ? "البروتوكول" : "Protocol"} value={form.smtpProtocol ?? ""} disabled={disabled} error={errors.smtpProtocol} lang={lang} onChange={(value) => onUpdate("smtpProtocol", value === "smtp" || value === "smtps" ? value : null)} options={[{ value: "smtp", label: "SMTP" }, { value: "smtps", label: "SMTPS" }]} />
      <SelectField id="smtp-secure" label={lang === "ar" ? "TLS آمن" : "Secure TLS"} value={form.smtpSecure === null ? "" : String(form.smtpSecure)} disabled={disabled} error={errors.smtpSecure} lang={lang} onChange={(value) => onUpdate("smtpSecure", value === "true" ? true : value === "false" ? false : null)} options={[{ value: "true", label: lang === "ar" ? "مفعّل" : "Enabled" }, { value: "false", label: lang === "ar" ? "غير مفعّل" : "Disabled" }]} />
      <TextField id="smtp-username" label={lang === "ar" ? "اسم مستخدم SMTP" : "SMTP username"} value={form.smtpUsername} maxLength={320} disabled={disabled} error={errors.smtpUsername} lang={lang} onChange={(value) => onUpdate("smtpUsername", value)} />
      <div className="grid gap-1.5">
        <label htmlFor="smtp-password" className="text-xs font-semibold">{lang === "ar" ? "كلمة مرور SMTP (للكتابة فقط)" : "SMTP password (write-only)"}</label>
        <div className="relative">
          <input id="smtp-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} maxLength={1024} disabled={disabled} aria-invalid={Boolean(errors.smtpPassword)} aria-describedby={errors.smtpPassword ? "smtp-password-error" : undefined} onChange={(event) => onPassword(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-ink-100 ps-3 pe-11 font-mono text-sm outline-none focus:border-brand-500 dark:bg-ink-1000 disabled:opacity-50" />
          <button type="button" onClick={onTogglePassword} disabled={disabled} aria-label={showPassword ? (lang === "ar" ? "إخفاء كلمة المرور" : "Hide password") : (lang === "ar" ? "إظهار كلمة المرور" : "Show password")} className="absolute end-3 top-3 text-muted-foreground disabled:opacity-40">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        <FieldError id="smtp-password-error" code={errors.smtpPassword} lang={lang} />
      </div>
      <p className="text-xs leading-5 text-muted-foreground lg:col-span-2">
        {lang === "ar"
          ? "المنافذ المدعومة حالياً: 25 و465 و587 و2525. يتطلب SMTPS اتصالاً آمناً، ويتطلب المنفذ 465 بروتوكول SMTPS مع TLS آمن."
          : "Current Core ports: 25, 465, 587, and 2525. SMTPS requires secure TLS; port 465 requires SMTPS with secure TLS."}
      </p>
    </form>
  );
}

function TextField({ id, label, type = "text", value, maxLength, disabled, error, lang, onChange }: { id: string; label: string; type?: "text" | "email"; value: string; maxLength: number; disabled: boolean; error?: string; lang: "ar" | "en"; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return <div className="grid gap-1.5"><label htmlFor={id} className="text-xs font-semibold">{label}</label><input id={id} type={type} value={value} maxLength={maxLength} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-lg border border-border bg-ink-100 px-3 text-sm outline-none focus:border-brand-500 dark:bg-ink-1000 disabled:opacity-50" /><FieldError id={errorId} code={error} lang={lang} /></div>;
}

function SelectField({ id, label, value, disabled, error, lang, options, onChange }: { id: string; label: string; value: string; disabled: boolean; error?: string; lang: "ar" | "en"; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return <div className="grid gap-1.5"><label htmlFor={id} className="text-xs font-semibold">{label}</label><select id={id} value={value} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-lg border border-border bg-ink-100 px-3 text-sm outline-none focus:border-brand-500 dark:bg-ink-1000 disabled:opacity-50"><option value="">{lang === "ar" ? "اختر…" : "Select…"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><FieldError id={errorId} code={error} lang={lang} /></div>;
}

function FieldError({ id, code, lang }: { id: string; code?: string; lang: "ar" | "en" }) {
  if (!code) return null;
  return <p id={id} role="alert" className="text-xs font-semibold text-danger-700 dark:text-danger-300">{fieldErrorCopy(code, lang)}</p>;
}

function fieldErrorCopy(code: string, lang: "ar" | "en"): string {
  const english: Record<string, string> = {
    INVALID_EMAIL: "Enter a valid email address up to 320 characters.",
    INVALID_FROM_NAME: "Enter 1–200 characters without line breaks.",
    INVALID_DOMAIN: "Enter a valid multi-label domain name.",
    INVALID_PORT: "Select an integer SMTP port.",
    UNSUPPORTED_PORT: "Select port 25, 465, 587, or 2525.",
    SECURITY_REQUIRED: "Select whether secure TLS is enabled.",
    PROTOCOL_REQUIRED: "Select SMTP or SMTPS.",
    INVALID_USERNAME: "Enter an SMTP username up to 320 characters.",
    PASSWORD_REQUIRED: "Initial configuration requires a password.",
    PASSWORD_TOO_LONG: "Password must not exceed 1024 characters.",
    SMTPS_REQUIRES_SECURE: "SMTPS requires secure TLS.",
    PORT_465_REQUIRES_SMTPS: "Port 465 requires SMTPS with secure TLS.",
  };
  if (lang === "en") return english[code] ?? "This field is invalid.";
  const arabic: Record<string, string> = {
    INVALID_EMAIL: "أدخل عنوان بريد صحيحاً بحد أقصى 320 حرفاً.",
    INVALID_FROM_NAME: "أدخل من 1 إلى 200 حرف بدون فواصل أسطر.",
    INVALID_DOMAIN: "أدخل اسم نطاق متعدد المقاطع صالحاً.",
    INVALID_PORT: "اختر منفذ SMTP صحيحاً.",
    UNSUPPORTED_PORT: "اختر المنفذ 25 أو 465 أو 587 أو 2525.",
    SECURITY_REQUIRED: "حدد ما إذا كان TLS الآمن مفعلاً.",
    PROTOCOL_REQUIRED: "اختر SMTP أو SMTPS.",
    INVALID_USERNAME: "أدخل اسم مستخدم بحد أقصى 320 حرفاً.",
    PASSWORD_REQUIRED: "يتطلب الإعداد الأولي كلمة مرور.",
    PASSWORD_TOO_LONG: "يجب ألا تتجاوز كلمة المرور 1024 حرفاً.",
    SMTPS_REQUIRES_SECURE: "يتطلب SMTPS تفعيل TLS الآمن.",
    PORT_465_REQUIRES_SMTPS: "يتطلب المنفذ 465 بروتوكول SMTPS مع TLS آمن.",
  };
  return arabic[code] ?? "هذه القيمة غير صالحة.";
}

function safeMutationMessage(code: string | undefined, lang: "ar" | "en"): string {
  const safeCode = code ?? "UNKNOWN_ERROR";
  if (safeCode === "SAVE_BEFORE_VERIFY") {
    return lang === "ar" ? "احفظ التغييرات قبل اختبار الاتصال." : "Save changes before testing the connection.";
  }
  if (safeCode === "SMTP_VALIDATION_FAILED") {
    return lang === "ar" ? "راجع الحقول المميزة وأصلحها." : "Review and correct the highlighted fields.";
  }
  if (safeCode === "NO_SMTP_CHANGES") {
    return lang === "ar" ? "لا توجد تغييرات لإرسالها." : "There are no changes to save.";
  }
  return lang === "ar"
    ? `تعذر إكمال العملية بأمان. رمز الخطأ: ${safeCode}`
    : `The operation could not be completed safely. Error code: ${safeCode}`;
}
