"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { OpportunityStageDefinition, OpportunityStageFlag, StageCategory } from "../../pipelines/pipeline-contract";
import { OPPORTUNITY_STAGE_NAME_MAX_LENGTH, allowedCategoriesForFlag, defaultCategoryForFlag, isCategoryAllowedForFlag, toOpportunityStageForm, type OpportunityStageFormInput } from "../opportunity-stage-contract";

const EMPTY: OpportunityStageFormInput = { nameAr: "", nameEn: "", flag: "DISCOVERY", category: "IN_PROGRESS", isActive: true };

export function useOpportunityStageForm(stage: OpportunityStageDefinition | null, submit: (input: OpportunityStageFormInput) => void, assigned = false, open = true) {
  const { t, lang } = useI18n();
  const baseline = stage ? toOpportunityStageForm(stage) : EMPTY;
  const [form, setForm] = useState<OpportunityStageFormInput>(baseline);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState({ nameAr: false, nameEn: false });
  const [wasAssigned, setWasAssigned] = useState(assigned);
  if (wasAssigned !== assigned) {
    setWasAssigned(assigned);
    // Membership is absent from GET. After a server refusal, restore only the
    // protected values and retain edited names/category wherever still valid.
    if (assigned && stage) setForm((current) => ({ ...current, flag: stage.flag, isActive: stage.isActive, category: isCategoryAllowedForFlag(stage.flag, current.category) ? current.category : stage.category }));
  }
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const navigationGuard = useUnsavedChangesGuard(isDirty && open);
  const nameError = (value: string) => !value.trim() ? t.crmOpportunityStages.nameRequired : value.trim().length > OPPORTUNITY_STAGE_NAME_MAX_LENGTH ? t.crmOpportunityStages.nameTooLong : undefined;
  const nameArError = nameError(form.nameAr);
  const nameEnError = nameError(form.nameEn);
  const updateName = (key: "nameAr" | "nameEn", value: string) => setForm((current) => ({ ...current, [key]: value }));

  return {
    t, form,
    isDirty, navigationGuard,
    changeNavigationDiscard: (open: boolean) => { if (!open) navigationGuard.cancelDiscard(); },
    validationMessage: attempted && (nameArError || nameEnError) ? t.crmOpportunityStages.validationSummary : undefined,
    semanticsLocked: Boolean(stage?.isSystem || assigned),
    categories: allowedCategoriesForFlag(form.flag),
    nameArError: attempted || touched.nameAr ? nameArError : undefined,
    nameEnError: attempted || touched.nameEn ? nameEnError : undefined,
    count: (value: string) => `${new Intl.NumberFormat(INTL_LOCALE[lang]).format(value.length)}/${OPPORTUNITY_STAGE_NAME_MAX_LENGTH}`,
    changeNameAr: (value: string) => updateName("nameAr", value),
    changeNameEn: (value: string) => updateName("nameEn", value),
    touchNameAr: () => setTouched((current) => ({ ...current, nameAr: true })),
    touchNameEn: () => setTouched((current) => ({ ...current, nameEn: true })),
    changeFlag: (value: string) => {
      if (stage?.isSystem || assigned) return;
      const flag = value as OpportunityStageFlag;
      setForm((current) => ({ ...current, flag, category: isCategoryAllowedForFlag(flag, current.category) ? current.category : defaultCategoryForFlag(flag) }));
    },
    changeCategory: (value: string) => setForm((current) => ({ ...current, category: value as StageCategory })),
    changeActive: (isActive: boolean) => { if (!stage?.isSystem && !assigned) setForm((current) => ({ ...current, isActive })); },
    submit: () => {
      setAttempted(true);
      if (!nameArError && !nameEnError) submit(form);
    },
  };
}
