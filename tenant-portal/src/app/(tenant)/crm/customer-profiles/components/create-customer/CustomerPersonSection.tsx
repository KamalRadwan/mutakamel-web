"use client";

import { Field, FormSection, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmContactLine } from "../../../shared/components/CrmContactLine";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  type CreateCustomerProfileForm,
} from "../../customer-profile-create-contract";

type PersonField = "honorificTitle" | "firstName" | "lastName" | "email";

export interface CustomerPersonSectionProps {
  form: CreateCustomerProfileForm;
  errors: CrmFormErrors;
  disabled: boolean;
  onFieldChange: (key: PersonField, value: string) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * The person an individual customer IS.
 *
 * Every value here travels inside `primaryContact`, because `CreateCustomerProfileDto`
 * has no top-level `email` or `phones` — the service reads them off that object
 * and writes them onto the PERSON party. `fullName` is not asked for twice: the
 * DTO requires it and the service then ignores it in favour of `displayName`,
 * so the builder sends the display name for both.
 */
export function CustomerPersonSection({
  form,
  errors,
  disabled,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: CustomerPersonSectionProps) {
  const { t } = useI18n();
  const limits = CUSTOMER_PROFILE_CREATE_LIMITS;
  // `CrmContactLine` keys its messages by `<path>.<field>`; this form keys the
  // person's own fields flat, so the few it shows are re-pointed here rather
  // than the line growing a second addressing mode.
  const personErrors = {
    "person.honorificTitle": errors.honorificTitle,
    "person.fullName": errors.firstName,
    "person.email": errors.email,
    "person.phones.0": errors["phones.0"],
    "person.phones.1": errors["phones.1"],
    "person.phones.2": errors["phones.2"],
  };

  return (
    <FormSection id="person" title={t.crmCustomerProfiles.create.sections.person} columns={1}>
      {/* The same line a contact gets, minus the job title: a customer who IS
          a person has none. One template, so the individual and corporate
          paths through this modal do not look like two different products. */}
      <CrmContactLine
        path="person"
        contact={{
          honorificTitle: form.honorificTitle,
          fullName: form.firstName,
          jobTitle: "",
          email: form.email,
          phones: form.phones,
        }}
        errors={personErrors}
        disabled={disabled}
        limits={{
          fullName: limits.firstName,
          jobTitle: limits.jobTitle,
          email: limits.email,
        }}
        nameLabel={t.crmLeads.create.firstName}
        showJobTitle={false}
        onFieldChange={(patch) => {
          if (patch.honorificTitle !== undefined) {
            onFieldChange("honorificTitle", patch.honorificTitle);
          }
          if (patch.fullName !== undefined) onFieldChange("firstName", patch.fullName);
          if (patch.email !== undefined) onFieldChange("email", patch.email);
        }}
        onPhoneChange={onPhoneChange}
        onPhoneAdd={onPhoneAdd}
        onPhoneRemove={onPhoneRemove}
        onBlur={onBlur}
      />

      {/* The display name lives in Classification for a customer, so the family
          name is the one name box that has nowhere in the line to go. */}
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 xl:grid-cols-[minmax(0,15rem)]">
        <Field label={t.crmLeads.create.lastName} error={errors.lastName}>
          <Input
            value={form.lastName}
            maxLength={limits.lastName}
            disabled={disabled}
            onChange={(event) => onFieldChange("lastName", event.target.value)}
            onBlur={() => onBlur("lastName")}
          />
        </Field>
      </div>
    </FormSection>
  );
}
