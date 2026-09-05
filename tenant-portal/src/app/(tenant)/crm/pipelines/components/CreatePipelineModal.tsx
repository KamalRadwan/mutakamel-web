"use client";

import { useMemo, useState } from "react";
import {
  Field,
  FormModal,
  FormSection,
  Input,
  Switch,
  Textarea,
  type FormModalSection,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  PIPELINE_CODE_MAX_LENGTH,
  PIPELINE_CODE_PATTERN,
  PIPELINE_DESCRIPTION_MAX_LENGTH,
  PIPELINE_NAME_MAX_LENGTH,
  validatePipelineStageSelection,
  type CreatePipelineInput,
  type OpportunityStageDefinition,
} from "../pipeline-contract";
import { PipelineStagePickerSection } from "./create-pipeline/PipelineStagePickerSection";

export interface CreatePipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePipelineInput) => void;
  isSubmitting: boolean;
  error?: string;
  /** The reusable stage catalogue. Empty while it loads or if it 403s. */
  stageCatalogue: OpportunityStageDefinition[];
  isLoadingCatalogue: boolean;
}

const EMPTY: CreatePipelineInput = {
  code: "",
  nameAr: "",
  nameEn: "",
  description: "",
  isDefault: false,
  stageIds: [],
};

/**
 * Creating a pipeline, on the whole viewport.
 *
 * The drawer this replaces had five fields and a sentence explaining that
 * stages had to be added somewhere else afterwards — which left every new
 * pipeline holding the canonical six until someone went and fixed it. The DTO
 * has accepted an ordered `stageIds` all along; what was missing was a surface
 * with room to show what the order means. See docs/design/patterns.md#formmodal.
 *
 * `code` is create-only (`UpdatePipelineDto` has none) and `isDefault` moves
 * through `PUT /:id/default` afterwards, so the edit drawer stays a different
 * form rather than this one in another mode.
 */
export function CreatePipelineModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
  stageCatalogue,
  isLoadingCatalogue,
}: CreatePipelineModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreatePipelineInput>(EMPTY);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [revealed, setRevealed] = useState(false);

  const code = form.code.trim().toUpperCase();
  const selected = form.stageIds
    .map((id) => stageCatalogue.find((stage) => stage.id === id))
    .filter((stage): stage is OpportunityStageDefinition => stage !== undefined);

  const allErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (code.length === 0) errors.code = t.crmShared.fieldRequired;
    else if (!PIPELINE_CODE_PATTERN.test(code)) errors.code = t.crmPipelines.codeInvalid;
    if (form.nameAr.trim().length === 0) errors.nameAr = t.crmPipelines.nameRequired;
    if (form.nameEn.trim().length === 0) errors.nameEn = t.crmPipelines.nameRequired;
    if (form.description.trim().length > PIPELINE_DESCRIPTION_MAX_LENGTH) {
      errors.description = formatTemplate(t.crmShared.fieldMaxLength, {
        max: PIPELINE_DESCRIPTION_MAX_LENGTH,
      });
    }
    const problem = validatePipelineStageSelection(selected);
    if (problem) errors.stages = t.crmPipelines.create.stageProblems[problem];
    return errors;
  }, [code, form.description, form.nameAr, form.nameEn, selected, t]);

  const errors = revealed
    ? allErrors
    : Object.fromEntries(Object.entries(allErrors).filter(([path]) => touched.has(path)));

  const touch = (path: string) =>
    setTouched((current) => (current.has(path) ? current : new Set(current).add(path)));

  const setField = <K extends keyof CreatePipelineInput>(
    key: K,
    value: CreatePipelineInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const reset = () => {
    setForm(EMPTY);
    setTouched(new Set());
    setRevealed(false);
  };

  const indexEntries: FormModalSection[] = [
    { id: "identity", label: t.crmPipelines.create.sections.identity, invalid: Boolean(errors.code ?? errors.nameAr ?? errors.nameEn ?? errors.description) },
    { id: "stages", label: t.crmPipelines.create.sections.stages, invalid: Boolean(errors.stages) },
  ];

  const errorCount = Object.keys(errors).length;

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t.crmPipelines.createTitle}
      isDirty={JSON.stringify(form) !== JSON.stringify(EMPTY)}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        setRevealed(true);
        if (Object.keys(allErrors).length > 0) return;
        onSubmit({ ...form, code });
      }}
      error={error}
      sections={indexEntries}
      labels={{
        submit: t.common.create,
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
        errorCount > 0 ? (
          <p role="status" className="text-xs text-destructive">
            {formatTemplate(t.crmShared.formErrorCount, { count: errorCount })}
          </p>
        ) : undefined
      }
    >
      <FormSection id="identity" title={t.crmPipelines.create.sections.identity}>
        <Field
          label={t.crmPipelines.codeLabel}
          hint={t.crmPipelines.codeHint}
          error={errors.code}
          required
        >
          <Input
            value={form.code}
            maxLength={PIPELINE_CODE_MAX_LENGTH}
            autoComplete="off"
            dir="ltr"
            className="font-mono"
            disabled={isSubmitting}
            onChange={(event) => setField("code", event.target.value)}
            onBlur={() => touch("code")}
          />
        </Field>

        <Field label={t.crmPipelines.nameAr} error={errors.nameAr} required>
          <Input
            value={form.nameAr}
            maxLength={PIPELINE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => setField("nameAr", event.target.value)}
            onBlur={() => touch("nameAr")}
          />
        </Field>

        <Field label={t.crmPipelines.nameEn} error={errors.nameEn} required>
          <Input
            value={form.nameEn}
            maxLength={PIPELINE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => setField("nameEn", event.target.value)}
            onBlur={() => touch("nameEn")}
          />
        </Field>

        <Field
          label={t.crmPipelines.description}
          error={errors.description}
          className="md:col-span-2 max-w-prose"
        >
          <Textarea
            rows={3}
            value={form.description}
            maxLength={PIPELINE_DESCRIPTION_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => setField("description", event.target.value)}
            onBlur={() => touch("description")}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-sm border border-border p-2.5 md:col-span-2">
          <div>
            <p className="text-sm font-medium text-foreground">{t.crmPipelines.setAsDefault}</p>
            <p className="text-xs text-muted-foreground">{t.crmPipelines.setAsDefaultHint}</p>
          </div>
          <Switch
            checked={form.isDefault}
            aria-label={t.crmPipelines.setAsDefault}
            disabled={isSubmitting}
            onCheckedChange={(checked) => setField("isDefault", checked)}
          />
        </div>
      </FormSection>

      <PipelineStagePickerSection
        catalogue={stageCatalogue}
        selectedIds={form.stageIds}
        disabled={isSubmitting}
        isLoading={isLoadingCatalogue}
        onChange={(stageIds) => {
          setField("stageIds", stageIds);
          touch("stages");
        }}
      />
    </FormModal>
  );
}
