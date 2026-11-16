"use client";

import { useCallback, useState } from "react";
import { useBlurValidation } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  isProtectedLeadStage, toUpdateLeadStageForm,
  type CreateLeadStageFormData, type LeadStageItem, type UpdateLeadStageFormData,
} from "../lead-stage-contract";

const CREATE: CreateLeadStageFormData = {
  nameAr: "", nameEn: "", flag: "CONTACTED", category: "IN_PROGRESS", isDefault: false,
};
const EDIT: UpdateLeadStageFormData = {
  nameAr: "", nameEn: "", flag: "CONTACTED", category: "IN_PROGRESS", isActive: true,
};

function useLeadStageForm<T extends { nameAr: string; nameEn: string }>(baseline: T) {
  const { t } = useI18n();
  const [form, setForm] = useState(baseline);
  const validateName = useCallback((value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return t.crmLeadStages.nameRequired;
    if (trimmed.length > 80) return t.crmLeadStages.nameTooLong;
    return undefined;
  }, [t]);
  const arabicName = useBlurValidation(form.nameAr, validateName);
  const englishName = useBlurValidation(form.nameEn, validateName);
  const reset = () => {
    setForm(baseline);
    arabicName.reset();
    englishName.reset();
  };
  const validate = () => {
    arabicName.reveal();
    englishName.reveal();
    return arabicName.isValid && englishName.isValid;
  };
  return { form, setForm, arabicName, englishName, reset, validate, isDirty: JSON.stringify(form) !== JSON.stringify(baseline) };
}

export function useCreateLeadStageForm(onSubmit: (form: CreateLeadStageFormData) => Promise<boolean>, onClose: () => void) {
  const state = useLeadStageForm(CREATE);
  return {
    ...state,
    close: () => { state.reset(); onClose(); },
    submit: async () => {
      if (state.validate() && await onSubmit(state.form)) state.reset();
    },
  };
}

export function useEditLeadStageForm(stage: LeadStageItem | null, onSubmit: (form: UpdateLeadStageFormData) => Promise<boolean>) {
  const state = useLeadStageForm(stage ? toUpdateLeadStageForm(stage) : EDIT);
  const isProtected = stage ? isProtectedLeadStage(stage) : false;
  return {
    ...state,
    isProtected,
    canDeactivate: !isProtected && !(stage?.isDefault ?? false),
    submit: () => { if (!isProtected && state.validate()) void onSubmit(state.form); },
  };
}
