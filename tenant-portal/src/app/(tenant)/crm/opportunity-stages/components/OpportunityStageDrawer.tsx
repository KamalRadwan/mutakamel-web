"use client";

import { ConfirmActionModal, Field, FormModal, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/design-system";
import { OPPORTUNITY_STAGE_FLAGS, type OpportunityStageDefinition } from "../../pipelines/pipeline-contract";
import { OPPORTUNITY_STAGE_NAME_MAX_LENGTH, type OpportunityStageFormInput } from "../opportunity-stage-contract";
import { useOpportunityStageForm } from "../hooks/useOpportunityStageForm";

interface OpportunityStageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: OpportunityStageDefinition | null;
  isSubmitting: boolean;
  error?: string;
  submitBlocked?: boolean;
  assigned?: boolean;
  recoveryActions?: React.ReactNode;
  onSubmit: (input: OpportunityStageFormInput) => void;
}

export function OpportunityStageDrawer({ open, onOpenChange, stage, isSubmitting, error, submitBlocked, assigned, recoveryActions, onSubmit }: OpportunityStageDrawerProps) {
  const state = useOpportunityStageForm(stage, onSubmit, assigned, open);
  const { t, form } = state;
  return (
    <><FormModal
      size="card"
      open={open}
      onOpenChange={onOpenChange}
      title={stage ? t.crmOpportunityStages.editTitle : t.crmOpportunityStages.createTitle}
      description={stage ? t.crmOpportunityStages.editDescription : t.crmOpportunityStages.createDescription}
      isDirty={state.isDirty && !isSubmitting}
      isSubmitting={isSubmitting}
      submitDisabled={submitBlocked || (stage !== null && !state.isDirty)}
      onSubmit={state.submit}
      error={state.validationMessage ?? error}
      footerLeading={recoveryActions}
      labels={{ submit: stage ? t.common.save : t.common.create, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm, discardCancel: t.crmOpportunityStages.keepEditing, sections: t.crmOpportunityStages.summaryTitle, sectionInvalid: t.crmOpportunityStages.validationSummary }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field showLabel label={t.crmOpportunityStages.nameAr} required error={state.nameArError} hint={state.count(form.nameAr)}>
            <Input dir="rtl" value={form.nameAr} maxLength={OPPORTUNITY_STAGE_NAME_MAX_LENGTH} readOnly={isSubmitting} onBlur={state.touchNameAr} onChange={(event) => state.changeNameAr(event.target.value)} />
          </Field>
          <Field showLabel label={t.crmOpportunityStages.nameEn} required error={state.nameEnError} hint={state.count(form.nameEn)}>
            <Input dir="ltr" value={form.nameEn} maxLength={OPPORTUNITY_STAGE_NAME_MAX_LENGTH} readOnly={isSubmitting} onBlur={state.touchNameEn} onChange={(event) => state.changeNameEn(event.target.value)} />
          </Field>
        </div>
        <Field showLabel label={t.crmOpportunityStages.flag} required readOnly={state.semanticsLocked} hint={stage?.isSystem ? t.crmOpportunityStages.systemStageHint : assigned ? t.crmOpportunityStages.inUseHint : undefined}>
          {state.semanticsLocked ? <Input readOnly value={t.statusValues[`OpportunityStageFlag.${form.flag}`]} /> : (
            <Select value={form.flag} onValueChange={state.changeFlag} disabled={isSubmitting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OPPORTUNITY_STAGE_FLAGS.map((flag) => <SelectItem key={flag} value={flag}>{t.statusValues[`OpportunityStageFlag.${flag}`]}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Field>
        <Field showLabel label={t.crmOpportunityStages.category} required readOnly={state.categories.length === 1} hint={t.crmOpportunityStages.categoryHint}>
          {state.categories.length === 1 ? <Input readOnly value={t.statusValues[`StageCategory.${form.category}`]} /> : (
            <Select value={form.category} onValueChange={state.changeCategory} disabled={isSubmitting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{state.categories.map((category) => <SelectItem key={category} value={category}>{t.statusValues[`StageCategory.${category}`]}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Field>
        {stage && <Field showLabel label={t.common.status} readOnly={state.semanticsLocked} hint={stage.isSystem ? t.crmOpportunityStages.systemStageHint : assigned ? t.crmOpportunityStages.inUseHint : t.crmOpportunityStages.assignmentHint}>
          {state.semanticsLocked ? <Input readOnly value={form.isActive ? t.common.active : t.common.inactive} /> : <div className="flex items-center gap-2"><Switch checked={form.isActive} disabled={isSubmitting} onCheckedChange={state.changeActive} /><span className="text-sm">{form.isActive ? t.common.active : t.common.inactive}</span></div>}
        </Field>}
      </div>
    </FormModal>
      <ConfirmActionModal open={state.navigationGuard.isDiscardOpen} onOpenChange={state.changeNavigationDiscard} title={t.common.discardTitle} description={t.common.discardDescription} confirmLabel={t.common.discardConfirm} cancelLabel={t.crmOpportunityStages.keepEditing} onConfirm={state.navigationGuard.confirmDiscard} />
    </>
  );
}
