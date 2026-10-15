"use client";

import { DegradedBanner, FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import { useCreateLeadModal } from "../hooks/useCreateLeadModal";
import type { LeadStage } from "../hooks/useLeads";
import type { CreateLeadForm, QuickCreateLeadDraft } from "../lead-create-contract";
import { CreateTagModal } from "./create-lead/CreateTagModal";
import { LeadAddressSection } from "./create-lead/LeadAddressSection";
import { LeadClassificationSection } from "./create-lead/LeadClassificationSection";
import { LeadCompanySection } from "./create-lead/LeadCompanySection";
import { LeadContactsSection } from "./create-lead/LeadContactsSection";
import { LeadDuplicateWarnings } from "./create-lead/LeadDuplicateWarnings";
import { LeadPersonSection } from "./create-lead/LeadPersonSection";
import { LeadQualificationSection } from "./create-lead/LeadQualificationSection";

export interface CreateLeadsModalProps {
  onClose: () => void;
  stages: LeadStage[];
  branchId: string | null;
  /**
   * Seeds the stage field — the board's `+` answers "which stage" by the column
   * it was pressed in. Read once, when the form is created; the page mounts the
   * modal per opening, so a seed is never reapplied over a stage the user
   * changed by hand.
   */
  initialStageId?: string;
  /** What the board's quick-add card had typed when its user asked for the full form. */
  initialDraft?: QuickCreateLeadDraft | null;
  onSubmit: (form: CreateLeadForm) => Promise<boolean>;
  error: string | null;
}

/**
 * Creating a lead, on the whole viewport.
 *
 * `CreateLeadDto` is two dozen keys plus a contacts array, an address block and
 * the tenant's own custom fields; the modal is the surface that fits the
 * record, and the section index keeps it navigable — see
 * docs/design/patterns.md#formmodal.
 *
 * Which sections exist is decided by the lead's profile type and by whether it
 * reuses a Directory company, because the server decides the same way: the
 * registration fields are a 422 on an individual lead, the person fields are
 * silently dropped on a corporate one, and the registration, phone and address
 * blocks are all refused alongside an `existingCompanyPartyId`.
 */
export function CreateLeadsModal({
  onClose,
  onSubmit,
  stages,
  branchId,
  initialStageId,
  initialDraft,
  error,
}: CreateLeadsModalProps) {
  const { t } = useI18n();
  const modal = useCreateLeadModal({ branchId, initialStageId, initialDraft, onSubmit });
  const { state, isSubmitting, leadTags } = modal;
  const { form, errors } = state;

  return (
    <>
      <FormModal
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={t.crmLeads.addTitle}
        density="compact"
        isDirty={state.isDirty}
        isSubmitting={isSubmitting}
        onSubmit={() => void modal.submit()}
        error={error ?? undefined}
        sidebarHeader={
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">
            {t.crmLeads.create.sidebarTitle}
          </span>
        }
        sectionVariant="stepper"
        sections={modal.sections}
        labels={{
          submit: isSubmitting ? t.crmLeads.creating : t.common.create,
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
          modal.errorCount > 0 ? (
            // role="status", not "alert": the count updates as the user fixes
            // fields, and an assertive re-announcement on every keystroke would
            // talk over the field they are typing in.
            <p role="status" className="text-xs text-destructive">
              {formatTemplate(t.crmShared.formErrorCount, { count: modal.errorCount })}
            </p>
          ) : undefined
        }
      >
        <LeadDuplicateWarnings
          companyMatch={modal.companyMatch}
          onUseCompany={modal.adoptMatchedCompany}
          matches={modal.serverDuplicates}
          disabled={isSubmitting}
        />

        {modal.sources.degraded && <DegradedBanner message={t.crmLeads.create.sourcesUnavailable} />}
        {modal.customFields.degraded && <DegradedBanner message={t.crmShared.customFieldsUnavailable} />}
        {(leadTags.degraded || (!leadTags.canRead && form.tagIds.length > 0)) && (
          <DegradedBanner message={t.crmLeads.create.tagsUnavailable} />
        )}

        <LeadClassificationSection
          companyIds={modal.companyIds}
          companyId={modal.companyId}
          branchIds={modal.branchIds}
          branchId={modal.activeBranchId}
          leadProfileType={form.leadProfileType}
          stageId={form.stageId}
          acquisitionSourceId={form.acquisitionSourceId}
          tagIds={form.tagIds}
          stages={stages}
          sources={modal.sources.items}
          tags={leadTags.items}
          showTags={leadTags.canRead || form.tagIds.length > 0}
          tagsLoading={leadTags.isLoading}
          tagsUnavailable={leadTags.degraded || !leadTags.canRead}
          canCreateTag={leadTags.canManage}
          onCreateTag={leadTags.canManage ? modal.openCreateTag : undefined}
          errors={errors}
          disabled={isSubmitting}
          onCompanyChange={modal.chooseCompany}
          onBranchChange={modal.chooseBranch}
          onProfileTypeChange={state.setProfileType}
          onStageChange={(stageId) => state.setField("stageId", stageId)}
          onSourceChange={(sourceId) => {
            state.setField("acquisitionSourceId", sourceId);
            // A select has no blur the user would recognise as "done with this
            // field", so the pick itself is what lets its error speak.
            state.touch("acquisitionSourceId");
          }}
          onTagsChange={(tagIds) => state.setField("tagIds", tagIds)}
          onTagsBlur={() => state.touch("tagIds")}
        />

        {modal.corporate ? (
          <>
            <LeadCompanySection
              form={form}
              errors={errors}
              options={modal.companyOptions}
              disabled={isSubmitting}
              onSelectCompany={state.selectCompany}
              onFieldChange={state.setField}
              onPhoneChange={(index, value) => state.setPhone("companyPhones", index, value)}
              onPhoneAdd={() => state.addPhone("companyPhones")}
              onPhoneRemove={(index) => state.removePhone("companyPhones", index)}
              onBlur={state.touch}
            />
            <LeadContactsSection
              form={form}
              errors={errors}
              options={modal.companyOptions}
              disabled={isSubmitting}
              onContactChange={state.updateContact}
              onPrimaryChange={state.setContactPrimary}
              onAdd={state.addContact}
              onRemove={state.removeContact}
              onPhoneChange={state.setContactPhone}
              onPhoneAdd={state.addContactPhone}
              onPhoneRemove={state.removeContactPhone}
              onBlur={state.touch}
            />
          </>
        ) : (
          <LeadPersonSection
            form={form}
            errors={errors}
            disabled={isSubmitting}
            onFieldChange={state.setField}
            onPhoneChange={(index, value) => state.setPhone("phones", index, value)}
            onPhoneAdd={() => state.addPhone("phones")}
            onPhoneRemove={(index) => state.removePhone("phones", index)}
            onBlur={state.touch}
          />
        )}

        {!modal.existingCompany && (
          <LeadAddressSection
            address={form.address}
            errors={errors}
            disabled={isSubmitting}
            defaultOpen={false}
            onChange={state.setAddressField}
            onBlur={state.touch}
          />
        )}

        <LeadQualificationSection
          form={form}
          errors={errors}
          disabled={isSubmitting}
          onChange={state.setField}
          onBlur={state.touch}
        />

        {modal.customFields.definitions.length > 0 && (
          <CrmCustomFieldsFormSection
            definitions={modal.customFields.definitions}
            requiredFieldKeys={modal.customFields.requiredFieldKeys}
            values={form.customFields}
            errors={errors}
            disabled={isSubmitting}
            onChange={state.setCustomField}
            onBlur={state.touch}
          />
        )}
      </FormModal>
      {leadTags.canManage && (
        <CreateTagModal
          open={modal.createTag.open}
          initialName={modal.createTag.initialName}
          existingTags={leadTags.items}
          onSuccess={modal.handleTagCreated}
          onClose={modal.closeCreateTag}
        />
      )}
    </>
  );
}
