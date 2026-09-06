"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  FormSection,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmContactLine } from "../../../shared/components/CrmContactLine";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  type CreateCustomerProfileForm,
  type CustomerContactRowForm,
} from "../../customer-profile-create-contract";

export interface CustomerContactsSectionProps {
  form: CreateCustomerProfileForm;
  errors: CrmFormErrors;
  disabled: boolean;
  onContactChange: (index: number, patch: Partial<Omit<CustomerContactRowForm, "key">>) => void;
  onPrimaryChange: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPhoneChange: (index: number, phoneIndex: number, value: string) => void;
  onPhoneAdd: (index: number) => void;
  onPhoneRemove: (index: number, phoneIndex: number) => void;
  onBlur: (path: string) => void;
}

/**
 * The people at a corporate customer — optional, at most twenty.
 *
 * Unlike a lead, a corporate customer profile is legal with no contacts at all,
 * so the empty first row is a starting point rather than a requirement: the
 * builder simply drops any row with no name. A row that has an email or a
 * number but no name IS an error, because dropping that one would throw away
 * something the user typed.
 *
 * There is no "pick an existing person" control here, and that is a deliberate
 * absence rather than an omission: CRM exposes no endpoint listing selectable
 * person parties for a customer profile — only leads have one — and a reused
 * party ignores every submitted field except job title and the primary flag.
 * An existing person is attached afterwards through `POST /:id/contacts`.
 */
export function CustomerContactsSection({
  form,
  errors,
  disabled,
  onContactChange,
  onPrimaryChange,
  onAdd,
  onRemove,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: CustomerContactsSectionProps) {
  const { t } = useI18n();
  const limits = CUSTOMER_PROFILE_CREATE_LIMITS;
  const primaryKey = (form.contacts.find((contact) => contact.isPrimary) ?? form.contacts[0])
    ?.key;
  const canAdd = form.contacts.length < limits.contacts;

  return (
    <FormSection
      id="contacts"
      title={t.crmCustomerProfiles.create.sections.contacts}
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
        {form.contacts.map((contact, index) => {
          const path = `contacts.${index}`;
          const primaryId = `customer-contact-primary-${contact.key}`;
          return (
            <div
              key={contact.key}
              className="flex flex-col gap-3 rounded-md border border-border bg-card p-3"
            >
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
                  {form.contacts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      aria-label={formatTemplate(t.crmLeads.create.removeContact, {
                        number: index + 1,
                      })}
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>

              <CrmContactLine
                path={path}
                contact={contact}
                errors={errors}
                disabled={disabled}
                limits={{
                  name: limits.firstName,
                  jobTitle: limits.jobTitle,
                  email: limits.email,
                }}
                directoryNameLabel={t.crmLeads.contactName}
                onFieldChange={(patch) => onContactChange(index, patch)}
                onPhoneChange={(phoneIndex, value) => onPhoneChange(index, phoneIndex, value)}
                onPhoneAdd={() => onPhoneAdd(index)}
                onPhoneRemove={(phoneIndex) => onPhoneRemove(index, phoneIndex)}
                onBlur={onBlur}
              />
            </div>
          );
        })}
      </RadioGroup>
    </FormSection>
  );
}
