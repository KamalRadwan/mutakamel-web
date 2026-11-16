"use client";

import {
  Checkbox,
  Field,
  FormModal,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CREATABLE_LEAD_STAGE_FLAGS,
  LEAD_STAGE_CATEGORIES,
  type CreateLeadStageFormData,
  type LeadStageCategory,
} from "../lead-stage-contract";
import { useCreateLeadStageForm } from "../hooks/useLeadStageForm";

interface CreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  submitBlocked?: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CreateLeadStageFormData) => Promise<boolean>;
}

export function CreateLeadStagesModal({ isOpen, isSubmitting, submitBlocked, error, onClose, onSubmit }: CreateModalProps) {
  const { t } = useI18n();
  const { form, setForm, arabicName, englishName, isDirty, close, submit } = useCreateLeadStageForm(onSubmit, onClose);

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.crmLeadStages.addTitle}
      size="card"
      density="compact"
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={submitBlocked}
      onSubmit={() => void submit()}
      error={error ?? undefined}
      labels={{
        submit: isSubmitting ? t.crmLeadStages.creating : t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: t.common.close,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field showLabel label={t.crmLeadStages.arabicName} required hint={t.crmLeadStages.nameLimit} error={arabicName.error}>
          <Input size="sm" placeholder={t.crmLeadStages.arabicName}
            dir="rtl"
            value={form.nameAr}
            onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))}
            maxLength={80}
            required
            disabled={isSubmitting}
            {...arabicName.fieldProps}
          />
        </Field>
        <Field showLabel label={t.crmLeadStages.englishName} required hint={t.crmLeadStages.nameLimit} error={englishName.error}>
          <Input size="sm" placeholder={t.crmLeadStages.englishName}
            dir="ltr"
            value={form.nameEn}
            onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))}
            maxLength={80}
            required
            disabled={isSubmitting}
            {...englishName.fieldProps}
          />
        </Field>
        <Field showLabel label={t.crmLeadStages.flag}>
          <Select
            value={form.flag}
            onValueChange={(value) => {
              const flag = value as CreateLeadStageFormData["flag"];
              setForm((current) => ({ ...current, flag }));
            }}
          >
            <SelectTrigger size="sm" disabled={isSubmitting}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATABLE_LEAD_STAGE_FLAGS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t.statusValues[`LeadStageFlag.${value}`] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field showLabel label={t.crmLeadStages.category}>
          <Select
            value={form.category}
            onValueChange={(value) => setForm((current) => ({ ...current, category: value as LeadStageCategory }))}
          >
            <SelectTrigger size="sm" disabled={isSubmitting}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGE_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t.statusValues[`StageCategory.${value}`] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox
            checked={form.isDefault}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked === true }))}
            disabled={isSubmitting}
          />
          {t.crmLeadStages.isDefaultOption}
        </label>
      </div>
    </FormModal>
  );
}
