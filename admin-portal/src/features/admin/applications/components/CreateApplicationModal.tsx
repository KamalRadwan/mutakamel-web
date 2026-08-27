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
  Button,
} from "@/design-system";
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
  const { lang } = useI18n();
  const copy = onboardingCopy(lang);
  const form = useApplicationOnboardingForm({
    canOnboard,
    onClose,
    onCreate,
    onOnboard,
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !form.isSubmitting && form.close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {canOnboard ? copy.onboardTitle : copy.registerTitle}
          </DialogTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {canOnboard ? copy.onboardDescription : copy.legacyDescription}
          </p>
        </DialogHeader>
        <form onSubmit={form.submit} className="space-y-4">
          <Field label={copy.key} required>
            {(fp) => (
              <Input
                {...fp}
                autoFocus
                required
                pattern="^[a-z][a-z0-9_]{0,31}$"
                maxLength={32}
                dir="ltr"
                className="font-mono"
                value={form.formData.key}
                onChange={(event) => form.setText("key", event.target.value)}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={copy.commercialMode}>
              {(fp) => (
                <Select
                  value={form.formData.commercialMode}
                  onValueChange={(value) => form.setCommercialMode(value as typeof form.formData.commercialMode)}
                >
                  <SelectTrigger id={fp.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="NON_BILLABLE"
                      disabled={form.formData.applicationType === "SYSTEM" && form.formData.catalogueVisibility === "PUBLIC"}
                    >
                      {copy.nonBillable}
                    </SelectItem>
                    <SelectItem value="INCLUDED">{copy.included}</SelectItem>
                    {form.formData.applicationType === "TENANT" && (
                      <SelectItem value="SUBSCRIPTION">{copy.subscription}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.visibility}>
              {(fp) => (
                <Select
                  value={form.formData.catalogueVisibility}
                  onValueChange={(value) => form.setVisibility(value as typeof form.formData.catalogueVisibility)}
                >
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

          <Field label={copy.name} required>
            {(fp) => (
              <Input
                {...fp}
                required
                maxLength={128}
                value={form.formData.name}
                onChange={(event) => form.setText("name", event.target.value)}
              />
            )}
          </Field>

          <Field label={copy.description}>
            {(fp) => (
              <Input
                {...fp}
                maxLength={512}
                value={form.formData.description}
                onChange={(event) => form.setText("description", event.target.value)}
              />
            )}
          </Field>

          <Field label={copy.applicationType}>
            {(fp) => (
              <Select
                value={form.formData.applicationType}
                onValueChange={(value) => form.setApplicationType(value as typeof form.formData.applicationType)}
              >
                <SelectTrigger id={fp.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">{copy.tenant}</SelectItem>
                  <SelectItem value="SYSTEM">{copy.system}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>

          {canOnboard && (
            <>
              <Field label={copy.databaseDeployment} hint={copy.deploymentHelp}>
                {(fp) => (
                  <Select
                    value={form.formData.databaseDeployment}
                    onValueChange={(value) => form.setDatabaseDeployment(value as typeof form.formData.databaseDeployment)}
                  >
                    <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" disabled={form.formData.applicationType === "TENANT"}>
                        {copy.none}
                      </SelectItem>
                      <SelectItem value="ON_DEMAND">{copy.onDemand}</SelectItem>
                      <SelectItem value="PREWARM">{copy.prewarm}</SelectItem>
                      <SelectItem value="REQUIRED">{copy.required}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label={copy.reason} required>
                {(fp) => (
                  <Textarea
                    {...fp}
                    required
                    maxLength={256}
                    rows={3}
                    value={form.formData.reason}
                    onChange={(event) => form.setText("reason", event.target.value)}
                    placeholder={copy.reasonPlaceholder}
                  />
                )}
              </Field>
            </>
          )}

          <footer className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={form.isSubmitting} onClick={form.close}>
              {copy.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={form.isSubmitting || (canOnboard && form.formData.reason.trim().length === 0)}
            >
              {form.isSubmitting ? copy.saving : canOnboard ? copy.onboard : copy.createDraft}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
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
