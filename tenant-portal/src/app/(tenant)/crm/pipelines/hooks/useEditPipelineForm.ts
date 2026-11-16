"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { Pipeline, UpdatePipelineInput } from "../pipeline-contract";

function values(pipeline: Pipeline | null): UpdatePipelineInput {
  return { nameAr: pipeline?.nameAr ?? "", nameEn: pipeline?.nameEn ?? "", description: pipeline?.description ?? "", isActive: pipeline?.isActive ?? true };
}

export function useEditPipelineForm(pipeline: Pipeline | null, onSubmit: (input: UpdatePipelineInput) => void) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => values(pipeline));
  const baseline = values(pipeline);
  const nameArError = form.nameAr.trim() ? undefined : t.crmPipelines.nameRequired;
  const nameEnError = form.nameEn.trim() ? undefined : t.crmPipelines.nameRequired;
  return {
    form, nameArError, nameEnError,
    isDirty: Object.keys(baseline).some((key) => form[key as keyof UpdatePipelineInput] !== baseline[key as keyof UpdatePipelineInput]),
    canDeactivate: !pipeline?.isDefault,
    setField: <K extends keyof UpdatePipelineInput>(key: K, value: UpdatePipelineInput[K]) => setForm((current) => ({ ...current, [key]: value })),
    revert: () => setForm(baseline),
    submit: () => { if (!nameArError && !nameEnError) onSubmit(form); },
  };
}
