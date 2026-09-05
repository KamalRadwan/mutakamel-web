"use client";

import { Plus } from "lucide-react";
import { Button, FormSection, RadioGroup } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { useLeadCompanyOptions } from "../../hooks/useLeadCompanyOptions";
import { LEAD_CREATE_LIMITS, type CreateLeadForm, type LeadContactForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import { LeadContactRow } from "./LeadContactRow";

export interface LeadContactsSectionProps {
  form: CreateLeadForm;
  errors: LeadCreateErrors;
  options: ReturnType<typeof useLeadCompanyOptions>;
  disabled: boolean;
  onContactChange: (index: number, patch: Partial<Omit<LeadContactForm, "key">>) => void;
  onPrimaryChange: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPhoneChange: (index: number, phoneIndex: number, value: string) => void;
  onPhoneAdd: (index: number) => void;
  onPhoneRemove: (index: number, phoneIndex: number) => void;
  onBlur: (path: string) => void;
}

/**
 * The people at a corporate lead — required, at least one, at most twenty.
 *
 * `assertCorporateLeadContacts` refuses a corporate lead with no contacts
 * (`422 LEAD_CONTACT_REQUIRED`), which is why the form opens with one empty row
 * that cannot be removed.
 *
 * Primary is a radio group across the rows rather than a checkbox per row:
 * `saveCorporateLeadContacts` throws `LEAD_CONTACT_PRIMARY_INVALID` on two
 * primaries and silently promotes row one on none, so "exactly one" is the
 * real rule and a radio is the control that says so.
 */
export function LeadContactsSection({
  form,
  errors,
  options,
  disabled,
  onContactChange,
  onPrimaryChange,
  onAdd,
  onRemove,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: LeadContactsSectionProps) {
  const { t } = useI18n();
  const canPickExisting = form.existingCompanyPartyId.length > 0;
  const primaryKey = (form.contacts.find((contact) => contact.isPrimary) ?? form.contacts[0])?.key;
  const canAdd = form.contacts.length < LEAD_CREATE_LIMITS.contacts;

  return (
    <FormSection
      id="contacts"
      title={t.crmLeads.create.sections.contacts}
      columns={1}
      action={
        canAdd ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
            <Plus className="size-3.5" aria-hidden="true" />
            {t.crmLeads.create.addContact}
          </Button>
        ) : undefined
      }
    >
      <RadioGroup
        value={primaryKey}
        aria-label={t.crmLeads.create.primaryContactGroup}
        onValueChange={(value) => {
          const index = form.contacts.findIndex((contact) => contact.key === value);
          if (index >= 0) onPrimaryChange(index);
        }}
        className="flex flex-col gap-3"
      >
        {form.contacts.map((contact, index) => (
          <LeadContactRow
            key={contact.key}
            contact={contact}
            index={index}
            errors={errors}
            contactOptions={options.contacts}
            canPickExisting={canPickExisting}
            isLoadingContacts={options.isLoadingContacts}
            canRemove={form.contacts.length > 1}
            disabled={disabled}
            onChange={onContactChange}
            onRemove={onRemove}
            onPhoneChange={onPhoneChange}
            onPhoneAdd={onPhoneAdd}
            onPhoneRemove={onPhoneRemove}
            onBlur={onBlur}
          />
        ))}
      </RadioGroup>
      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {formatTemplate(t.crmLeads.create.contactsLimit, { max: LEAD_CREATE_LIMITS.contacts })}
        </p>
      )}
    </FormSection>
  );
}
