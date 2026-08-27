"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useToast } from "@/components/ui/ToastContext";
import { PageHeader } from "@/design-system";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useStorageRuntimeSettings } from "./hooks/useStorageRuntimeSettings";

const COPY = {
  en: {
    title: "Storage Runtime",
    statusRegion: "Storage runtime status",
    enabled: "Runtime",
    configured: "Key configuration",
    brokerConfigured: "Broker readiness",
    updatedAt: "Updated",
    enabledValue: "Enabled",
    disabledValue: "Disabled",
    configuredValue: "Configured",
    unconfiguredValue: "Not configured",
    brokerReadyValue: "Ready",
    brokerUnavailableValue: "Not configured",
    never: "Never",
    switchLabel: "Enable storage runtime",
    switchHelp:
      "The runtime can be enabled only after Core has generated an encryption key and reports broker readiness. Disabling blocks new operations; signed URLs already issued can remain valid for up to one hour.",
    keyTitle: "Server-generated encryption key",
    keyHelp:
      "The key is generated, encrypted, and stored by Core. Its raw value is never shown or sent through this API.",
    generate: "Generate encryption key",
    rotate: "Rotate encryption key",
    generateTitle: "Generate the storage encryption key?",
    rotateTitle: "Rotate the storage encryption key?",
    generateDescription:
      "Core will generate and store the initial key. This action does not enable the runtime automatically.",
    rotateDescription:
      "Core will replace the current key atomically. Confirm only when you intend to rotate it.",
    generateTarget: "Generate a new server-side key",
    rotateTarget: "Replace the current server-side key",
    confirmGenerate: "Generate key",
    confirmRotate: "Rotate key",
    generating: "Generating key...",
    rotating: "Rotating key...",
    readOnly:
      "Read-only view. Changes require both admin.settings.update and admin.settings.critical.",
    enableBlocked: "Generate a key before enabling the runtime.",
    brokerBlocked:
      "Storage runtime broker authentication is not fully configured in Core. Enabling is unavailable until Core reports readiness; an already-enabled runtime can still be disabled.",
    enabledToast: "Storage runtime enabled",
    disabledToast: "Storage runtime disabled",
    generatedToast: "Storage encryption key generated",
    rotatedToast: "Storage encryption key rotated",
    actionFailed: "The storage runtime action failed",
    successNotice: "The storage runtime configuration was updated.",
  },
  ar: {
    title: "تشغيل التخزين",
    statusRegion: "حالة تشغيل التخزين",
    enabled: "التشغيل",
    configured: "تهيئة المفتاح",
    brokerConfigured: "جاهزية وسيط الرسائل",
    updatedAt: "آخر تحديث",
    enabledValue: "مفعّل",
    disabledValue: "متوقف",
    configuredValue: "مهيأ",
    unconfiguredValue: "غير مهيأ",
    brokerReadyValue: "جاهز",
    brokerUnavailableValue: "غير مهيأ",
    never: "لم يُحدّث",
    switchLabel: "تفعيل تشغيل التخزين",
    switchHelp:
      "لا يمكن التفعيل قبل أن ينشئ Core مفتاح تشفير ويؤكد جاهزية وسيط الرسائل. يمنع الإيقاف العمليات الجديدة، لكن الروابط الموقعة الصادرة سابقاً قد تظل صالحة لمدة تصل إلى ساعة.",
    keyTitle: "مفتاح تشفير يُنشأ داخل الخادم",
    keyHelp:
      "ينشئ Core المفتاح ويشفّره ويحفظه. لا تُعرض قيمته الخام ولا تمر عبر واجهة API هذه.",
    generate: "إنشاء مفتاح التشفير",
    rotate: "تدوير مفتاح التشفير",
    generateTitle: "إنشاء مفتاح تشفير التخزين؟",
    rotateTitle: "تدوير مفتاح تشفير التخزين؟",
    generateDescription:
      "سينشئ Core المفتاح الأول ويحفظه. لا تؤدي هذه العملية إلى تفعيل التشغيل تلقائياً.",
    rotateDescription:
      "سيستبدل Core المفتاح الحالي بشكل ذري. أكّد فقط إذا كنت تقصد تدويره.",
    generateTarget: "إنشاء مفتاح جديد داخل الخادم",
    rotateTarget: "استبدال المفتاح الحالي داخل الخادم",
    confirmGenerate: "إنشاء المفتاح",
    confirmRotate: "تدوير المفتاح",
    generating: "جارٍ إنشاء المفتاح...",
    rotating: "جارٍ تدوير المفتاح...",
    readOnly:
      "العرض فقط. تتطلب التغييرات صلاحيتي admin.settings.update وadmin.settings.critical معاً.",
    enableBlocked: "أنشئ المفتاح قبل تفعيل التشغيل.",
    brokerBlocked:
      "تهيئة مصادقة وسيط رسائل تشغيل التخزين غير مكتملة في Core. لن يتاح التفعيل حتى يؤكد Core الجاهزية، مع بقاء إمكانية إيقاف تشغيل مفعّل بالفعل.",
    enabledToast: "تم تفعيل تشغيل التخزين",
    disabledToast: "تم إيقاف تشغيل التخزين",
    generatedToast: "تم إنشاء مفتاح تشفير التخزين",
    rotatedToast: "تم تدوير مفتاح تشفير التخزين",
    actionFailed: "تعذر تنفيذ عملية تشغيل التخزين",
    successNotice: "تم تحديث إعداد تشغيل التخزين.",
  },
} as const;

