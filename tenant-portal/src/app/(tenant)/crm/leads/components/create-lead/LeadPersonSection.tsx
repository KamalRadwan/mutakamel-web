"use client";

import { Field, FormSection, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { LEAD_CREATE_LIMITS, type CreateLeadForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";
import { CrmContactLine } from "../../../shared/components/CrmContactLine";

type PersonField = "displayName" | "honorificTitle" | "firstName" | "lastName" | "email";

export interface LeadPersonSectionProps {
  form: CreateLeadForm;
  errors: LeadCreateErrors;
  disabled: boolean;
  onFieldChange: (key: PersonField, value: string) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * The person an individual lead IS.
 *
 * Only rendered for `INDIVIDUAL`, and that is not a layout preference: on a
 * corporate lead `LeadsService.create` writes the mobile numbers and the email
 * for the `INDIVIDUAL` branch only, so these boxes would accept input and drop
 * it. A corporate lead's people live in the Contacts section, where the server
 * actually stores them.
 */
export function LeadPersonSection({
  form,
  errors,
  disabled,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: LeadPersonSectionProps) {
  const { t } = useI18n();
  // `CrmContactLine` keys its messages by `<path>.<field>`; this form keys the
  // person's own fields flat, so the few it shows are re-pointed here rather
  // than the line growing a second addressing mode.
  const personErrors = {
    "person.honorificTitle": errors.honorificTitle,
    "person.fullName": errors.displayName,
    "person.email": errors.email,
    "person.phones.0": errors["phones.0"],
    "person.phones.1": errors["phones.1"],
    "person.phones.2": errors["phones.2"],
  };

  return (
    <FormSection id="person" title={t.crmLeads.create.sections.person} columns={1}>
      {/* The same line a contact gets, minus the job title: a lead who IS a
          person has none. One template, so an individual lead and a corporate
          lead's contact do not look like two different products. */}
      <CrmContactLine
        path="person"
        contact={{
          honorificTitle: form.honorificTitle,
          fullName: form.displayName,
          jobTitle: "",
          email: form.email,
          phones: form.phones,
        }}
        errors={personErrors}
        disabled={disabled}
        limits={{
          fullName: LEAD_CREATE_LIMITS.displayName,
          jobTitle: LEAD_CREATE_LIMITS.jobTitle,
          email: LEAD_CREATE_LIMITS.email,
        }}
        nameLabel={t.crmLeads.create.displayName}
        showJobTitle={false}
        onFieldChange={(patch) => {
          if (patch.honorificTitle !== undefined) {
            onFieldChange("honorificTitle", patch.honorificTitle);
          }
          if (patch.fullName !== undefined) onFieldChange("displayName", patch.fullName);
          if (patch.email !== undefined) onFieldChange("email", patch.email);
        }}
        onPhoneChange={onPhoneChange}
        onPhoneAdd={onPhoneAdd}
        onPhoneRemove={onPhoneRemove}
        onBlur={onBlur}
      />

      {/* The two parts of the name the DTO also accepts. They sit under the
          line rather than in it: they refine the display name rather than
          standing beside it, and five boxes is already the line's budget. */}
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 md:grid-cols-2 xl:grid-cols-[minmax(0,15rem)_minmax(0,15rem)]">
        <Field label={t.crmLeads.create.firstName} error={errors.firstName}>
          <Input
            value={form.firstName}
            maxLength={LEAD_CREATE_LIMITS.firstName}
            disabled={disabled}
            onChange={(event) => onFieldChange("firstName", event.target.value)}
            onBlur={() => onBlur("firstName")}
          />
        </Field>

        <Field label={t.crmLeads.create.lastName} error={errors.lastName}>
          <Input
            value={form.lastName}
            maxLength={LEAD_CREATE_LIMITS.lastName}
            disabled={disabled}
            onChange={(event) => onFieldChange("lastName", event.target.value)}
            onBlur={() => onBlur("lastName")}
          />
        </Field>
      </div>
    </FormSection>
  );
}
