"use client";

import { Trash2 } from "lucide-react";
import {
  Button,
  Field,
  Label,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { LeadCompanyContactOption } from "../../lead-contract";
import { LEAD_CREATE_LIMITS, type LeadContactForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import { CrmContactLine } from "../../../shared/components/CrmContactLine";

/** Sentinel for "create a new contact person", since a `Select` item needs a value. */
const NEW_CONTACT_VALUE = "__new_contact__";

export interface LeadContactRowProps {
  contact: LeadContactForm;
  index: number;
  errors: LeadCreateErrors;
  /** Directory people on the chosen company. Empty when the company is new. */
  contactOptions: LeadCompanyContactOption[];
  /** A company was picked from the Directory, so its people can be reused. */
  canPickExisting: boolean;
  isLoadingContacts: boolean;
  canRemove: boolean;
  disabled: boolean;
  onChange: (index: number, patch: Partial<Omit<LeadContactForm, "key">>) => void;
  onRemove: (index: number) => void;
  onPhoneChange: (index: number, phoneIndex: number, value: string) => void;
  onPhoneAdd: (index: number) => void;
  onPhoneRemove: (index: number, phoneIndex: number) => void;
  onBlur: (path: string) => void;
}

/**
 * One `contacts[]` entry.
 *
 * When the person is picked from the Directory, `ensureCorporateContactsBatch`
 * builds no contact methods for them — the submitted name, email and phones are
 * discarded and the stored Party wins. Those boxes are therefore `readOnly`
 * here, showing what WILL be used at full contrast, with only job title and the
 * primary flag left editable. That is the whole of what the server still
 * applies to an existing contact.
 */
export function LeadContactRow({
  contact,
  index,
  errors,
  contactOptions,
  canPickExisting,
  isLoadingContacts,
  canRemove,
  disabled,
  onChange,
  onRemove,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: LeadContactRowProps) {
  const { t } = useI18n();
  const path = `contacts.${index}`;
  const fromDirectory = contact.contactPartyId.length > 0;
  const primaryId = `lead-contact-primary-${contact.key}`;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {formatTemplate(t.crmLeads.create.contactHeading, { number: index + 1 })}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value={contact.key} id={primaryId} disabled={disabled} />
            <Label htmlFor={primaryId} className="text-xs font-normal">
              {t.crmLeads.create.primaryContact}
            </Label>
          </div>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={formatTemplate(t.crmLeads.create.removeContact, { number: index + 1 })}
              onClick={() => onRemove(index)}
            >
              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {canPickExisting && (
          <Field label={t.crmLeads.existingContact} className="md:col-span-2">
            <Select
              value={contact.contactPartyId || NEW_CONTACT_VALUE}
              disabled={disabled || isLoadingContacts}
              onValueChange={(value) => {
                if (value === NEW_CONTACT_VALUE) {
                  onChange(index, { contactPartyId: "", fullName: "", email: "", phones: [""] });
                  return;
                }
                const picked = contactOptions.find((option) => option.partyId === value);
                onChange(index, {
                  contactPartyId: value,
                  fullName: picked?.displayName ?? "",
                  email: picked?.primaryEmail ?? "",
                  phones: picked && picked.phones.length > 0 ? [...picked.phones] : [""],
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmLeads.newContact} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CONTACT_VALUE}>{t.crmLeads.newContact}</SelectItem>
                {contactOptions.map((option) => (
                  <SelectItem key={option.partyId} value={option.partyId}>
                    {option.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <CrmContactLine
          path={path}
          contact={contact}
          errors={errors}
          disabled={disabled}
          limits={{
            name: LEAD_CREATE_LIMITS.firstName,
            jobTitle: LEAD_CREATE_LIMITS.jobTitle,
            email: LEAD_CREATE_LIMITS.email,
          }}
          directoryNameLabel={t.crmLeads.contactName}
          directoryOwned={fromDirectory}
          identityHint={fromDirectory ? t.crmLeads.create.existingContactLocked : undefined}
          onFieldChange={(patch) => onChange(index, patch)}
          onPhoneChange={(phoneIndex, value) => onPhoneChange(index, phoneIndex, value)}
          onPhoneAdd={() => onPhoneAdd(index)}
          onPhoneRemove={(phoneIndex) => onPhoneRemove(index, phoneIndex)}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
}
