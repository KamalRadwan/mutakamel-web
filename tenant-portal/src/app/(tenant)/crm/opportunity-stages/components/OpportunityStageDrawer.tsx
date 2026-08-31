"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  OPPORTUNITY_STAGE_FLAGS,
  type OpportunityStageDefinition,
  type OpportunityStageFlag,
  type StageCategory,
} from "../../pipelines/pipeline-contract";
import {
  OPPORTUNITY_STAGE_NAME_MAX_LENGTH,
  allowedCategoriesForFlag,
  defaultCategoryForFlag,
  isCategoryAllowedForFlag,
  toOpportunityStageForm,
  type OpportunityStageFormInput,
} from "../opportunity-stage-contract";

interface OpportunityStageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the create form; a stage opens the edit form. */
  stage: OpportunityStageDefinition | null;
  isSubmitting: boolean;
  error?: string;
  onSubmit: (input: OpportunityStageFormInput) => void;
}

const EMPTY: OpportunityStageFormInput = {
  nameAr: "",
  nameEn: "",
  flag: "DISCOVERY",
  category: "IN_PROGRESS",
  isActive: true,
};

export function OpportunityStageDrawer({
  open,
  onOpenChange,
  stage,
  isSubmitting,
  error,
  onSubmit,
}: OpportunityStageDrawerProps) {
  const { t } = useI18n();
  // Seeded once; the caller remounts this drawer per record it opens for.
  const [form, setForm] = useState<OpportunityStageFormInput>(() =>
    stage ? toOpportunityStageForm(stage) : EMPTY,
  );

  const baseline = stage ? toOpportunityStageForm(stage) : EMPTY;
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const nameArError =
    form.nameAr.trim().length === 0
      ? t.crmOpportunityStages.nameRequired
      : undefined;
  const nameEnError =
    form.nameEn.trim().length === 0
      ? t.crmOpportunityStages.nameRequired
      : undefined;

  // A system stage refuses a flag change or a deactivation outright (422
  // OPPORTUNITY_STAGE_SYSTEM_PROTECTED). Read-only, never disabled: the value
  // matters and is readable, it simply cannot be edited here.
  const semanticsLocked = stage?.isSystem ?? false;
  const categories = allowedCategoriesForFlag(form.flag);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        stage ? t.crmOpportunityStages.editTitle : t.crmOpportunityStages.createTitle
      }
      description={
        stage
          ? t.crmOpportunityStages.editDescription
          : t.crmOpportunityStages.createDescription
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={Boolean(nameArError || nameEnError)}
      error={error}
      onSubmit={() => {
        if (nameArError || nameEnError) return;
        onSubmit(form);
      }}
      labels={{
        submit: stage ? t.common.save : t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <Field label={t.crmOpportunityStages.nameAr} error={nameArError} required>
        <Input
          value={form.nameAr}
          maxLength={OPPORTUNITY_STAGE_NAME_MAX_LENGTH}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameAr: event.target.value }))
          }
        />
      </Field>

      <Field label={t.crmOpportunityStages.nameEn} error={nameEnError} required>
        <Input
          value={form.nameEn}
          maxLength={OPPORTUNITY_STAGE_NAME_MAX_LENGTH}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameEn: event.target.value }))
          }
        />
      </Field>

      <Field
        label={t.crmOpportunityStages.flag}
        readOnly={semanticsLocked}
        hint={
          semanticsLocked ? t.crmOpportunityStages.systemStageHint : undefined
        }
      >
        <Select
          value={form.flag}
          disabled={semanticsLocked}
          onValueChange={(next) => {
            const flag = next as OpportunityStageFlag;
            setForm((current) => ({
              ...current,
              flag,
              // The pairing rule is enforced server-side; move the category
              // with the flag instead of letting the form hold a combination
              // that can only 422.
              category: isCategoryAllowedForFlag(flag, current.category)
                ? current.category
                : defaultCategoryForFlag(flag),
            }));
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPPORTUNITY_STAGE_FLAGS.map((flag) => (
              <SelectItem key={flag} value={flag}>
                {t.statusValues[`OpportunityStageFlag.${flag}`] ?? flag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={t.crmOpportunityStages.category}
        hint={t.crmOpportunityStages.categoryHint}
      >
        <Select
          value={form.category}
          disabled={categories.length === 1}
          onValueChange={(next) =>
            setForm((current) => ({
              ...current,
              category: next as StageCategory,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {t.statusValues[`StageCategory.${category}`] ?? category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {stage ? (
        <Field
          label={t.common.status}
          readOnly={semanticsLocked}
          hint={
            semanticsLocked
              ? t.crmOpportunityStages.systemStageHint
              : t.crmOpportunityStages.inUseHint
          }
        >
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              disabled={semanticsLocked}
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
      ) : null}
    </FormDrawer>
  );
}
