"use client";

import { Field, FormSection, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  type CreateCustomerProfileForm,
} from "../../customer-profile-create-contract";

type CompanyField =
  | "companyName"
  | "taxNumber"
  | "commercialRegistrationNumber"
  | "companyEmail"
  | "companyWebsite";

export interface CustomerCompanySectionProps {
  form: CreateCustomerProfileForm;
  errors: CrmFormErrors;
  disabled: boolean;
  onFieldChange: (key: CompanyField, value: string) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * The organization behind a corporate customer.
 *
 * Rendered only for `CORPORATE`: `assertCorporateOnlyFields` answers every one
 * of these keys on an individual profile with
 * `422 CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN`.
 *
 * The DTO's legacy aliases — `taxCardNumber` and `commercialRegisterNumber` —
 * are deliberately not offered. Each collapses onto the same `parties` column
 * as its modern name, with the modern one winning, so two boxes would write one
 * value and one of them would silently lose.
 */
export function CustomerCompanySection({
  form,
  errors,
  disabled,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: CustomerCompanySectionProps) {
  const { t } = useI18n();
  const limits = CUSTOMER_PROFILE_CREATE_LIMITS;

  return (
    <FormSection id="company" title={t.crmCustomerProfiles.create.sections.company}>
      <Field
        label={t.crmLeads.companyName}
        hint={t.crmCustomerProfiles.create.companyNameHint}
        error={errors.companyName}
      >
        <Input
          value={form.companyName}
          maxLength={limits.companyName}
          disabled={disabled}
          onChange={(event) => onFieldChange("companyName", event.target.value)}
          onBlur={() => onBlur("companyName")}
        />
      </Field>

      <Field label={t.crmLeads.create.taxNumber} error={errors.taxNumber}>
        <Input
          dir="ltr"
          value={form.taxNumber}
          maxLength={limits.taxNumber}
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
          maxLength={limits.commercialRegistrationNumber}
          disabled={disabled}
          onChange={(event) =>
            onFieldChange("commercialRegistrationNumber", event.target.value)
          }
          onBlur={() => onBlur("commercialRegistrationNumber")}
        />
      </Field>

      <Field label={t.crmCustomerProfiles.create.companyEmail} error={errors.companyEmail}>
        <Input
          type="email"
          dir="ltr"
          value={form.companyEmail}
          maxLength={limits.email}
          disabled={disabled}
          onChange={(event) => onFieldChange("companyEmail", event.target.value)}
          onBlur={() => onBlur("companyEmail")}
        />
      </Field>

      <Field
        label={t.crmCustomerProfiles.create.companyWebsite}
        // `@IsUrl({ require_protocol: true })` — a bare host is a 400, so the
        // hint says so before the user finds out from a failed save.
        hint={t.crmCustomerProfiles.create.companyWebsiteHint}
        error={errors.companyWebsite}
      >
        <Input
          type="url"
          dir="ltr"
          value={form.companyWebsite}
          maxLength={limits.website}
          disabled={disabled}
          onChange={(event) => onFieldChange("companyWebsite", event.target.value)}
          onBlur={() => onBlur("companyWebsite")}
        />
      </Field>

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
    </FormSection>
  );
}
