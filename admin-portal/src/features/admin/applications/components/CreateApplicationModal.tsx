import { useId } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAccessibleDialog } from "@/shared/hooks/useAccessibleDialog";
import { useApplicationOnboardingForm } from "../hooks/useApplicationOnboardingForm";
import type { CreateApplicationDto, OnboardApplicationDto } from "../types";

export function CreateApplicationModal({
  isOpen,
  onClose,
  onCreate,
  onOnboard,
  canOnboard,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (dto: CreateApplicationDto) => Promise<unknown>;
  onOnboard: (dto: OnboardApplicationDto) => Promise<unknown>;
  canOnboard: boolean;
}) {
  const { lang, dir } = useI18n();
  const copy = onboardingCopy(lang);
  const form = useApplicationOnboardingForm({
    canOnboard,
    onClose,
    onCreate,
    onOnboard,
  });
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, onKeyDown, onBackdropMouseDown } = useAccessibleDialog({
    open: isOpen,
    onClose: form.close,
    isSubmitting: form.isSubmitting,
    initialFocusSelector: "[data-dialog-initial-focus]",
  });

  if (!isOpen) return null;

  return (
    <div
      dir={dir}
      role="presentation"
      onMouseDown={onBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={form.isSubmitting} tabIndex={-1} onKeyDown={onKeyDown} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 id={titleId} className="text-lg font-bold">
          {canOnboard ? copy.onboardTitle : copy.registerTitle}
        </h2>
        <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {canOnboard ? copy.onboardDescription : copy.legacyDescription}
        </p>
        <form onSubmit={form.submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="application-onboarding-key" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.key}</label>
            <input
              id="application-onboarding-key"
              data-dialog-initial-focus
              required
              pattern="^[a-z][a-z0-9_]{0,31}$"
              maxLength={32}
              dir="ltr"
              className="w-full rounded-lg border p-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              value={form.formData.key}
              onChange={(event) => form.setText("key", event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="application-onboarding-commercial-mode" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.commercialMode}</label>
              <select id="application-onboarding-commercial-mode" className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" value={form.formData.commercialMode} onChange={(event) => form.setCommercialMode(event.target.value as typeof form.formData.commercialMode)}><option value="NON_BILLABLE" disabled={form.formData.applicationType === "SYSTEM" && form.formData.catalogueVisibility === "PUBLIC"}>{copy.nonBillable}</option><option value="INCLUDED">{copy.included}</option>{form.formData.applicationType === "TENANT" && <option value="SUBSCRIPTION">{copy.subscription}</option>}</select>
            </div>
            <div>
              <label htmlFor="application-onboarding-visibility" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.visibility}</label>
              <select id="application-onboarding-visibility" className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" value={form.formData.catalogueVisibility} onChange={(event) => form.setVisibility(event.target.value as typeof form.formData.catalogueVisibility)}><option value="PUBLIC">{copy.public}</option><option value="INTERNAL">{copy.internal}</option></select>
            </div>
          </div>
          <div>
            <label htmlFor="application-onboarding-name" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.name}</label>
            <input
              id="application-onboarding-name"
              required
              maxLength={128}
              className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.formData.name}
              onChange={(event) => form.setText("name", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="application-onboarding-description" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.description}</label>
            <input
              id="application-onboarding-description"
              maxLength={512}
              className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.formData.description}
              onChange={(event) => form.setText("description", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="application-onboarding-type" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.applicationType}</label>
            <select
              id="application-onboarding-type"
              className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              value={form.formData.applicationType}
              onChange={(event) => form.setApplicationType(event.target.value as typeof form.formData.applicationType)}
            >
              <option value="TENANT">{copy.tenant}</option>
              <option value="SYSTEM">{copy.system}</option>
            </select>
          </div>

          {canOnboard && <>
            <div>
              <label htmlFor="application-onboarding-database-deployment" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.databaseDeployment}</label>
              <select id="application-onboarding-database-deployment" aria-describedby="application-onboarding-database-help" className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" value={form.formData.databaseDeployment} onChange={(event) => form.setDatabaseDeployment(event.target.value as typeof form.formData.databaseDeployment)}>
                <option value="NONE" disabled={form.formData.applicationType === "TENANT"}>{copy.none}</option>
                <option value="ON_DEMAND">{copy.onDemand}</option>
                <option value="PREWARM">{copy.prewarm}</option>
                <option value="REQUIRED">{copy.required}</option>
              </select>
              <p id="application-onboarding-database-help" className="mt-1 text-[11px] text-slate-500">{copy.deploymentHelp}</p>
            </div>
            <div>
              <label htmlFor="application-onboarding-reason" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{copy.reason}</label>
              <textarea id="application-onboarding-reason" required maxLength={256} rows={3} className="w-full resize-none rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" value={form.formData.reason} onChange={(event) => form.setText("reason", event.target.value)} placeholder={copy.reasonPlaceholder} />
            </div>
          </>}

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={form.close}
              disabled={form.isSubmitting}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={
                form.isSubmitting ||
                (canOnboard && form.formData.reason.trim().length === 0)
              }
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {form.isSubmitting ? copy.saving : canOnboard ? copy.onboard : copy.createDraft}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function onboardingCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        onboardTitle: "تهيئة تطبيق",
        registerTitle: "تسجيل مسودة تطبيق",
        onboardDescription: "ينشئ هوية الكتالوج والملف التقني وسياسة قاعدة البيانات والربط الأساسي في عملية واحدة.",
        legacyDescription: "ينشئ مسودة الكتالوج فقط لأن حسابك لا يملك صلاحيات التهيئة التقنية الكاملة.",
        key: "المفتاح الثابت",
        commercialMode: "النمط التجاري",
        visibility: "الظهور",
        name: "الاسم",
        description: "الوصف",
        applicationType: "نوع التطبيق",
        databaseDeployment: "نمط نشر قاعدة البيانات",
        reason: "سبب التهيئة",
        reasonPlaceholder: "وضّح سبب إضافة التطبيق",
        deploymentHelp: "لا يدعم تطبيق المستأجر نمط بلا قاعدة بيانات حاليًا.",
        nonBillable: "غير قابل للفوترة",
        included: "مضمّن",
        subscription: "اشتراك",
        public: "عام",
        internal: "داخلي",
        tenant: "للمستأجر",
        system: "نظامي",
        none: "بلا قاعدة بيانات",
        onDemand: "عند الطلب",
        prewarm: "تجهيز مسبق",
        required: "إلزامي على كل الخوادم",
        cancel: "إلغاء",
        saving: "جارٍ الحفظ…",
        onboard: "تهيئة التطبيق",
        createDraft: "إنشاء المسودة",
      }
    : {
        onboardTitle: "Onboard Application",
        registerTitle: "Register Application Draft",
        onboardDescription: "Creates the catalogue identity, technical profile, database policy, and primary binding in one operation.",
        legacyDescription: "Creates only the catalogue draft because your account does not have the complete technical-onboarding permissions.",
        key: "Immutable key",
        commercialMode: "Commercial mode",
        visibility: "Visibility",
        name: "Name",
        description: "Description",
        applicationType: "Application type",
        databaseDeployment: "Database deployment",
        reason: "Onboarding reason",
        reasonPlaceholder: "Explain why this Application is being added",
        deploymentHelp: "Tenant Applications cannot use the database-free mode yet.",
        nonBillable: "Non-billable",
        included: "Included",
        subscription: "Subscription",
        public: "Public",
        internal: "Internal",
        tenant: "Tenant",
        system: "System",
        none: "None",
        onDemand: "On demand",
        prewarm: "Prewarm",
        required: "Required on every server",
        cancel: "Cancel",
        saving: "Saving…",
        onboard: "Onboard Application",
        createDraft: "Create Draft",
      };
}
