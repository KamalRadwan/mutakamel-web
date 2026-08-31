"use client";

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import { CUSTOMER_STATUSES } from "../customer-profile-contract";
import type { CustomerProfileForm } from "../customer-profile-write-contract";

/** Sentinel for "no acquisition source", since a `Select` item needs a value. */
const NO_SOURCE_VALUE = "__none__";

export interface CustomerProfileFormFieldsProps {
  form: CustomerProfileForm;
  setField: <K extends keyof CustomerProfileForm>(
    key: K,
    value: CustomerProfileForm[K],
  ) => void;
  sources: AcquisitionSource[];
  /** Create allows the type to be chosen; edit does not — the DTO has no `profileType`. */
  allowProfileType: boolean;
  disabled?: boolean;
}

/**
 * The shared field set for creating and editing a customer profile.
 *
 * The corporate block is hidden on an `INDIVIDUAL` profile because
 * `assertCorporateOnlyFields` rejects every one of those keys there — showing
 * boxes whose values the server refuses would be a form that lies.
 */
export function CustomerProfileFormFields({
  form,
  setField,
  sources,
  allowProfileType,
  disabled,
}: CustomerProfileFormFieldsProps) {
  const { t, lang } = useI18n();
  const isCorporate = form.profileType === "CORPORATE";

  return (
    <div className="flex flex-col gap-3">
      {allowProfileType && (
        <Field label={t.crmCustomerProfiles.type} required>
          <Select
            value={form.profileType}
            onValueChange={(value) =>
              setField("profileType", value as CustomerProfileForm["profileType"])
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CORPORATE">
                {t.crmCustomerProfiles.profileTypes.CORPORATE}
              </SelectItem>
              <SelectItem value="INDIVIDUAL">
                {t.crmCustomerProfiles.profileTypes.INDIVIDUAL}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label={t.crmCustomerProfiles.name} required>
        <Input
          value={form.displayName}
          onChange={(event) => setField("displayName", event.target.value)}
          maxLength={180}
          disabled={disabled}
        />
      </Field>

      <Field label={t.common.status}>
        <Select
          value={form.status}
          onValueChange={(value) =>
            setField("status", value as CustomerProfileForm["status"])
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOMER_STATUSES.map((status) => (
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
          onValueChange={(value) =>
            setField(
              "acquisitionSourceId",
              value === NO_SOURCE_VALUE ? "" : value,
            )
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.crmLeadDetail.noSource} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SOURCE_VALUE}>
              {t.crmLeadDetail.noSource}
            </SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {localizedName(source, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isCorporate && (
        <>
          <Field label={t.crmLeads.companyName}>
            <Input
              value={form.companyName}
              onChange={(event) => setField("companyName", event.target.value)}
              maxLength={180}
              disabled={disabled}
            />
          </Field>
          <Field label={t.crmLeadDetail.companyEmail}>
            <Input
              type="email"
              dir="ltr"
              value={form.companyEmail}
              onChange={(event) => setField("companyEmail", event.target.value)}
              maxLength={180}
              disabled={disabled}
            />
          </Field>
          <Field label={t.crmLeadDetail.companyPhone}>
            <Input
              dir="ltr"
              value={form.companyPhone}
              onChange={(event) => setField("companyPhone", event.target.value)}
              maxLength={32}
              disabled={disabled}
            />
          </Field>
          <Field
            label={t.crmLeadDetail.companyWebsite}
            hint={t.crmCustomerProfileActions.websiteHint}
          >
            <Input
              dir="ltr"
              value={form.companyWebsite}
              onChange={(event) =>
                setField("companyWebsite", event.target.value)
              }
              maxLength={180}
              disabled={disabled}
            />
          </Field>
          <Field label={t.crmCustomerProfileActions.taxNumber}>
            <Input
              dir="ltr"
              value={form.taxNumber}
              onChange={(event) => setField("taxNumber", event.target.value)}
              maxLength={64}
              disabled={disabled}
            />
          </Field>
          <Field label={t.crmCustomerProfileActions.commercialRegistration}>
            <Input
              dir="ltr"
              value={form.commercialRegistrationNumber}
              onChange={(event) =>
                setField("commercialRegistrationNumber", event.target.value)
              }
              maxLength={64}
              disabled={disabled}
            />
          </Field>
        </>
      )}

      <Field label={t.crmLeadDetail.description}>
        <Textarea
          value={form.description}
          onChange={(event) => setField("description", event.target.value)}
          maxLength={2000}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}
