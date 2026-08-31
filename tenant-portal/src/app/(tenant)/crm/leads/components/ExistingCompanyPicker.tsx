"use client";

import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useLeadCompanyOptions } from "../hooks/useLeadCompanyOptions";

/** Sentinel for "create a new company", since a `Select` item needs a value. */
const NEW_COMPANY_VALUE = "__new__";
/** Sentinel for "create a new contact person" on an existing company. */
const NEW_CONTACT_VALUE = "__new_contact__";

export interface ExistingCompanyPickerProps {
  options: ReturnType<typeof useLeadCompanyOptions>;
  existingCompanyPartyId: string;
  contactPartyId: string;
  disabled?: boolean;
  onCompanyChange: (companyPartyId: string, displayName: string) => void;
  onContactChange: (contactPartyId: string, displayName: string, email: string, phone: string) => void;
}

/**
 * Linking a corporate lead to an organization already in the Directory —
 * MASTER-PLAN 8.4.
 *
 * Two routes, in sequence: `/leads/company-options` for the branch's active
 * organizations, then `/leads/company-options/:companyPartyId/contacts` for the
 * people already attached to the one chosen. Picking a contact fills the name,
 * email and phone rather than making the user retype what the Directory already
 * holds — and sends `contactPartyId` so the backend reuses the existing person
 * instead of creating a duplicate.
 */
export function ExistingCompanyPicker({
  options,
  existingCompanyPartyId,
  contactPartyId,
  disabled,
  onCompanyChange,
  onContactChange,
}: ExistingCompanyPickerProps) {
  const { t } = useI18n();

  return (
    <>
      <Field
        label={t.crmLeads.existingCompany}
        hint={t.crmLeads.existingCompanyHint}
      >
        <Select
          value={existingCompanyPartyId || NEW_COMPANY_VALUE}
          onValueChange={(value) => {
            const isNew = value === NEW_COMPANY_VALUE;
            const company = options.companies.find(({ id }) => id === value);
            onCompanyChange(isNew ? "" : value, company?.displayName ?? "");
            void options.selectCompany(isNew ? null : value);
          }}
          disabled={disabled || options.isLoadingCompanies}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.crmLeads.newCompany} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW_COMPANY_VALUE}>{t.crmLeads.newCompany}</SelectItem>
            {options.companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {existingCompanyPartyId.length > 0 && (
        <Field
          label={t.crmLeads.existingContact}
          hint={t.crmLeads.existingContactHint}
        >
          <Select
            value={contactPartyId || NEW_CONTACT_VALUE}
            onValueChange={(value) => {
              if (value === NEW_CONTACT_VALUE) {
                onContactChange("", "", "", "");
                return;
              }
              const contact = options.contacts.find(
                ({ partyId }) => partyId === value,
              );
              onContactChange(
                value,
                contact?.displayName ?? "",
                contact?.primaryEmail ?? "",
                contact?.phones[0] ?? "",
              );
            }}
            disabled={disabled || options.isLoadingContacts}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.crmLeads.newContact} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_CONTACT_VALUE}>{t.crmLeads.newContact}</SelectItem>
              {options.contacts.map((contact) => (
                <SelectItem key={contact.partyId} value={contact.partyId}>
                  {contact.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  );
}
