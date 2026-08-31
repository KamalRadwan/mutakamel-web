"use client";

import { useCallback, useState } from "react";
import {
  EditDrawer,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  useBlurValidation,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  LEAD_STAGE_CATEGORIES,
  isProtectedLeadStage,
  toUpdateLeadStageForm,
  type LeadStageCategory,
  type LeadStageFlag,
  type LeadStageItem,
  type UpdateLeadStageFormData,
} from "../lead-stage-contract";

interface EditLeadStageDrawerProps {
  stage: LeadStageItem | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (form: UpdateLeadStageFormData) => Promise<boolean>;
}

const EMPTY: UpdateLeadStageFormData = {
  nameAr: "",
  nameEn: "",
  flag: "CONTACTED",
  category: "IN_PROGRESS",
  isActive: true,
};

// PATCH /lead-stages/:id — task 8.17. `isDefault` is not here: the DTO has no
// such field and the service writes the stored value back over any patch. The
// default moves through POST /lead-stages/:id/default, on the list row.
export function EditLeadStageDrawer({
  stage,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: EditLeadStageDrawerProps) {
  const { t } = useI18n();
  // Seeded once; the caller remounts this drawer per stage it opens for.
  const [form, setForm] = useState<UpdateLeadStageFormData>(() =>
    stage ? toUpdateLeadStageForm(stage) : EMPTY,
  );

  const validateName = useCallback(
    (value: string): string | undefined => {
      const trimmed = value.trim();
      if (!trimmed) return t.crmLeadStages.nameRequired;
      if (trimmed.length > 80) return t.crmLeadStages.nameTooLong;
      return undefined;
    },
    [t],
  );

  const arabicName = useBlurValidation(form.nameAr, validateName);
  const englishName = useBlurValidation(form.nameEn, validateName);

  const baseline = stage ? toUpdateLeadStageForm(stage) : EMPTY;
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  // The stage flagged NEW is protected end to end: no rename, no flag change,
  // no deactivation (LEAD_STAGE_PROTECTED). Read-only with a reason, never
  // `disabled` — the values matter and are readable, they just cannot change
  // here. Every other flag is offered EXCEPT NEW, which nothing may become.
  const isProtected = stage ? isProtectedLeadStage(stage) : false;
  const selectableFlags = stage
    ? (["CONTACTED", "QUALIFYING", "QUALIFIED", "NURTURING", "ON_HOLD", "DISQUALIFIED", "CONVERTED"] as const)
    : [];
  const canDeactivate = !isProtected && !(stage?.isDefault ?? false);

  return (
    <EditDrawer
      open={stage !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmLeadStages.editTitle}
      description={t.crmLeadStages.editDescription}
      notFound={false}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onRevert={() => setForm(baseline)}
      error={error ?? undefined}
      onSubmit={() => {
        arabicName.reveal();
        englishName.reveal();
        if (!arabicName.isValid || !englishName.isValid) return;
        void onSubmit(form);
      }}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        loadErrorTitle: t.crmLeadStages.loadFailed,
        retry: t.common.retry,
        notFoundTitle: t.crmLeadStages.loadFailed,
        notFoundBack: t.common.back,
        revert: t.crmLeadStages.revert,
      }}
    >
      <Field
        label={t.crmLeadStages.arabicName}
        error={arabicName.error}
        readOnly={isProtected}
        hint={isProtected ? t.crmLeadStages.protectedHint : undefined}
        required
      >
        <Input
          value={form.nameAr}
          maxLength={80}
          readOnly={isProtected}
          {...arabicName.fieldProps}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameAr: event.target.value }))
          }
        />
      </Field>

      <Field
        label={t.crmLeadStages.englishName}
        error={englishName.error}
        readOnly={isProtected}
        required
      >
        <Input
          value={form.nameEn}
          maxLength={80}
          readOnly={isProtected}
          {...englishName.fieldProps}
          onChange={(event) =>
            setForm((current) => ({ ...current, nameEn: event.target.value }))
          }
        />
      </Field>

      <Field
        label={t.crmLeadStages.flag}
        readOnly={isProtected}
        hint={isProtected ? t.crmLeadStages.protectedHint : t.crmLeadStages.flagChangeHint}
      >
        <Select
          value={form.flag}
          disabled={isProtected}
          onValueChange={(next) =>
            setForm((current) => ({ ...current, flag: next as LeadStageFlag }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectableFlags.map((flag) => (
              <SelectItem key={flag} value={flag}>
                {t.statusValues[`LeadStageFlag.${flag}`] ?? flag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmLeadStages.category}>
        <Select
          value={form.category}
          onValueChange={(next) =>
            setForm((current) => ({
              ...current,
              category: next as LeadStageCategory,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STAGE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {t.statusValues[`StageCategory.${category}`] ?? category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={t.common.status}
        readOnly={!canDeactivate}
        hint={canDeactivate ? undefined : t.crmLeadStages.cannotDeactivate}
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
