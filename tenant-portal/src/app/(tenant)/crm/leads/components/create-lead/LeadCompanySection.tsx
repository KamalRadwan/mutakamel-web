"use client";

import {
  Field,
  FormSection,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useLeadCompanyOptions } from "../../hooks/useLeadCompanyOptions";
import { LEAD_CREATE_LIMITS, type CreateLeadForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";

/** Sentinel for "create a new company", since a `Select` item needs a value. */
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

  return (
    <FormSection id="company" title={t.crmLeads.create.sections.company}>
      <Field label={t.crmLeads.existingCompany} className="md:col-span-2">
        <Select
          value={form.existingCompanyPartyId || NEW_COMPANY_VALUE}
          disabled={disabled || options.isLoadingCompanies}
          onValueChange={(value) => {
            const isNew = value === NEW_COMPANY_VALUE;
            const company = options.companies.find(({ id }) => id === value);
            onSelectCompany(isNew ? "" : value, company?.displayName ?? "");
            void options.selectCompany(isNew ? null : value);
          }}
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

      <Field
        label={t.crmLeads.companyName}
        error={errors.companyName}
        required
        // The name of a company chosen from the Directory is that Party's, and
        // nothing sent here would change it. readOnly rather than disabled: the
        // value still matters and still reads at full contrast.
        readOnly={existing}
        hint={existing ? t.crmLeads.create.existingCompanyLocked : undefined}
      >
        <Input
          value={form.companyName}
          maxLength={LEAD_CREATE_LIMITS.companyName}
          disabled={disabled}
          onChange={(event) => onFieldChange("companyName", event.target.value)}
          onBlur={() => onBlur("companyName")}
        />
      </Field>

      {!existing && (
        <>
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
