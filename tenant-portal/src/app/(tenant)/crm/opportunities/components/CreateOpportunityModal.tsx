"use client";

import { Plus } from "lucide-react";
import { Button, ConfirmActionModal, DossierFormSurface } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CreateTagModal } from "../../leads/components/create-lead/CreateTagModal";
import type { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import type { OpportunityActionCapability, OpportunityPipeline } from "../hooks/pipeline-types";
import type { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { useOpportunityCreatePresentation } from "../hooks/useOpportunityCreatePresentation";
import { OpportunityCreateRecovery } from "./opportunity-form/OpportunityCreateRecovery";
import { OpportunityCreateTags } from "./opportunity-form/OpportunityCreateTags";
import { OpportunityFormCards } from "./opportunity-form/OpportunityFormCards";

export interface CreateOpportunityModalProps {
  create: ReturnType<typeof useCreateOpportunity>;
  pipelines: OpportunityPipeline[];
  branchId: string | null;
  branchLabel?: string;
  createCapability: OpportunityActionCapability | null;
  updateCapability: OpportunityActionCapability | null;
  customFields: ReturnType<typeof useCrmCreateCustomFields>;
}

/** Both presentations render one hook-owned draft; changing view never creates a record. */
export function CreateOpportunityModal(props: CreateOpportunityModalProps) {
  const { create, customFields } = props;
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const presentation = useOpportunityCreatePresentation(props);
  const disabled = create.isSubmitting || presentation.blocked;
  return <>
    <DossierFormSurface open={create.open} expanded={create.view === "full"} title={t.crmOpportunityDetail.createTitle}
      branchLabel={props.branchLabel} onExpandedChange={(expanded) => create.setView(expanded ? "full" : "fast")}
      onClose={presentation.requestClose} onSubmit={() => void presentation.submit(false)}
      isDirty={create.view === "full" ? false : create.isDirty} isSubmitting={create.isSubmitting} submitDisabled={presentation.blocked}
      error={describeError(create.error) ?? undefined}
      labels={{ compact: t.crmOpportunityDetail.form.fastCreate, expanded: t.crmOpportunityDetail.form.fullView,
        submit: t.crmOpportunityDetail.createOperation, cancel: t.common.cancel, close: t.common.close,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm }}
      footerLeading={<Button type="button" variant="outline" size="sm" disabled={disabled}
        onClick={() => void presentation.submit(true)}><Plus className="size-3.5" aria-hidden="true" />{t.crmOpportunities.createAndAddAnother}</Button>}>
      <OpportunityCreateRecovery create={create} />
      <OpportunityFormCards form={create.form} errors={create.errors} mode="create" view={create.view}
        onFieldChange={create.setField} onBlur={create.touch} disabled={disabled}
        lookups={presentation.lookups} defaultOwnerId={presentation.defaultOwnerId}
        customers={{ ...presentation.customers, selectedLabel: create.customerLabel,
          onSearch: presentation.customers.search, onSelect: create.selectCustomer }}
        pipelines={props.pipelines} selectableStages={create.selectableStages} onPipelineChange={create.selectPipeline}
        customFields={customFields} currencyOptions={presentation.currencyOptions}
        tagsSlot={<OpportunityCreateTags create={create} presentation={presentation} />} />
    </DossierFormSurface>
    <ConfirmActionModal open={presentation.navigationGuard.isDiscardOpen}
      onOpenChange={(open) => { if (!open) presentation.navigationGuard.cancelDiscard(); }}
      loading={create.isSubmitting || create.isRetryingTags} title={t.common.discardTitle}
      description={t.common.discardDescription} confirmLabel={t.common.discardConfirm} cancelLabel={t.common.cancel}
      onConfirm={presentation.navigationGuard.confirmDiscard} />
    <CreateTagModal open={presentation.tagDraftName !== null} initialName={presentation.tagDraftName ?? ""}
      existingTags={presentation.tags.items} onClose={() => presentation.setTagDraftName(null)} onSuccess={presentation.onTagCreated} />
  </>;
}

