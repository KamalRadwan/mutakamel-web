"use client";

import { useCallback, useState } from "react";
import {
  Checkbox,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useBlurValidation,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CREATABLE_LEAD_STAGE_FLAGS,
  LEAD_STAGE_CATEGORIES,
  type CreateLeadStageFormData,
  type LeadStageCategory,
} from "../lead-stage-contract";

interface CreateModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CreateLeadStageFormData) => Promise<boolean>;
}

const initialForm: CreateLeadStageFormData = {
  nameAr: "",
  nameEn: "",
  flag: "CONTACTED",
  category: "IN_PROGRESS",
  isDefault: false,
};

export function CreateLeadStagesModal({ isOpen, isSubmitting, error, onClose, onSubmit }: CreateModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreateLeadStageFormData>(initialForm);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  // The same two rules buildCreateLeadStageRequest enforces before it will
  // build a body — stated once here so the user sees them before submitting
  // rather than as a thrown "Invalid lead stage form."
  const validateName = useCallback(
    (value: string): string | undefined => {
      const trimmed = value.trim();
      if (!trimmed) return t.crmLeadStages.nameRequired;
      if (trimmed.length > 80) return t.crmLeadStages.nameTooLong;
      return undefined;
    },
    [t],
  );

  const arabicName = useBlurValidation(form.nameAr, validateName);
  const englishName = useBlurValidation(form.nameEn, validateName);

  const close = () => {
    setForm(initialForm);
    arabicName.reset();
    englishName.reset();
    onClose();
  };

  const handleSubmit = async () => {
    // Reveal before checking: a never-blurred empty field has no error text
    // yet, and FormDrawer's focus rule needs one to aim at.
    arabicName.reveal();
    englishName.reveal();
    if (!arabicName.isValid || !englishName.isValid) return;
    if (await onSubmit(form)) {
      setForm(initialForm);
      arabicName.reset();
      englishName.reset();
    }
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.crmLeadStages.addTitle}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
      labels={{
        submit: isSubmitting ? t.crmLeadStages.creating : t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.crmLeadStages.arabicName} required error={arabicName.error}>
          <Input
            dir="rtl"
            value={form.nameAr}
            onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))}
            maxLength={80}
            required
            disabled={isSubmitting}
            {...arabicName.fieldProps}
          />
        </Field>
        <Field label={t.crmLeadStages.englishName} required error={englishName.error}>
          <Input
            dir="ltr"
            value={form.nameEn}
            onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))}
            maxLength={80}
            required
            disabled={isSubmitting}
            {...englishName.fieldProps}
          />
        </Field>
        <Field label={t.crmLeadStages.flag}>
          <Select
            value={form.flag}
            onValueChange={(value) => {
              const flag = value as CreateLeadStageFormData["flag"];
              setForm((current) => ({ ...current, flag, isDefault: flag === "CONVERTED" ? false : current.isDefault }));
            }}
          >
            <SelectTrigger disabled={isSubmitting}>
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
        <Field label={t.crmLeadStages.category}>
          <Select
            value={form.category}
            onValueChange={(value) => setForm((current) => ({ ...current, category: value as LeadStageCategory }))}
          >
            <SelectTrigger disabled={isSubmitting}>
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
            disabled={isSubmitting || form.flag === "CONVERTED"}
          />
          {t.crmLeadStages.isDefaultOption}
        </label>
      </div>
    </FormDrawer>
  );
}
