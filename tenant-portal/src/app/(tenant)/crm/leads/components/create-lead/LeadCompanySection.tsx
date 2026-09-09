"use client";

import { useMemo, useState } from "react";
import { Combobox, Field, FormSection, Input, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useLeadCompanyOptions } from "../../hooks/useLeadCompanyOptions";
import { LEAD_CREATE_LIMITS, type CreateLeadForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";

/** Sentinel for "create a new company", since a picker row needs a value. */
const NEW_COMPANY_VALUE = "__new__";

export interface LeadCompanySectionProps {
  form: CreateLeadForm;
  errors: LeadCreateErrors;
  options: ReturnType<typeof useLeadCompanyOptions>;
  disabled: boolean;
  onSelectCompany: (companyPartyId: string, displayName: string) => void;
  onFieldChange: <K extends "companyName" | "legalName" | "taxNumber" | "commercialRegistrationNumber">(
    key: K,
    value: string,
  ) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * The organization behind a corporate lead.
 *
 * Two mutually exclusive routes, and the picker is the switch between them.
 * Choosing a company already in the Directory reuses that Party — and
 * `assertCorporateLeadDetails` then REJECTS `legalName`, `taxNumber`,
 * `commercialRegistrationNumber`, `companyPhones` and the whole address block
 * with `422 LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN`. Those boxes are therefore
 * not rendered on that route rather than disabled: a disabled box implies the
 * value would apply if only it were editable here, and it never would.
 */
export function LeadCompanySection({
  form,
  errors,
  options,
  disabled,
  onSelectCompany,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: LeadCompanySectionProps) {
  const { t } = useI18n();
  const existing = form.existingCompanyPartyId.length > 0;
  const [query, setQuery] = useState("");

  const selectedCompany = options.companies.find(({ id }) => id === form.existingCompanyPartyId);

  // A branch's directory runs to hundreds of organizations and the route that
  // returns them takes a branch and nothing else — there is no query to send,
  // so the narrowing happens here. That is the same shape as the country
  // picker's, and the same reason the primitive's remote-list rule permits it:
  // the caller narrows before the popup ever sees the list. See
  // docs/design/primitives.md#combobox.
  const companyOptions = useMemo<ComboboxOption[]>(() => {
    const needle = query.trim().toLowerCase();
    // Both names in the haystack: people search for the company they deal with
    // and it is filed under the one on the tax card as often as not.
    const matches = options.companies.filter((company) => {
      if (needle.length === 0) return true;
      return [company.displayName, company.legalName, company.organizationName]
        .filter((name): name is string => Boolean(name))
        .some((name) => name.toLowerCase().includes(needle));
    });
    return [
      // Pinned, and deliberately not filtered with the rest: a search that
      // finds nothing is exactly when "New company" is the answer, and making
      // the user clear the box to reach it would be the wrong way round.
      { value: NEW_COMPANY_VALUE, label: t.crmLeads.newCompany },
      ...matches.map((company) => ({
        value: company.id,
        label: company.displayName,
        // Only when it says something the label does not.
        description:
          company.legalName && company.legalName !== company.displayName
            ? company.legalName
            : undefined,
      })),
    ];
  }, [options.companies, query, t]);

  return (
    <FormSection id="company" title={t.crmLeads.create.sections.company}>
      <Field label={t.crmLeads.existingCompany} className="md:col-span-2">
        <Combobox
          value={form.existingCompanyPartyId || NEW_COMPANY_VALUE}
          // The trigger's own text. A selected company can drop out of the
          // narrowed list the moment the next query is typed, and the trigger
          // would then be left rendering a bare id.
          selectedLabel={existing ? selectedCompany?.displayName ?? form.companyName : t.crmLeads.newCompany}
          options={companyOptions}
          onSearch={setQuery}
          // The list is already here — nothing to wait for between the
          // keystroke and the answer.
          debounceMs={0}
          loading={options.isLoadingCompanies}
          disabled={disabled || options.isLoadingCompanies}
          onValueChange={(value) => {
            // `undefined` is the clear control: no company is the new-company
            // route, which is where this field starts.
            const isNew = value === undefined || value === NEW_COMPANY_VALUE;
            const company = options.companies.find(({ id }) => id === value);
            onSelectCompany(isNew ? "" : (value ?? ""), company?.displayName ?? "");
            void options.selectCompany(isNew ? null : (value ?? null));
            setQuery("");
          }}
          placeholder={t.crmLeads.newCompany}
          searchPlaceholder={t.crmShared.searchCompanies}
          loadingLabel={t.common.loading}
          emptyLabel={t.crmShared.noMatchingCompanies}
        />
      </Field>

      {!existing && (
        <>
          {/* Only on the new-company route. A company chosen from the Directory
              is already named by the picker above, and this box repeated that
              name back read-only with a note saying it could not be edited —
              a second copy of an answer the user had just given, plus a
              sentence explaining why it was useless. The VALUE is still in the
              form: `onSelectCompany` writes the chosen party's display name, so
              `companyName` is still what validation checks and what the request
              carries. Only the box is gone. */}
          <Field label={t.crmLeads.companyName} error={errors.companyName} required>
            <Input
              value={form.companyName}
              maxLength={LEAD_CREATE_LIMITS.companyName}
              disabled={disabled}
              onChange={(event) => onFieldChange("companyName", event.target.value)}
              onBlur={() => onBlur("companyName")}
            />
          </Field>

          <Field label={t.crmLeads.create.legalName} error={errors.legalName}>
            <Input
              value={form.legalName}
              maxLength={LEAD_CREATE_LIMITS.legalName}
              disabled={disabled}
              onChange={(event) => onFieldChange("legalName", event.target.value)}
              onBlur={() => onBlur("legalName")}
            />
          </Field>

          {/* Directly under the legal name: together they are how a person
              identifies and reaches one organization, and the registration
              numbers below are a filing detail nobody reads them alongside.
              Spans the row because each phone row carries its own add and
              remove controls beside the input. */}
          <div className="md:col-span-2">
            <CrmPhoneListField
              label={t.crmLeads.create.companyPhones}
              phones={form.companyPhones}
              path="companyPhones"
              errors={errors}
              disabled={disabled}
              onChange={onPhoneChange}
              onAdd={onPhoneAdd}
              onRemove={onPhoneRemove}
              onBlur={onBlur}
            />
          </div>

          <Field label={t.crmLeads.create.taxNumber} error={errors.taxNumber}>
            <Input
              dir="ltr"
              value={form.taxNumber}
              maxLength={LEAD_CREATE_LIMITS.taxNumber}
              disabled={disabled}
              onChange={(event) => onFieldChange("taxNumber", event.target.value)}
              onBlur={() => onBlur("taxNumber")}
            />
          </Field>

          <Field
            label={t.crmLeads.create.commercialRegistrationNumber}
            error={errors.commercialRegistrationNumber}
          >
            <Input
              dir="ltr"
              value={form.commercialRegistrationNumber}
              maxLength={LEAD_CREATE_LIMITS.commercialRegistrationNumber}
              disabled={disabled}
              onChange={(event) =>
                onFieldChange("commercialRegistrationNumber", event.target.value)
              }
              onBlur={() => onBlur("commercialRegistrationNumber")}
            />
          </Field>
        </>
      )}
    </FormSection>
  );
}
