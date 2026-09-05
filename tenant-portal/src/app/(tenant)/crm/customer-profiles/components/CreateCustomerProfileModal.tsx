"use client";

import { useMemo } from "react";
import {
  AmbiguousOutcomePanel,
  DegradedBanner,
  Field,
  FormModal,
  FormSection,
  Textarea,
  type FormModalSection,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../shared/hooks/useAmbiguousOutcomeLabels";
import type { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  isCorporateCustomerProfile,
} from "../customer-profile-create-contract";
import {
  customerProfileSectionErrorCount,
  type CustomerProfileSectionId,
} from "../customer-profile-create-validation";
import type { useCreateCustomerProfile } from "../hooks/useCreateCustomerProfile";
import { CustomerClassificationSection } from "./create-customer/CustomerClassificationSection";
import { CustomerCompanySection } from "./create-customer/CustomerCompanySection";
import { CustomerContactsSection } from "./create-customer/CustomerContactsSection";
import { CustomerPersonSection } from "./create-customer/CustomerPersonSection";

export interface CreateCustomerProfileModalProps {
  create: ReturnType<typeof useCreateCustomerProfile>;
  sources: AcquisitionSource[];
  sourcesDegraded: boolean;
  customFields: ReturnType<typeof useCrmCreateCustomFields>;
}

/**
 * Creating a customer profile, on the whole viewport.
 *
 * `CreateCustomerProfileDto` is nineteen keys plus a contacts array and the
 * tenant's own custom fields; the drawer this replaces sent eleven of them and
 * could not create a company's people at all. See
 * docs/design/patterns.md#formmodal for when this surface is the right one.
 *
 * There is no address section, and its absence is the contract rather than an
 * omission: this DTO has no address key, so sending one is a 400. An address is
 * added afterwards through the Core Directory.
 */
export function CreateCustomerProfileModal({
  create,
  sources,
  sourcesDegraded,
  customFields,
}: CreateCustomerProfileModalProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const { form, errors } = create;
  const corporate = isCorporateCustomerProfile(form);

  const visibleSections = useMemo<CustomerProfileSectionId[]>(() => {
    const sections: CustomerProfileSectionId[] = ["classification"];
    sections.push(corporate ? "company" : "person");
    if (corporate) sections.push("contacts");
    sections.push("notes");
    if (customFields.definitions.length > 0) sections.push("customFields");
    return sections;
  }, [corporate, customFields.definitions.length]);

  const indexEntries = useMemo<FormModalSection[]>(
    () =>
      visibleSections.map((section) => ({
        id: section,
        label: t.crmCustomerProfiles.create.sections[section],
        invalid: customerProfileSectionErrorCount(errors, section) > 0,
      })),
    [visibleSections, errors, t],
  );

  const errorCount = Object.keys(errors).length;

  return (
    <FormModal
      open={create.open}
      onOpenChange={(open) => {
        if (!open) create.closeModal();
      }}
      title={t.crmCustomerProfileActions.createTitle}
      isDirty={create.isDirty}
      isSubmitting={create.isSubmitting}
      onSubmit={() => void create.submit()}
      error={describeError(create.error) ?? undefined}
      sections={indexEntries}
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
      {create.ambiguity && (
        <AmbiguousOutcomePanel
          operation={t.crmCustomerProfileActions.createOperation}
          idempotencyKey={create.ambiguity.attempt.idempotencyKey}
          description={t.crmCustomerProfileActions.ambiguousDescription}
          correlationId={create.ambiguity.error.correlationId}
          onRetry={() => void create.ambiguity?.replay()}
          onDismiss={create.dismissAmbiguity}
          labels={ambiguousLabels}
        />
      )}

      {create.appliedUnreadable && (
        <AmbiguousOutcomePanel
          operation={t.crmCustomerProfileActions.createOperation}
          idempotencyKey={create.appliedUnreadable.attempt.idempotencyKey}
          description={t.crmShared.appliedUnreadableDescription}
          correlationId={create.appliedUnreadable.error.correlationId}
          onRetry={() => create.reconcile()}
          onDismiss={create.dismissAppliedUnreadable}
          labels={appliedLabels}
        />
      )}

      {sourcesDegraded && (
        <DegradedBanner message={t.crmLeads.create.sourcesUnavailable} />
      )}
      {customFields.degraded && (
        <DegradedBanner message={t.crmShared.customFieldsUnavailable} />
      )}

      <CustomerClassificationSection
        form={form}
        sources={sources}
        disabled={create.isSubmitting}
        onProfileTypeChange={create.setProfileType}
        onFieldChange={create.setField}
      />

      {corporate ? (
        <>
          <CustomerCompanySection
            form={form}
            errors={errors}
            disabled={create.isSubmitting}
            onFieldChange={create.setField}
            onPhoneChange={(index, value) => create.setPhone("companyPhones", index, value)}
            onPhoneAdd={() => create.addPhone("companyPhones")}
            onPhoneRemove={(index) => create.removePhone("companyPhones", index)}
            onBlur={create.touch}
          />
          <CustomerContactsSection
            form={form}
            errors={errors}
            disabled={create.isSubmitting}
            onContactChange={create.updateContact}
            onPrimaryChange={create.setContactPrimary}
            onAdd={create.addContact}
            onRemove={create.removeContact}
            onPhoneChange={create.setContactPhone}
            onPhoneAdd={create.addContactPhone}
            onPhoneRemove={create.removeContactPhone}
            onBlur={create.touch}
          />
        </>
      ) : (
        <CustomerPersonSection
          form={form}
          errors={errors}
          disabled={create.isSubmitting}
          onFieldChange={create.setField}
          onPhoneChange={(index, value) => create.setPhone("phones", index, value)}
          onPhoneAdd={() => create.addPhone("phones")}
          onPhoneRemove={(index) => create.removePhone("phones", index)}
          onBlur={create.touch}
        />
      )}

      <FormSection
        id="notes"
        title={t.crmCustomerProfiles.create.sections.notes}
        columns={1}
      >
        <Field
          label={t.crmLeads.create.description}
          error={errors.description}
          className="max-w-prose"
        >
          <Textarea
            rows={4}
            value={form.description}
            maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.description}
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("description", event.target.value)}
            onBlur={() => create.touch("description")}
          />
        </Field>
      </FormSection>

      {customFields.definitions.length > 0 && (
        <CrmCustomFieldsFormSection
          definitions={customFields.definitions}
          requiredFieldKeys={customFields.requiredFieldKeys}
          values={form.customFields}
          errors={errors}
          disabled={create.isSubmitting}
          onChange={create.setCustomField}
          onBlur={create.touch}
        />
      )}
    </FormModal>
  );
}
