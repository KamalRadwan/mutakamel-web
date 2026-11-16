"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { PIPELINE_CODE_PATTERN, PIPELINE_DESCRIPTION_MAX_LENGTH, validatePipelineStageSelection, type CreatePipelineInput, type OpportunityStageDefinition } from "../pipeline-contract";

const EMPTY: CreatePipelineInput = { code: "", nameAr: "", nameEn: "", description: "", isDefault: false, stageIds: [] };

export function useCreatePipelineForm(catalogue: OpportunityStageDefinition[], onSubmit: (input: CreatePipelineInput) => void, failureCode?: string) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreatePipelineInput>(EMPTY);
  const [revealed, setRevealed] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string>();
  const code = form.code.trim().toUpperCase();
  const selected = form.stageIds.map((id) => catalogue.find((stage) => stage.id === id)).filter((stage): stage is OpportunityStageDefinition => stage !== undefined);
  const allErrors: Record<string, string> = {};
  if (!code) allErrors.code = t.crmShared.fieldRequired;
  else if (!PIPELINE_CODE_PATTERN.test(code)) allErrors.code = t.crmPipelines.codeInvalid;
  if (!form.nameAr.trim()) allErrors.nameAr = t.crmPipelines.nameRequired;
  if (!form.nameEn.trim()) allErrors.nameEn = t.crmPipelines.nameRequired;
  if (form.description.trim().length > PIPELINE_DESCRIPTION_MAX_LENGTH) allErrors.description = formatTemplate(t.crmShared.fieldMaxLength, { max: PIPELINE_DESCRIPTION_MAX_LENGTH });
  const problem = validatePipelineStageSelection(selected);
  if (problem) allErrors.stages = t.crmPipelines.create.stageProblems[problem];
  // Blur validation can resize a centred modal between pointer-down and
  // pointer-up, swallowing Cancel. Reveal errors on an explicit submit.
  const errors: Record<string, string> = revealed ? allErrors : {};
  if (failureCode === "PIPELINE_CODE_TAKEN" && code === submittedCode) errors.code = t.crmPipelines.errors.PIPELINE_CODE_TAKEN;
  const reset = () => { setForm(EMPTY); setRevealed(false); };
  return {
    form, errors, reset, isDirty: JSON.stringify(form) !== JSON.stringify(EMPTY), errorCount: Object.keys(errors).length,
    setField: <K extends keyof CreatePipelineInput>(key: K, value: CreatePipelineInput[K]) => setForm((current) => ({ ...current, [key]: value })),
    submit: () => { setRevealed(true); if (Object.keys(allErrors).length === 0) { setSubmittedCode(code); onSubmit({ ...form, code }); } },
  };
}
