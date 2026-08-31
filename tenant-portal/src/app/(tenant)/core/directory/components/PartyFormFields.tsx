"use client";

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  PARTY_DISPLAY_NAME_MAX,
  PARTY_HONORIFIC_MAX,
  PARTY_LEGAL_NAME_MAX,
  PARTY_ORGANIZATION_NAME_MAX,
  PARTY_PERSON_NAME_MAX,
  PARTY_REGISTRATION_MAX,
  PARTY_STATUSES,
  PARTY_TYPES,
  type PartyFormValues,
  type PartyStatus,
} from "../directory-contract";

interface PartyFormFieldsProps {
  values: PartyFormValues;
  onChange: (patch: Partial<PartyFormValues>) => void;
  isSubmitting: boolean;
  /** `UpdatePartyDto` has no `partyType` — it is fixed once the party exists. */
  typeReadOnly: boolean;
  /** Only the update route accepts `status`. */
  status?: { value: PartyStatus; onChange: (next: PartyStatus) => void };
}

export function PartyFormFields({
  values,
  onChange,
  isSubmitting,
  typeReadOnly,
  status,
}: PartyFormFieldsProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const isOrganization = values.partyType === "ORGANIZATION";

  return (
    <div className="flex flex-col gap-4">
      <Field label={copy.fieldPartyType} hint={copy.fieldPartyTypeHint} readOnly={typeReadOnly} required>
        <Select
          value={values.partyType}
          onValueChange={(value) => onChange({ partyType: value as PartyFormValues["partyType"] })}
          disabled={typeReadOnly || isSubmitting}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {copy.partyTypes[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={copy.fieldDisplayName} hint={copy.fieldDisplayNameHint} required>
        <Input
          value={values.displayName}
          onChange={(event) => onChange({ displayName: event.target.value })}
          maxLength={PARTY_DISPLAY_NAME_MAX}
          disabled={isSubmitting}
          required
        />
      </Field>

      {isOrganization ? (
        <>
          <Field label={copy.fieldOrganizationName}>
            <Input
              value={values.organizationName}
              onChange={(event) => onChange({ organizationName: event.target.value })}
              maxLength={PARTY_ORGANIZATION_NAME_MAX}
              disabled={isSubmitting}
            />
          </Field>
          <Field label={copy.fieldLegalName}>
            <Input
              value={values.legalName}
              onChange={(event) => onChange({ legalName: event.target.value })}
              maxLength={PARTY_LEGAL_NAME_MAX}
              disabled={isSubmitting}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={copy.fieldHonorific}>
            <Input
              value={values.honorificTitle}
              onChange={(event) => onChange({ honorificTitle: event.target.value })}
              maxLength={PARTY_HONORIFIC_MAX}
              disabled={isSubmitting}
            />
          </Field>
          <Field label={copy.fieldFirstName}>
            <Input
              value={values.firstName}
              onChange={(event) => onChange({ firstName: event.target.value })}
              maxLength={PARTY_PERSON_NAME_MAX}
              disabled={isSubmitting}
            />
          </Field>
          <Field label={copy.fieldLastName}>
            <Input
              value={values.lastName}
              onChange={(event) => onChange({ lastName: event.target.value })}
              maxLength={PARTY_PERSON_NAME_MAX}
              disabled={isSubmitting}
            />
          </Field>
        </>
      )}

      <Field label={copy.fieldTaxNumber}>
        <Input
          dir="ltr"
          value={values.taxNumber}
          onChange={(event) => onChange({ taxNumber: event.target.value })}
          maxLength={PARTY_REGISTRATION_MAX}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={copy.fieldCommercialRegistration}>
        <Input
          dir="ltr"
          value={values.commercialRegistrationNumber}
          onChange={(event) => onChange({ commercialRegistrationNumber: event.target.value })}
          maxLength={PARTY_REGISTRATION_MAX}
          disabled={isSubmitting}
        />
      </Field>

      {status ? (
        <Field label={t.common.status} hint={copy.fieldStatusHint}>
          <Select
            value={status.value}
            onValueChange={(value) => status.onChange(value as PartyStatus)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTY_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.partyStatuses[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
