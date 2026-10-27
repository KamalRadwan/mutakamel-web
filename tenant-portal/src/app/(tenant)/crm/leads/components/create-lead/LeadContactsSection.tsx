"use client";

import { useMemo } from "react";
import { Plus, Users } from "lucide-react";
import { Button, RadioGroup } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import type { LeadCompanyContactOption } from "../../lead-contract";
import {
  LEAD_CREATE_LIMITS,
  type CreateLeadForm,
  type LeadContactForm,
} from "../../lead-create-contract";
import { LeadContactRow } from "./LeadContactRow";
import { LeadFieldGuide } from "./LeadFieldGuide";

interface LeadContactsSectionProps {
  form: CreateLeadForm;
  directoryContacts: readonly LeadCompanyContactOption[];
  isLoadingContacts: boolean;
  errors: CrmFormErrors;
  disabled: boolean;
  onContactChange: (
    index: number,
    patch: Partial<Omit<LeadContactForm, "key">>,
  ) => void;
  onPrimaryChange: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPhoneChange: (index: number, phoneIndex: number, value: string) => void;
  onPhoneAdd: (index: number) => void;
  onPhoneRemove: (index: number, phoneIndex: number) => void;
  onBlur: (path: string) => void;
}

/**
 * Section 03 (Corporate Route) — Corporate Contact Persons (Sky-Blue Theme).
 *
 * Manages 1..20 contact persons at the corporate lead, with a single Primary
 * Contact radio group, directory contact linking when an existing company is
 * chosen, and interactive `!` field guides.
 */
export function LeadContactsSection({
  form,
  directoryContacts,
  isLoadingContacts,
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
}: LeadContactsSectionProps) {
  const { t } = useI18n();
  const limits = LEAD_CREATE_LIMITS;
  const existingCompany = form.existingCompanyPartyId.trim().length > 0;
  const canAdd = form.contacts.length < limits.contacts;

  const primaryKey = (
    form.contacts.find((contact) => contact.isPrimary) ?? form.contacts[0]
  )?.key;

  const takenContactPartyIds = useMemo(
    () =>
      new Set(
        form.contacts
          .map((contact) => contact.contactPartyId.trim())
          .filter((id) => id.length > 0),
      ),
    [form.contacts],
  );

  return (
    <section
      data-form-section="contacts"
      className="relative overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors"
    >
      {/* Top 3px accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-primary"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-foreground">
            <Users className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-foreground">
                03
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-semibold text-foreground outline-none"
              >
                {t.crmLeads.create.sections.contacts}
              </h3>
              <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                {form.contacts.length} / {limits.contacts}
              </span>
              <LeadFieldGuide field="contacts" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t.crmLeads.create.contactDetailsSubtitle}
            </p>
          </div>
        </div>

        {canAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onAdd}
            className="border-border/60 bg-muted/50 text-foreground hover:bg-muted"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t.crmLeads.create.addContact}
          </Button>
        )}
      </div>

      {/* Section Body */}
      <div className="space-y-3.5 p-4">
        {errors.contacts && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.contacts}
          </p>
        )}

        <RadioGroup
          value={primaryKey}
          aria-label={t.crmLeads.create.primaryContactGroup}
          onValueChange={(value) => {
            const index = form.contacts.findIndex(
              (contact) => contact.key === value,
            );
            if (index >= 0) onPrimaryChange(index);
          }}
          className="flex flex-col gap-3.5"
        >
          {form.contacts.map((contact, index) => (
            <LeadContactRow
              key={contact.key}
              index={index}
              contact={contact}
              isPrimary={contact.key === primaryKey}
              canRemove={form.contacts.length > 1}
              existingCompany={existingCompany}
              directoryContacts={directoryContacts}
              takenContactPartyIds={takenContactPartyIds}
              isLoadingContacts={isLoadingContacts}
              errors={errors}
              disabled={disabled}
              onChange={(patch) => onContactChange(index, patch)}
              onPhoneChange={(phoneIndex, value) =>
                onPhoneChange(index, phoneIndex, value)
              }
              onPhoneAdd={() => onPhoneAdd(index)}
              onPhoneRemove={(phoneIndex) => onPhoneRemove(index, phoneIndex)}
              onRemove={() => onRemove(index)}
              onBlur={onBlur}
            />
          ))}
        </RadioGroup>
      </div>
    </section>
  );
}
