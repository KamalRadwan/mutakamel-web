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

export interface LeadContactsSectionProps {
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
      className="relative overflow-hidden rounded-xl border border-sky-500/20 bg-card shadow-xs transition-colors dark:border-sky-400/20"
    >
      {/* Top 3px Sky-Blue accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-linear-to-r from-sky-500 via-blue-500 to-indigo-500"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-sky-500/[0.03] px-4 py-3 dark:bg-sky-500/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-300">
            <Users className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:bg-sky-500/20 dark:text-sky-300">
                03
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-bold text-foreground outline-none"
              >
                {t.crmLeads.create.sections.contacts}
              </h3>
              <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-700 dark:text-sky-300">
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
            className="border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-300"
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
