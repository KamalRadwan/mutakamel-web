"use client";

import { useMemo, useState } from "react";
import { DegradedBanner, FormModal, type FormModalSection } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { resolveCompanyForBranch } from "@/lib/api/organization-scope";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { useCrmFieldMessages } from "../../shared/hooks/useCrmFieldMessages";
import { useCreateLeadForm } from "../hooks/useCreateLeadForm";
import { useCreateLeadTags } from "../hooks/useCreateLeadTags";
import { useLeadCompanyOptions } from "../hooks/useLeadCompanyOptions";
import { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import type { LeadStage } from "../hooks/useLeads";
import { isCorporateLead, usesExistingCompany, type CreateLeadForm } from "../lead-create-contract";
import {
  leadCreateSectionErrorCount,
  type LeadCreateSectionId,
} from "../lead-create-validation";
import { LeadAddressSection } from "./create-lead/LeadAddressSection";
import { LeadClassificationSection } from "./create-lead/LeadClassificationSection";
import { LeadCompanySection } from "./create-lead/LeadCompanySection";
import { LeadContactsSection } from "./create-lead/LeadContactsSection";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import { LeadPersonSection } from "./create-lead/LeadPersonSection";
import { LeadQualificationSection } from "./create-lead/LeadQualificationSection";

export interface CreateLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: LeadStage[];
  branchId: string | null;
  /**
   * Seeds the stage field — the board's `+` answers "which stage" by the column
   * it was pressed in. Read once, when the form is created, so the caller keys
   * this modal by the stage: a seed reapplied on every render would overwrite a
   * stage the user had since changed by hand.
   */
  initialStageId?: string;
  onSubmit: (form: CreateLeadForm) => Promise<boolean>;
  error: string | null;
}

/**
 * Creating a lead, on the whole viewport.
 *
 * `CreateLeadDto` is two dozen keys plus a contacts array, an address block and
 * the tenant's own custom fields; a 448px drawer could show a fifth of it,
 * which is why the previous version of this screen sent five fields and let the
 * server default or silently drop the rest. The modal is the surface that fits
 * the record, and the section index is what keeps it navigable — see
 * docs/design/patterns.md#formmodal.
 *
 * Which sections exist is decided by the lead's profile type and by whether it
 * reuses a Directory company, because the server decides the same way: the
 * registration fields are a 422 on an individual lead, the person fields are
 * silently dropped on a corporate one, and the registration, phone and address
 * blocks are all refused alongside an `existingCompanyPartyId`.
 */
