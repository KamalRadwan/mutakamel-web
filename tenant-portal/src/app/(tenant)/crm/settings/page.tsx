"use client";

import { AlertTriangle, RotateCw, Save } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmSettings } from "./hooks/useCrmSettings";

export default function CrmSettingsPage() {
  const { t, lang } = useI18n();
  const {
    settings,
    draft,
    setDraft,
    isLoading,
    isSaving,
    isDirty,
    canManage,
    error,
    fetchSettings,
    resetDraft,
    saveSettings,
  } = useCrmSettings();
  const copy =
    lang === "ar"
      ? {
          loading: "جارٍ تحميل إعدادات CRM...",
          unavailable: "تعذر عرض إعدادات CRM. استخدم إعادة التحميل للمحاولة مجددًا.",
          retry: "إعادة التحميل",
          qualification: "اشتراط مرحلة مؤهلة قبل تحويل العميل المحتمل",
          retention: "مدة الاحتفاظ بمحتوى البريد الصادر (بالأيام)",
          retentionHelp: "قيمة صحيحة من 30 إلى 2555 يومًا.",
          save: "حفظ الإعدادات",
          saving: "جارٍ الحفظ...",
          reset: "التراجع عن التغييرات",
          serverState: "حالة الخادم للقراءة فقط",
          defaultLeadStage: "معرّف مرحلة العميل الافتراضية",
          defaultPipeline: "معرّف مسار الفرص الافتراضي",
          policyRevision: "إصدار سياسة الاحتفاظ",
          notSet: "غير معيّن",
          asterisk: "تكامل Asterisk",
          enabled: "مفعّل",
          disabled: "غير مفعّل",
          insecureTls: "السماح بشهادة TLS غير صالحة مفعّل على الخادم. هذا إعداد عالي الخطورة ولا تغيّره هذه الصفحة.",
          readOnly: "لديك صلاحية عرض هذه الإعدادات فقط.",
        }
      : {
          loading: "Loading CRM settings...",
          unavailable: "CRM settings are unavailable. Use reload to try again.",
          retry: "Reload",
          qualification: "Require a qualified stage before lead conversion",
          retention: "Outbound email content retention (days)",
          retentionHelp: "Enter an integer from 30 through 2555 days.",
          save: "Save settings",
          saving: "Saving...",
          reset: "Discard changes",
          serverState: "Read-only server state",
          defaultLeadStage: "Default lead-stage ID",
          defaultPipeline: "Default opportunity-pipeline ID",
          policyRevision: "Retention policy revision",
          notSet: "Not set",
          asterisk: "Asterisk integration",
          enabled: "Enabled",
          disabled: "Disabled",
          insecureTls: "Invalid TLS certificates are allowed on the server. This is a high-risk setting and this page does not modify it.",
          readOnly: "You have read-only access to these settings.",
        };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.cRMGeneralSettingsModule}
        subtitle={t.crm.customizeAutomatedDistributi}
      />

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchSettings()}
            disabled={isLoading || isSaving}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        </div>
      ) : null}

      {!canManage && settings ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {copy.readOnly}
        </p>
      ) : null}

      {isLoading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        >
          {copy.loading}
        </p>
      ) : !settings || !draft ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          {copy.unavailable}
        </p>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveSettings();
            }}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <label className="flex items-start gap-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={draft.requireQualifiedStageForConversion}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          requireQualifiedStageForConversion:
                            event.target.checked,
                        }
                      : current,
                  )
                }
                disabled={isSaving || !canManage}
                className="mt-0.5 size-4 rounded border-slate-300"
              />
              {copy.qualification}
            </label>

            <div className="max-w-sm space-y-1.5">
              <Input
                label={copy.retention}
                type="number"
                min={30}
                max={2555}
                step={1}
                value={
                  Number.isNaN(draft.outboundEmailContentRetentionDays)
                    ? ""
                    : draft.outboundEmailContentRetentionDays
                }
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          outboundEmailContentRetentionDays:
                            event.target.valueAsNumber,
                        }
                      : current,
                  )
                }
                disabled={isSaving || !canManage}
                required
              />
              <p className="text-[11px] text-slate-500">{copy.retentionHelp}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={resetDraft}
                disabled={!canManage || !isDirty || isSaving}
              >
                {copy.reset}
              </Button>
              <Button
                type="submit"
                disabled={!canManage || !isDirty || isSaving}
              >
                <Save className="size-4" aria-hidden="true" />
                {isSaving ? copy.saving : copy.save}
              </Button>
            </div>
          </form>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {copy.serverState}
            </h2>
            <dl className="grid gap-4 text-xs md:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">
                  {copy.defaultLeadStage}
                </dt>
                <dd className="mt-1 break-all font-mono text-slate-900 dark:text-slate-100">
                  {settings.defaultLeadStageId ?? copy.notSet}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">
                  {copy.defaultPipeline}
                </dt>
                <dd className="mt-1 break-all font-mono text-slate-900 dark:text-slate-100">
                  {settings.defaultPipelineId}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">
                  {copy.policyRevision}
                </dt>
                <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100">
                  {settings.outboundEmailRetentionPolicyRevision}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">{copy.asterisk}</dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      settings.asteriskIntegration.enabled
                        ? "success"
                        : "neutral"
                    }
                  >
                    {settings.asteriskIntegration.enabled
                      ? copy.enabled
                      : copy.disabled}
                  </Badge>
                </dd>
              </div>
            </dl>
            {settings.asteriskIntegration.allowInvalidTlsCertificate ? (
              <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {copy.insecureTls}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
