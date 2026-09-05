"use client";

import {
  Field,
  FormSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import { CRM_PROFILE_TYPES, type CrmProfileType } from "../../../leads/lead-contract";
import {
  CUSTOMER_PROFILE_STATUSES,
  type CreateCustomerProfileForm,
  type CustomerProfileCreateStatus,
} from "../../customer-profile-create-contract";

/** Sentinel for "no acquisition source", since a `Select` item needs a value. */
const NO_SOURCE_VALUE = "__none__";

export interface CustomerClassificationSectionProps {
  form: CreateCustomerProfileForm;
  sources: AcquisitionSource[];
  disabled: boolean;
  onProfileTypeChange: (profileType: CrmProfileType) => void;
  onFieldChange: <K extends "status" | "acquisitionSourceId">(
    key: K,
    value: CreateCustomerProfileForm[K],
  ) => void;
}

/**
 * What kind of customer this is, and where it came from.
 *
 * The type comes first because it decides which sections below exist:
 * `assertCorporateOnlyFields` answers any of the nine company keys on an
 * individual profile with a 422, and an individual's own name and numbers reach
 * the party through a different key entirely.
 */
export function CustomerClassificationSection({
  form,
  sources,
  disabled,
  onProfileTypeChange,
  onFieldChange,
}: CustomerClassificationSectionProps) {
  const { t, lang } = useI18n();

  return (
    <FormSection
      id="classification"
      title={t.crmCustomerProfiles.create.sections.classification}
      columns={2}
    >
      <Field label={t.crmCustomerProfiles.type} required>
        <Select
          value={form.profileType}
          disabled={disabled}
          onValueChange={(value) => onProfileTypeChange(value as CrmProfileType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_PROFILE_TYPES.map((profileType) => (
              <SelectItem key={profileType} value={profileType}>
                {t.crmCustomerProfiles.profileTypes[profileType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.common.status} hint={t.crmCustomerProfiles.create.statusHint}>
        <Select
          value={form.status}
          disabled={disabled}
          onValueChange={(value) =>
            onFieldChange("status", value as CustomerProfileCreateStatus)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_PROFILE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t.statusValues[`CustomerStatus.${status}`] ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmLeads.source}>
        <Select
          value={form.acquisitionSourceId || NO_SOURCE_VALUE}
          disabled={disabled}
          onValueChange={(value) =>
            onFieldChange("acquisitionSourceId", value === NO_SOURCE_VALUE ? "" : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t.crmLeadDetail.noSource} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SOURCE_VALUE}>
              <AcquisitionSourceOption source={null} label={t.crmLeadDetail.noSource} />
            </SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                <AcquisitionSourceOption source={source} label={localizedName(source, lang)} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormSection>
  );
}
