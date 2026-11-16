"use client";

import { Button, FormModal, Field, Input, Switch, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  PIPELINE_DESCRIPTION_MAX_LENGTH,
  PIPELINE_NAME_MAX_LENGTH,
  type Pipeline,
  type UpdatePipelineInput,
} from "../pipeline-contract";
import { useEditPipelineForm } from "../hooks/useEditPipelineForm";

interface EditPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline | null;
  isSubmitting: boolean;
  error?: string;
  blocked?: boolean;
  onReconcile?: () => void;
  onSubmit: (input: UpdatePipelineInput) => void;
}

// `code` is absent on purpose: UpdatePipelineDto has no `code` field, and the
// default flag moves through PUT /:id/default, not through this body.
export function EditPipelineModal({
  open,
  onOpenChange,
  pipeline,
  isSubmitting,
  error,
  blocked,
  onReconcile,
  onSubmit,
}: EditPipelineModalProps) {
  const { t } = useI18n();
  const state = useEditPipelineForm(pipeline, onSubmit);
  const { form, nameArError, nameEnError, canDeactivate } = state;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmPipelines.editTitle}
      description={t.crmPipelines.editDescription}
      size="card"
      isDirty={state.isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={blocked || pipeline === null}
      footerLeading={<div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={state.revert} disabled={isSubmitting || blocked}>{t.crmPipelines.revertAssignments}</Button>
        {blocked && onReconcile && <Button variant="outline" onClick={onReconcile}>{t.crmPipelines.review.checkCurrent}</Button>}</div>}
      error={error}
      onSubmit={state.submit}
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
    >
      <Field showLabel label={t.crmPipelines.codeLabel} readOnly>
        <Input value={pipeline?.code ?? ""} readOnly tabIndex={-1} dir="ltr" className="font-mono" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
      <Field showLabel label={t.crmPipelines.nameAr} hint={t.crmPipelines.review.nameHint} error={nameArError} required>
        <Input size="sm" placeholder={t.crmPipelines.nameAr}
          value={form.nameAr}
          maxLength={PIPELINE_NAME_MAX_LENGTH}
          dir="rtl"
          disabled={isSubmitting}
          onChange={(event) =>
            state.setField("nameAr", event.target.value)
          }
        />
      </Field>

      <Field showLabel label={t.crmPipelines.nameEn} hint={t.crmPipelines.review.nameHint} error={nameEnError} required>
        <Input size="sm" placeholder={t.crmPipelines.nameEn}
          value={form.nameEn}
          maxLength={PIPELINE_NAME_MAX_LENGTH}
          dir="ltr"
          disabled={isSubmitting}
          onChange={(event) =>
            state.setField("nameEn", event.target.value)
          }
        />
      </Field>

      </div>

      <Field showLabel label={t.crmPipelines.description} hint={t.crmPipelines.review.descriptionHint}>
        <Textarea placeholder={t.crmPipelines.description}
          value={form.description}
          maxLength={PIPELINE_DESCRIPTION_MAX_LENGTH}
          disabled={isSubmitting}
          onChange={(event) =>
            state.setField("description", event.target.value)
          }
        />
      </Field>

      <Field showLabel
        label={t.common.status}
        readOnly={!canDeactivate}
        hint={canDeactivate ? undefined : t.crmPipelines.defaultCannotDisable}
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isActive}
            disabled={!canDeactivate || isSubmitting}
            aria-label={t.common.active}
            onCheckedChange={(checked) =>
              state.setField("isActive", checked)
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
