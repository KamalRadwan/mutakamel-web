"use client";

import {
  Button,
  Field,
  FormModal,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CREATABLE_LEAD_STAGE_FLAGS,
  LEAD_STAGE_CATEGORIES,
  type LeadStageCategory,
  type LeadStageFlag,
  type LeadStageItem,
  type UpdateLeadStageFormData,
} from "../lead-stage-contract";
import { useEditLeadStageForm } from "../hooks/useLeadStageForm";

interface EditLeadStageModalProps {
  stage: LeadStageItem | null;
  isSubmitting: boolean;
  submitBlocked?: boolean;
  isReloading?: boolean;
  onReload?: () => void;
  error: string | null;
  onClose: () => void;
  onSubmit: (form: UpdateLeadStageFormData) => Promise<boolean>;
}

// PATCH /lead-stages/:id — task 8.17. `isDefault` is not here: the DTO has no
// such field and the service writes the stored value back over any patch. The
// default moves through POST /lead-stages/:id/default, on the list row.
export function EditLeadStageModal({
  stage,
  isSubmitting,
  submitBlocked,
  isReloading,
  onReload,
  error,
  onClose,
  onSubmit,
}: EditLeadStageModalProps) {
  const { t } = useI18n();
  const { form, setForm, arabicName, englishName, isDirty, isProtected, canDeactivate, submit, reset } = useEditLeadStageForm(stage, onSubmit);

  return (
    <FormModal
      open={stage !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmLeadStages.editTitle}
      description={t.crmLeadStages.editDescription}
      size="card"
      density="compact"
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      error={submitBlocked ? `${error ?? ""} ${t.crmLeadStages.reloadRequired}`.trim() : error ?? undefined}
      submitDisabled={isProtected || submitBlocked || !isDirty}
      onSubmit={submit}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: t.common.close,
      }}
      footerLeading={
        submitBlocked && onReload ? (
          <Button type="button" variant="outline" size="sm" loading={isReloading} onClick={onReload}>
            {t.crmLeadStages.reload}
          </Button>
        ) : isDirty && !isProtected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={reset}
          >
            {t.crmLeadStages.revert}
          </Button>
        ) : undefined
      }
    >
      <Field showLabel
        label={t.crmLeadStages.arabicName}
        error={arabicName.error}
        readOnly={isProtected}
        hint={isProtected ? t.crmLeadStages.protectedHint : t.crmLeadStages.nameLimit}
        required
      >
        <Input size="sm" placeholder={t.crmLeadStages.arabicName}
          dir="rtl"
          value={form.nameAr}
          maxLength={80}
          readOnly={isProtected}
          disabled={isSubmitting}
          {...arabicName.fieldProps}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameAr: event.target.value }))
          }
        />
      </Field>

      <Field showLabel
        label={t.crmLeadStages.englishName}
        error={englishName.error}
        readOnly={isProtected}
        hint={t.crmLeadStages.nameLimit}
        required
      >
        <Input size="sm" placeholder={t.crmLeadStages.englishName}
          dir="ltr"
          value={form.nameEn}
          maxLength={80}
          readOnly={isProtected}
          disabled={isSubmitting}
          {...englishName.fieldProps}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameEn: event.target.value }))
          }
        />
      </Field>

      <Field showLabel
        label={t.crmLeadStages.flag}
        readOnly={isProtected}
        hint={isProtected ? t.crmLeadStages.protectedHint : t.crmLeadStages.flagChangeHint}
      >
        <Select
          value={form.flag}
          disabled={isProtected || isSubmitting}
          onValueChange={(next) =>
            setForm((current) => ({ ...current, flag: next as LeadStageFlag }))
          }
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREATABLE_LEAD_STAGE_FLAGS.map((flag) => (
              <SelectItem key={flag} value={flag}>
                {t.statusValues[`LeadStageFlag.${flag}`] ?? flag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field showLabel
        label={t.crmLeadStages.category}
        readOnly={isProtected}
        hint={isProtected ? t.crmLeadStages.protectedHint : undefined}
      >
        <Select
          value={form.category}
          disabled={isProtected || isSubmitting}
          onValueChange={(next) =>
            setForm((current) => ({
              ...current,
              category: next as LeadStageCategory,
            }))
          }
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STAGE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {t.statusValues[`StageCategory.${category}`] ?? category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field showLabel
        label={t.common.status}
        readOnly={!canDeactivate}
        hint={canDeactivate ? undefined : t.crmLeadStages.cannotDeactivate}
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isActive}
            disabled={!canDeactivate || isSubmitting}
            aria-label={t.common.active}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, isActive: checked }))
            }
          />
          <span className="text-sm text-foreground">
            {form.isActive ? t.common.active : t.common.inactive}
          </span>
        </div>
      </Field>
    </FormModal>
  );
}
