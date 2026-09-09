"use client";

import { Field, FormModal, FormSection, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { LeadAddressSection } from "../../components/create-lead/LeadAddressSection";
import type { LeadCompanyField } from "../../lead-write-contract";
import type { LeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import type { LeadCompanyModalState } from "../hooks/useLeadCompanyModal";
import { COMPANY_FIELDS, COMPANY_FIELD_LIMITS } from "../lead-company-modal-contract";

export function LeadCompanyEditModal({ state, edit, readOnly }: {
  state: LeadCompanyModalState;
  edit: LeadCompanyEdit;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const { form } = state;
  if (!form) return null;
  const disabled = state.saving || readOnly || edit.reconciliationRequired;
  const labels: Record<LeadCompanyField, string> = {
    companyName: t.crmLeads.companyName,
    taxNumber: t.crmLeads.create.taxNumber,
    commercialRegistrationNumber: t.crmLeads.create.commercialRegistrationNumber,
    companyEmail: t.crmLeadDetail.companyEmail,
    companyWebsite: t.crmLeadDetail.companyWebsite,
  };

  return (
    <FormModal
      open
      size="card"
      density="compact"
      onOpenChange={(open) => { if (!open) state.close(); }}
      title={t.crmLeadDetail.editCompany}
      isDirty={state.isDirty}
      isSubmitting={state.saving}
      submitDisabled={readOnly || edit.reconciliationRequired}
      onSubmit={() => void state.save()}
      error={edit.error ? describeError(edit.error) ?? t.crmLeadDetail.saveFailed : undefined}
      labels={{
        submit: t.crmLeadDetail.saveCompany,
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
      <FormSection id="company" title={t.crmLeadDetail.companyTitle} columns={2}>
        {COMPANY_FIELDS.map((field) => (
          <Field key={field} label={labels[field]} error={state.errors[field]} required={field === "companyName"}>
            <Input
              value={form[field]}
              dir={field === "companyName" ? undefined : "ltr"}
              maxLength={COMPANY_FIELD_LIMITS[field]}
              disabled={disabled}
              onChange={(event) => state.setField(field, event.target.value)}
            />
          </Field>
        ))}
        <CrmPhoneListField
          label={t.crmLeadDetail.companyPhones}
          phones={form.phones}
          path="companyPhones"
          errors={state.errors}
          disabled={disabled}
          onChange={state.setPhone}
          onAdd={state.addPhone}
          onRemove={state.removePhone}
          onBlur={() => {}}
        />
      </FormSection>
      {!state.canEditAddress && (
        <p className="text-xs text-muted-foreground">{t.crmLeadDetail.companyAddressTypeReadOnly}</p>
      )}
      {state.errors.address && <p role="alert" className="text-xs text-destructive">{state.errors.address}</p>}
      <LeadAddressSection
        address={form.address}
        errors={state.errors}
        disabled={disabled || !state.canEditAddress}
        onChange={state.setAddressField}
        onBlur={() => {}}
      />
    </FormModal>
  );
}
