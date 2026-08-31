"use client";

import { useState } from "react";
import { EditDrawer, Field, Input, Switch, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  PIPELINE_DESCRIPTION_MAX_LENGTH,
  PIPELINE_NAME_MAX_LENGTH,
  type Pipeline,
  type UpdatePipelineInput,
} from "../pipeline-contract";

interface EditPipelineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline | null;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (input: UpdatePipelineInput) => void;
}

function toForm(pipeline: Pipeline | null): UpdatePipelineInput {
  return {
    nameAr: pipeline?.nameAr ?? "",
    nameEn: pipeline?.nameEn ?? "",
    description: pipeline?.description ?? "",
    isActive: pipeline?.isActive ?? true,
  };
}

// `code` is absent on purpose: UpdatePipelineDto has no `code` field, and the
// default flag moves through PUT /:id/default, not through this body.
export function EditPipelineDrawer({
  open,
  onOpenChange,
  pipeline,
  isSubmitting,
  error,
  onSubmit,
}: EditPipelineDrawerProps) {
  const { t } = useI18n();
  // Seeded once. The caller remounts this drawer on the record it opens for,
  // so there is no prop-to-state sync to run in an effect.
  const [form, setForm] = useState<UpdatePipelineInput>(() => toForm(pipeline));

  const baseline = toForm(pipeline);
  const isDirty =
    form.nameAr !== baseline.nameAr ||
    form.nameEn !== baseline.nameEn ||
    form.description !== baseline.description ||
    form.isActive !== baseline.isActive;

  const nameArError =
    form.nameAr.trim().length === 0 ? t.crmPipelines.nameRequired : undefined;
  const nameEnError =
    form.nameEn.trim().length === 0 ? t.crmPipelines.nameRequired : undefined;

  // The default pipeline cannot be deactivated — the service answers 422
  // PIPELINE_DEFAULT_DEACTIVATE. Saying so beforehand beats a round trip.
  const canDeactivate = !(pipeline?.isDefault ?? false);

  return (
    <EditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmPipelines.editTitle}
      description={t.crmPipelines.editDescription}
      notFound={pipeline === null}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onRevert={() => setForm(baseline)}
      error={error}
      onSubmit={() => {
        if (nameArError || nameEnError) return;
        onSubmit(form);
      }}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        loadErrorTitle: t.crmPipelines.loadFailed,
        retry: t.common.retry,
        notFoundTitle: t.crmPipelines.notFoundTitle,
        notFoundBack: t.common.back,
        revert: t.crmPipelines.revertAssignments,
      }}
    >
      <Field label={t.crmPipelines.nameAr} error={nameArError} required>
        <Input
          value={form.nameAr}
          maxLength={PIPELINE_NAME_MAX_LENGTH}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameAr: event.target.value }))
          }
        />
      </Field>

      <Field label={t.crmPipelines.nameEn} error={nameEnError} required>
        <Input
          value={form.nameEn}
          maxLength={PIPELINE_NAME_MAX_LENGTH}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameEn: event.target.value }))
          }
        />
      </Field>

      <Field label={t.crmPipelines.description}>
        <Textarea
          value={form.description}
          maxLength={PIPELINE_DESCRIPTION_MAX_LENGTH}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </Field>

      <Field
        label={t.common.status}
        readOnly={!canDeactivate}
        hint={canDeactivate ? undefined : t.crmPipelines.defaultCannotDisable}
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isActive}
            disabled={!canDeactivate}
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
    </EditDrawer>
  );
}
