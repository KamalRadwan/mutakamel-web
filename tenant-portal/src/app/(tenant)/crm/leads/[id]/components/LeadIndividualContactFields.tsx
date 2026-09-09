"use client";

import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { LeadDetail } from "../../lead-contract";
import { LEAD_CONTACT_EDIT_LIMITS } from "../lead-contacts-edit-contract";
import type { LeadContactsEdit } from "../hooks/useLeadContactsEdit";
import { LeadContactFields } from "./LeadContactList";
import { LeadCompanyPhoneRow } from "./LeadCompanyPhoneRow";

export function LeadIndividualContactFields({ lead, edit, disabled }: {
  lead: LeadDetail;
  edit: LeadContactsEdit;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const textField = (field: "displayName" | "firstName" | "lastName" | "honorificTitle" | "email", label: string) => {
    const maxLength = field === "firstName" || field === "lastName"
      ? LEAD_CONTACT_EDIT_LIMITS.name : LEAD_CONTACT_EDIT_LIMITS[field];
    return edit.form ? (
      <Field label={label} error={edit.errors[field]}>
        <Input value={edit.form[field]} maxLength={maxLength} disabled={disabled}
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

  return <LeadContactFields fields={[
    { label: t.crmLeads.name, value: textField("displayName", t.crmLeads.name) },
    { label: t.crmLeadDetail.honorificTitle, value: textField("honorificTitle", t.crmLeadDetail.honorificTitle) },
    { label: t.crmLeadDetail.firstName, value: textField("firstName", t.crmLeadDetail.firstName) },
    { label: t.crmLeadDetail.lastName, value: textField("lastName", t.crmLeadDetail.lastName) },
    {
      label: t.crmLeads.phone,
      value: edit.form ? (
        <CrmPhoneListField label={t.crmLeads.phone} phones={edit.form.phones} path="phones"
          errors={edit.errors} disabled={disabled} onChange={edit.setPhone} onAdd={edit.addPhone}
          onRemove={edit.removePhone} onBlur={() => {}} />
      ) : phones.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1">
          {phones.map((phone) => <LeadCompanyPhoneRow key={phone} phone={phone} />)}
        </div>
      ) : null,
    },
    { label: t.crmLeads.email, value: textField("email", t.crmLeads.email) },
    { label: t.crmCustomerProfiles.type, value: t.crmCustomerProfiles.profileTypes[lead.leadProfileType] },
  ]} />;
}