export default function StorageRuntimeSettingsPage() {
  const state = useStorageRuntimeSettings();
  const toast = useToast();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const copy = COPY[state.lang];
  const config = state.snapshot?.data;
  const pending = state.mutation.phase === "PENDING";
  const keyMutationPending =
    pending &&
    (state.mutation.action === "GENERATE_KEY" ||
      state.mutation.action === "ROTATE_KEY");

  const changeEnabled = async (enabled: boolean) => {
    const succeeded = await state.setEnabled(enabled);
    if (succeeded) {
      toast.success(enabled ? copy.enabledToast : copy.disabledToast);
    } else {
      toast.error(
        copy.actionFailed,
        mutationMessage(state, copy.enableBlocked, copy.brokerBlocked),
      );
    }
  };

  const confirmKeyAction = async () => {
    const wasConfigured = Boolean(config?.configured);
    const succeeded = await state.rotateKey();
    if (succeeded) {
      setConfirmationOpen(false);
      toast.success(wasConfigured ? copy.rotatedToast : copy.generatedToast);
    } else {
      toast.error(
        copy.actionFailed,
        mutationMessage(state, copy.enableBlocked, copy.brokerBlocked),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />

      <SettingsResourceBoundary
        state={state.loadState}
        error={state.loadError}
        lang={state.lang}
        onRetry={() => void state.refetch()}
      >
        {config ? (
          <>
            <StorageRuntimeEvidence
              enabled={config.enabled}
              configured={config.configured}
              brokerConfigured={config.brokerConfigured}
              updatedAt={config.updatedAt}
              lang={state.lang}
            />

            <MutationNotice state={state} />

            {!state.canUpdateCritical ? (
              <p
                role="note"
                className="rounded-xl border border-border bg-ink-100 p-3 text-sm text-foreground dark:border-border dark:bg-ink-800 dark:text-foreground"
              >
                {copy.readOnly}
              </p>
            ) : null}

            <section className="grid gap-4 rounded-xl border border-border bg-white p-5 dark:border-border dark:bg-ink-900">
              <label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-border bg-ink-100 px-4 dark:border-border dark:bg-ink-1000">
                <span>
                  <strong className="block text-sm">{copy.switchLabel}</strong>
                  <span
                    id="storage-runtime-enable-help"
                    className="mt-1 block text-xs text-muted-foreground"
                  >
                    {copy.switchHelp}
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={copy.switchLabel}
                  aria-describedby="storage-runtime-enable-help"
                  checked={config.enabled}
                  disabled={
                    pending ||
                    !state.canUpdateCritical ||
                    (!config.enabled &&
                      (!config.configured || !config.brokerConfigured))
                  }
                  onChange={(event) => void changeEnabled(event.target.checked)}
                  className="size-5 shrink-0 accent-brand-600 disabled:cursor-not-allowed"
                />
              </label>

              {!config.configured ? (
                <p role="note" className="text-xs font-semibold text-warn-700 dark:text-warn-300">
                  {copy.enableBlocked}
                </p>
              ) : null}

              {!config.brokerConfigured ? (
                <p role="note" className="text-xs font-semibold text-warn-700 dark:text-warn-300">
                  {copy.brokerBlocked}
                </p>
              ) : null}

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-border p-4 dark:border-border sm:flex-row sm:items-center">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <KeyRound className="size-4 text-warn-600" aria-hidden="true" />
                    {copy.keyTitle}
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    {copy.keyHelp}
                  </p>
                </div>
                {state.canUpdateCritical ? (
                  <button
                    type="button"
                    onClick={() => setConfirmationOpen(true)}
                    disabled={pending}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-warn-600 px-4 text-xs font-semibold text-white hover:bg-warn-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {keyMutationPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <KeyRound className="size-4" aria-hidden="true" />
                    )}
                    {config.configured ? copy.rotate : copy.generate}
                  </button>
                ) : null}
              </div>
            </section>

            <DestructiveActionModal
              isOpen={confirmationOpen}
              onClose={() => setConfirmationOpen(false)}
              onConfirm={() => void confirmKeyAction()}
              title={config.configured ? copy.rotateTitle : copy.generateTitle}
              description={
                config.configured
                  ? copy.rotateDescription
                  : copy.generateDescription
              }
              targetName={
                config.configured ? copy.rotateTarget : copy.generateTarget
              }
              actionType="change-password"
              requireNameTyping={false}
              isSubmitting={keyMutationPending}
              confirmLabel={
                config.configured ? copy.confirmRotate : copy.confirmGenerate
              }
              submittingLabel={
                config.configured ? copy.rotating : copy.generating
              }
            />
          </>
        ) : null}
      </SettingsResourceBoundary>
    </div>
  );
}

function StorageRuntimeEvidence({
  enabled,
  configured,
  brokerConfigured,
  updatedAt,
  lang,
}: {
  enabled: boolean;
  configured: boolean;
  brokerConfigured: boolean;
  updatedAt: string | null;
  lang: "ar" | "en";
}) {
  const copy = COPY[lang];
  return (
    <section
      role="region"
      aria-label={copy.statusRegion}
      className="rounded-xl border border-border bg-white p-4 dark:border-border dark:bg-ink-900"
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EvidenceItem
          label={copy.enabled}
          value={enabled ? copy.enabledValue : copy.disabledValue}
        />
        <EvidenceItem
          label={copy.configured}
          value={configured ? copy.configuredValue : copy.unconfiguredValue}
        />
        <EvidenceItem
          label={copy.brokerConfigured}
          value={
            brokerConfigured
              ? copy.brokerReadyValue
              : copy.brokerUnavailableValue
          }
        />
        <EvidenceItem
          label={copy.updatedAt}
          value={updatedAt ? formatUpdatedAt(updatedAt, lang) : copy.never}
        />
      </dl>
    </section>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800">
      <dt className="text-xs font-semibold text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function MutationNotice({
  state,
}: {
  state: ReturnType<typeof useStorageRuntimeSettings>;
}) {
  if (state.mutation.phase === "IDLE" || state.mutation.phase === "PENDING") {
    return null;
  }
  const succeeded = state.mutation.phase === "SUCCEEDED";
  const copy = COPY[state.lang];
  return (
    <p
      role={succeeded ? "status" : "alert"}
      className={`rounded-xl border p-3 text-sm font-semibold ${
        succeeded
          ? "border-brand-300 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100"
          : "border-danger-300 bg-danger-50 text-danger-950 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-100"
      }`}
    >
      {succeeded
        ? copy.successNotice
        : mutationMessage(
            state,
            copy.enableBlocked,
            copy.brokerBlocked,
          )}
    </p>
  );
}

function mutationMessage(
  state: ReturnType<typeof useStorageRuntimeSettings>,
  notConfiguredMessage: string,
  brokerNotConfiguredMessage: string,
): string {
  const code = state.mutation.localCode ?? state.mutation.error?.errorCode;
  if (code === "CORE.STORAGE_RUNTIME.NOT_CONFIGURED") {
    return notConfiguredMessage;
  }
  if (code === "CORE.STORAGE.RUNTIME_AUTH_NOT_CONFIGURED") {
    return brokerNotConfiguredMessage;
  }
  const safeCode = code ?? "UNKNOWN_ERROR";
  return state.lang === "ar"
    ? `تعذر إكمال العملية بأمان. رمز الخطأ: ${safeCode}`
    : `The operation could not be completed safely. Error code: ${safeCode}`;
}

function formatUpdatedAt(value: string, lang: "ar" | "en"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
