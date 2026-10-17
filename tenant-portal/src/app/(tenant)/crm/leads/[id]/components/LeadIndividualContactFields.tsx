"use client";

import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { LeadDetail } from "../../lead-contract";
import { LEAD_CONTACT_EDIT_LIMITS } from "../lead-contacts-edit-contract";
import type { LeadContactsEdit } from "../hooks/useLeadContactsEdit";
import { HonorificSelect, LeadContactFields } from "./LeadContactList";
import { LeadPhoneActionsRow } from "../../components/LeadPhoneActionsRow";

export function LeadIndividualContactFields({ lead, edit, disabled }: {
  lead: LeadDetail;
  edit: LeadContactsEdit;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const textField = (field: "displayName" | "firstName" | "lastName" | "email", label: string) => {
    const maxLength = field === "firstName" || field === "lastName"
      ? LEAD_CONTACT_EDIT_LIMITS.name : LEAD_CONTACT_EDIT_LIMITS[field];
    return edit.form ? (
      <Field label={label} error={edit.errors[field]}>
        <Input size="sm" placeholder={label} value={edit.form[field]} maxLength={maxLength} disabled={disabled}
          type={field === "email" ? "email" : "text"}
          dir={field === "email" ? "ltr" : undefined}
          onChange={(event) => edit.setField(field, event.target.value)} />
      </Field>
    ) : lead[field] ? (
      field === "email" ? (
        <a href={"mailto:" + lead.email} dir="ltr" className="wrap-anywhere underline-offset-2 hover:underline">{lead.email}</a>
      ) : lead[field]
    ) : null;
  };
  const phones = lead.phones.length > 0 ? lead.phones : lead.primaryMobile ? [lead.primaryMobile] : [];

  return (
    <LeadContactFields
      fields={[
        {
          label: t.crmLeads.phone,
          span2: true,
          value: edit.form ? (
            <div className="dossier-phone-box-edit p-2.5">
              <CrmPhoneListField
                label={t.crmLeads.phone}
                phones={edit.form.phones}
                path="phones"
                errors={edit.errors}
                disabled={disabled}
                onChange={edit.setPhone}
                onAdd={edit.addPhone}
                onRemove={edit.removePhone}
                onBlur={() => {}}
              />
            </div>
          ) : phones.length > 0 ? (
            <div className="dossier-phone-box-view flex min-w-0 flex-col gap-1 p-2.5">
              {phones.map((phone) => (
                <LeadPhoneActionsRow
                  key={phone}
                  phone={phone}
                  country={lead.address?.country ?? undefined}
                />
              ))}
            </div>
          ) : null,
        },
        {
          label: t.crmLeadDetail.honorificTitle,
          value: edit.form ? (
            <Field label={t.crmLeadDetail.honorificTitle} error={edit.errors.honorificTitle}>
              <HonorificSelect
                value={edit.form.honorificTitle}
                disabled={disabled}
                placeholder={t.crmLeadDetail.honorificTitle}
                onChange={(value) => edit.setField("honorificTitle", value)}
              />
            </Field>
          ) : (
            lead.honorificTitle
          ),
        },
        { label: t.crmLeads.name, value: textField("displayName", t.crmLeads.name) },
        { label: t.crmLeadDetail.firstName, value: textField("firstName", t.crmLeadDetail.firstName) },
        { label: t.crmLeadDetail.lastName, value: textField("lastName", t.crmLeadDetail.lastName) },
        { label: t.crmLeads.email, value: textField("email", t.crmLeads.email) },
        {
          label: t.crmCustomerProfiles.type,
          value: t.crmCustomerProfiles.profileTypes[lead.leadProfileType],
        },
      ]}
    />
  );
}
