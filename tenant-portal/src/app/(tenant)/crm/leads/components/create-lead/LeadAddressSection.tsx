"use client";

import { Field, FormSection, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { LEAD_CREATE_LIMITS, type LeadAddressForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import { CrmCountrySelect } from "../../../shared/components/CrmCountrySelect";

export interface LeadAddressSectionProps {
  address: LeadAddressForm;
  errors: LeadCreateErrors;
  disabled: boolean;
  onChange: (key: keyof LeadAddressForm, value: string) => void;
  onBlur: (path: string) => void;
}

/**
 * The lead's `LEGAL` primary address on its Party.
 *
 * The DTO also accepts `area`, `street` and `apartment`, and none of them is
 * offered: `leadPartyAddresses` maps `state -> area`, `street1 -> street` and
 * `street2 -> apartment`, with the modern spelling winning. Rendering both
 * would be two boxes writing one column, one of which silently loses.
 *
 * A block where every box is blank sends no address at all, so there is
 * nothing to opt out of.
 */
export function LeadAddressSection({
  address,
  errors,
  disabled,
  onChange,
  onBlur,
}: LeadAddressSectionProps) {
  const { t } = useI18n();
  const limits = LEAD_CREATE_LIMITS;

  // `country` is not in this list: it is a catalogue, not a free line, and it
  // renders from `CrmCountrySelect` below.
  const rows: Array<{ key: keyof LeadAddressForm; label: string; max: number }> = [
    { key: "city", label: t.crmLeads.create.city, max: limits.addressMedium },
    { key: "state", label: t.crmLeads.create.state, max: limits.addressMedium },
    { key: "street1", label: t.crmLeads.create.street1, max: limits.addressLong },
    { key: "street2", label: t.crmLeads.create.street2, max: limits.addressShort },
    { key: "buildingNo", label: t.crmLeads.create.buildingNo, max: limits.addressShort },
    { key: "floor", label: t.crmLeads.create.floor, max: limits.addressShort },
    { key: "postalCode", label: t.crmLeads.create.postalCode, max: limits.postalCode },
    { key: "landmark", label: t.crmLeads.create.landmark, max: limits.addressLong },
  ];

  return (
    <FormSection
      id="address"
      title={t.crmLeads.create.sections.address}
      columns={3}
    >
      <Field label={t.crmLeads.create.country} error={errors["address.country"]}>
        <CrmCountrySelect
          value={address.country}
          disabled={disabled}
          onChange={(next) => onChange("country", next)}
          onBlur={() => onBlur("address.country")}
        />
      </Field>

      {rows.map((row) => (
        <Field key={row.key} label={row.label} error={errors[`address.${row.key}`]}>
          <Input
            value={address[row.key]}
            maxLength={row.max}
            disabled={disabled}
            onChange={(event) => onChange(row.key, event.target.value)}
            onBlur={() => onBlur(`address.${row.key}`)}
          />
        </Field>
      ))}
    </FormSection>
  );
}
