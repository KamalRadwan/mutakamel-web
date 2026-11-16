"use client";

import {
  Field,
  Button,
  DegradedBanner,
  FormModal,
  FormSection,
  Input,
  Switch,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  PIPELINE_CODE_MAX_LENGTH,
  PIPELINE_DESCRIPTION_MAX_LENGTH,
  PIPELINE_NAME_MAX_LENGTH,
  type CreatePipelineInput,
  type OpportunityStageDefinition,
} from "../pipeline-contract";
import { useCreatePipelineForm } from "../hooks/useCreatePipelineForm";
import { PipelineStagePickerSection } from "./create-pipeline/PipelineStagePickerSection";

export interface CreatePipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePipelineInput) => void;
  isSubmitting: boolean;
  error?: string;
  failureCode?: string;
  uncertain?: boolean;
  onReconcile?: () => void;
  /** The reusable stage catalogue. Empty while it loads or if it 403s. */
  stageCatalogue: OpportunityStageDefinition[];
  isLoadingCatalogue: boolean;
  catalogueError?: boolean;
  onReloadCatalogue?: () => void;
}

// CreatePipelineDto supports ordered stageIds; keep that choice alongside
// identity in the modal, with canonical six as the empty-selection default.
export function CreatePipelineModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
  failureCode,
  uncertain,
  onReconcile,
  stageCatalogue,
  isLoadingCatalogue,
  catalogueError,
  onReloadCatalogue,
}: CreatePipelineModalProps) {
  const { t } = useI18n();
  const state = useCreatePipelineForm(stageCatalogue, onSubmit, failureCode);
  const { form, errors, setField, reset, errorCount } = state;

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t.crmPipelines.createTitle}
      size="wide"
      isDirty={state.isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={uncertain}
      onSubmit={state.submit}
      error={error}
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
        <Field showLabel
          label={t.crmPipelines.codeLabel}
          hint={t.crmPipelines.review.codeHint}
          error={errors.code}
          required
          className="md:col-span-2"
        >
          <Input size="sm" placeholder={t.crmPipelines.codeLabel}
            value={form.code}
            maxLength={PIPELINE_CODE_MAX_LENGTH}
            autoComplete="off"
            dir="ltr"
            className="max-w-xs font-mono"
            disabled={isSubmitting}
            onChange={(event) => setField("code", event.target.value)}
          />
        </Field>

        <Field showLabel label={t.crmPipelines.nameAr} hint={t.crmPipelines.review.nameHint} error={errors.nameAr} required>
          <Input size="sm" placeholder={t.crmPipelines.nameAr}
            value={form.nameAr}
            maxLength={PIPELINE_NAME_MAX_LENGTH}
            dir="rtl"
            disabled={isSubmitting}
            onChange={(event) => setField("nameAr", event.target.value)}
          />
        </Field>

        <Field showLabel label={t.crmPipelines.nameEn} hint={t.crmPipelines.review.nameHint} error={errors.nameEn} required>
          <Input size="sm" placeholder={t.crmPipelines.nameEn}
            value={form.nameEn}
            maxLength={PIPELINE_NAME_MAX_LENGTH}
            dir="ltr"
            disabled={isSubmitting}
            onChange={(event) => setField("nameEn", event.target.value)}
          />
        </Field>

        <Field showLabel
          label={t.crmPipelines.description}
          error={errors.description}
          hint={t.crmPipelines.review.descriptionHint}
          className="md:col-span-2 max-w-prose"
        >
          <Textarea placeholder={t.crmPipelines.description}
            rows={3}
            value={form.description}
            maxLength={PIPELINE_DESCRIPTION_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => setField("description", event.target.value)}
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

      {uncertain && <div className="space-y-2"><DegradedBanner message={t.crmPipelines.review.uncertainWrite} />
        {onReconcile && <Button variant="outline" onClick={onReconcile}>{t.crmPipelines.review.checkCurrent}</Button>}
      </div>}
      {catalogueError && <div className="space-y-2"><DegradedBanner message={t.crmPipelines.review.createCatalogueUnavailable} />
        {onReloadCatalogue && <Button variant="outline" onClick={onReloadCatalogue} disabled={isLoadingCatalogue}>{t.common.retry}</Button>}
      </div>}
      <PipelineStagePickerSection
        catalogue={stageCatalogue}
        selectedIds={form.stageIds}
        disabled={isSubmitting}
        isLoading={isLoadingCatalogue}
        onChange={(stageIds) => {
          setField("stageIds", stageIds);
        }}
      />
    </FormModal>
  );
}
