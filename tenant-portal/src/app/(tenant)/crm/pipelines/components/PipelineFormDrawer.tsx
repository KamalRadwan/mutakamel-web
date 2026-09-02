"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  Switch,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  PIPELINE_CODE_MAX_LENGTH,
  PIPELINE_CODE_PATTERN,
  PIPELINE_DESCRIPTION_MAX_LENGTH,
  PIPELINE_NAME_MAX_LENGTH,
  type CreatePipelineInput,
} from "../pipeline-contract";

interface PipelineFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePipelineInput) => void;
  isSubmitting: boolean;
  error?: string;
}

const EMPTY: CreatePipelineInput = {
  code: "",
  nameAr: "",
  nameEn: "",
  description: "",
  isDefault: false,
};

// Create only. `code` is immutable after creation (UpdatePipelineDto has no
// `code` field) and `isDefault` moves through PUT /:id/default, so the edit
// drawer is a different form rather than this one in another mode.
export function PipelineFormDrawer({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: PipelineFormDrawerProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreatePipelineInput>(EMPTY);
  const [touched, setTouched] = useState(false);

  const code = form.code.trim().toUpperCase();
  const codeError =
    touched && (code.length === 0 || !PIPELINE_CODE_PATTERN.test(code))
      ? t.crmPipelines.codeInvalid
      : undefined;
  const nameArError =
    touched && form.nameAr.trim().length === 0
      ? t.crmPipelines.nameRequired
      : undefined;
  const nameEnError =
    touched && form.nameEn.trim().length === 0
      ? t.crmPipelines.nameRequired
      : undefined;
  const isValid = !codeError && !nameArError && !nameEnError && touched;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmPipelines.createTitle}
      description={t.crmPipelines.createDescription}
      isDirty={form !== EMPTY && JSON.stringify(form) !== JSON.stringify(EMPTY)}
      isSubmitting={isSubmitting}
      submitDisabled={!isValid}
      onSubmit={() => {
        setTouched(true);
        if (codeError || nameArError || nameEnError) return;
        onSubmit({ ...form, code });
      }}
      error={error}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field
        label={t.crmPipelines.codeLabel}
        hint={t.crmPipelines.codeHint}
        error={codeError}
        required
      >
        <Input
          value={form.code}
          maxLength={PIPELINE_CODE_MAX_LENGTH}
          autoComplete="off"
          dir="ltr"
          className="font-mono"
          onChange={(event) => {
            setTouched(true);
            setForm((current) => ({ ...current, code: event.target.value }));
          }}
        />
      </Field>

      <Field label={t.crmPipelines.nameAr} error={nameArError} required>
        <Input
          value={form.nameAr}
          maxLength={PIPELINE_NAME_MAX_LENGTH}
          onChange={(event) => {
            setTouched(true);
            setForm((current) => ({ ...current, nameAr: event.target.value }));
          }}
        />
      </Field>

      <Field label={t.crmPipelines.nameEn} error={nameEnError} required>
        <Input
          value={form.nameEn}
          maxLength={PIPELINE_NAME_MAX_LENGTH}
          onChange={(event) => {
            setTouched(true);
            setForm((current) => ({ ...current, nameEn: event.target.value }));
          }}
        />
      </Field>

      <Field label={t.crmPipelines.description}>
        <Textarea
          value={form.description}
          maxLength={PIPELINE_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => {
            setTouched(true);
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }));
          }}
        />
      </Field>

      <div className="flex items-center justify-between gap-3 rounded-sm border border-border p-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t.crmPipelines.setAsDefault}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.crmPipelines.setAsDefaultHint}
          </p>
        </div>
        <Switch
          checked={form.isDefault}
          aria-label={t.crmPipelines.setAsDefault}
          onCheckedChange={(checked) => {
            setTouched(true);
            setForm((current) => ({ ...current, isDefault: checked }));
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t.crmPipelines.createStagesNote}
      </p>
    </FormDrawer>
  );
}