export function CreateLeadsModal({
  isOpen,
  onClose,
  onSubmit,
  stages,
  branchId,
  initialStageId,
  error,
}: CreateLeadsModalProps) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const companyOptions = useLeadCompanyOptions(branchId, isOpen);
  const acquisitionSources = useCrmAcquisitionSources();
  const customFields = useCrmCreateCustomFields("LEAD", isOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickedCompanyId, setPickedCompanyId] = useState<string | null>(null);

  const fieldMessages = useCrmFieldMessages();
  const messages = useMemo(
    () => ({
      ...fieldMessages,
      contactRequired: t.crmLeads.create.errors.contactRequired,
      tagsLimit: t.crmLeads.create.errors.tagsLimit,
      tagsInvalid: t.crmLeads.create.errors.tagsInvalid,
    }),
    [fieldMessages, t],
  );
  const state = useCreateLeadForm(messages, customFields.requiredFieldKeys, initialStageId);
  const { form, errors, allErrors } = state;

  const corporate = isCorporateLead(form);
  const existingCompany = usesExistingCompany(form);

  // Every branch this account may file into, paired with the company that owns
  // it. `/auth/me` is the only proven source for either — `accessibleBranches`
  // and the `accessibleBranchCompanies` ownership map on `TenantUserProfile`
  // (src/context/AuthContext.tsx:65-68). `resolveCompanyForBranch` is reused
  // rather than reading the map here because it is the SAME authority the
  // Gateway scope headers are built from: two readings of one map is how the
  // picker and the request end up disagreeing about who owns a branch.
  const branchOwners = useMemo(() => {
    const ids = [...new Set((user?.accessibleBranches ?? []).filter(isUUIDv7))];
    return ids.map((id) => ({ branchId: id, companyId: resolveCompanyForBranch(user, id) }));
  }, [user]);

  // Companies drop out when ownership cannot be established — an older Core
  // response with no map at all, or team memberships that pair one branch with
  // two companies. Guessing there would pair a lead with the wrong company.
  const companyIds = useMemo(
    () => [
      ...new Set(
        branchOwners
          .map(({ companyId }) => companyId)
          .filter((companyId): companyId is string => companyId !== null),
      ),
    ],
    [branchOwners],
  );

  // Empty `form.branchId` means the branch the list screen is on — see
  // `buildCreateLeadRequest`.
  const activeBranchId = form.branchId || branchId || "";
  const leadTags = useCreateLeadTags(isOpen);
  const companyId =
    pickedCompanyId && companyIds.includes(pickedCompanyId)
      ? pickedCompanyId
      : (branchOwners.find((pair) => pair.branchId === activeBranchId)?.companyId ?? null);

  // With no resolvable company the list is every accessible branch rather than
  // none: the company is a filter over branches, and a filter that cannot be
  // evaluated must not hide the thing it filters.
  const branchIds = useMemo(
    () =>
      branchOwners
        .filter((pair) => companyId === null || pair.companyId === companyId)
        .map((pair) => pair.branchId),
    [branchOwners, companyId],
  );

  // Storing the screen's own branch would mark the form dirty for a pick that
  // changed nothing, and the close guard would then ask about edits that do
  // not exist.
  //
  // A different branch is stored explicitly so `buildCreateLeadRequest` files
  // the lead there and the response parser validates against that same branch.
  function chooseBranch(next: string) {
    state.setField("branchId", next === branchId ? "" : next);
  }

  // The company is not sent anywhere; it only narrows the list above. Moving to
  // a company that does not own the active branch has to move the branch too,
  // or the branch picker would show a value none of its options carries.
  function chooseCompany(next: string) {
    setPickedCompanyId(next);
    const owned = branchOwners.filter((pair) => pair.companyId === next);
    if (!owned.some((pair) => pair.branchId === activeBranchId)) {
      chooseBranch(owned[0]?.branchId ?? "");
    }
  }

  const visibleSections = useMemo<LeadCreateSectionId[]>(() => {
    const sections: LeadCreateSectionId[] = ["classification"];
    if (corporate) sections.push("company", "contacts");
    else sections.push("person");
    if (!existingCompany) sections.push("address");
    sections.push("qualification");
    if (customFields.definitions.length > 0) sections.push("customFields");
    return sections;
  }, [corporate, existingCompany, customFields.definitions.length]);

  const indexEntries = useMemo<FormModalSection[]>(
    () =>
      visibleSections.map((section) => {
        const count = leadCreateSectionErrorCount(errors, section);
        return {
          id: section,
          label: t.crmLeads.create.sections[section],
          invalid: count > 0,
          hint: undefined,
        };
      }),
    [visibleSections, errors, t],
  );

  async function handleSubmit() {
    // Every field speaks now, including the ones never focused. Submit is NOT
    // disabled while the form is invalid: a disabled button gives a keyboard
    // user no way to ask what is wrong, so the press is what reveals it.
    state.revealAll();
    if (Object.keys(allErrors).length > 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (await onSubmit(form)) {
        state.reset();
        setPickedCompanyId(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        state.reset();
        companyOptions.reset();
        setPickedCompanyId(null);
        onClose();
      }}
      title={t.crmLeads.addTitle}
      isDirty={state.isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
      error={error ?? undefined}
      sections={indexEntries}
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
        errorCount > 0 ? (
          // role="status", not "alert": the count updates as the user fixes
          // fields, and an assertive re-announcement on every keystroke would
          // talk over the field they are typing in.
          <p role="status" className="text-xs text-destructive">
            {formatTemplate(t.crmShared.formErrorCount, { count: errorCount })}
          </p>
        ) : undefined
      }
    >
      {acquisitionSources.degraded && (
        <DegradedBanner message={t.crmLeads.create.sourcesUnavailable} />
      )}
      {customFields.degraded && (
        <DegradedBanner message={t.crmShared.customFieldsUnavailable} />
      )}
      {(leadTags.degraded || (!leadTags.canRead && form.tagIds.length > 0)) && (
        <DegradedBanner message={t.crmLeads.create.tagsUnavailable} />
      )}

      <LeadClassificationSection
        companyIds={companyIds}
        companyId={companyId}
        branchIds={branchIds}
        branchId={activeBranchId}
        leadProfileType={form.leadProfileType}
        stageId={form.stageId}
        acquisitionSourceId={form.acquisitionSourceId}
        tagIds={form.tagIds}
        stages={stages}
        sources={acquisitionSources.items}
        tags={leadTags.items}
        showTags={leadTags.canRead || form.tagIds.length > 0}
        tagsLoading={leadTags.isLoading}
        tagsUnavailable={leadTags.degraded || !leadTags.canRead}
        errors={errors}
        disabled={isSubmitting}
        onCompanyChange={chooseCompany}
        onBranchChange={chooseBranch}
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

      {corporate ? (
        <>
          <LeadCompanySection
            form={form}
            errors={errors}
            options={companyOptions}
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
            options={companyOptions}
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

      {!existingCompany && (
        <LeadAddressSection
          address={form.address}
          errors={errors}
          disabled={isSubmitting}
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

      {customFields.definitions.length > 0 && (
        <CrmCustomFieldsFormSection
          definitions={customFields.definitions}
          requiredFieldKeys={customFields.requiredFieldKeys}
          values={form.customFields}
          errors={errors}
          disabled={isSubmitting}
          onChange={state.setCustomField}
          onBlur={state.touch}
        />
      )}
    </FormModal>
  );
}
