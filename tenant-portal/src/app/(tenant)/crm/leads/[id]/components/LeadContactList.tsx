"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadContact } from "../../lead-contract";
import { LeadCompanyPhoneRow } from "./LeadCompanyPhoneRow";

export function LeadContactList({ contacts, onEdit }: {
  contacts: LeadContact[];
  onEdit?: (contact: LeadContact) => void;
}) {
  return contacts.map((contact) => (
    <LeadContactReadCard key={contact.partyId} name={contact.displayName}
      jobTitle={contact.jobTitle} phones={contact.phones} email={contact.email}
      isPrimary={contact.isPrimary} onEdit={onEdit ? () => onEdit(contact) : undefined} />
  ));
}

/** Only the full name and three ways to identify/reach this person, never company data. */
export function LeadContactReadCard({ name, jobTitle, phones, email, isPrimary, onEdit }: {
  name: string;
  jobTitle: string | null;
  phones: string[];
  email: string | null;
  isPrimary?: boolean;
  onEdit?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="min-w-0">
      <CardContent className="p-2">
        <LeadContactFields fields={[
          { label: t.crmLeadDetail.fullName, value: (
            <span className="flex min-w-0 items-start justify-between gap-2">
              <span className="flex min-w-0 flex-wrap items-center gap-1">
                <span className="wrap-anywhere">{name}</span>
                {isPrimary && <Badge tone="brand">{t.crmLeadDetail.primaryContact}</Badge>}
              </span>
              {onEdit && <Button variant="ghost" size="xs" className="shrink-0 text-warning-vivid"
                aria-label={t.crmLeadDetail.editContact + ": " + name} title={t.crmLeadDetail.editContact}
                onClick={onEdit}><Pencil className="size-3.5" aria-hidden="true" /></Button>}
            </span>
          ) },
          { label: t.crmLeadConvert.contactJobTitle, value: jobTitle },
          { label: t.crmLeads.phone, value: phones.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-1">
              {phones.map((phone) => <LeadCompanyPhoneRow key={phone} phone={phone} />)}
            </div>
          ) : null },
          { label: t.crmLeads.email, value: email ? (
            <a dir="ltr" href={"mailto:" + email} className="wrap-anywhere underline-offset-2 hover:underline">{email}</a>
          ) : null },
        ]} />
      </CardContent>
    </Card>
  );
}

export function LeadContactFields({ fields }: { fields: Array<{ label: string; value: ReactNode }> }) {
  const { t } = useI18n();
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1">
      {fields.map(({ label, value }) => (
        <div key={label} className="col-span-2 grid grid-cols-subgrid items-start">
          <dt className="flex min-h-(--size-control-xs) items-center text-xs text-muted-foreground">{label}</dt>
          <dd className="min-w-0 min-h-(--size-control-xs) content-center wrap-anywhere text-xs text-foreground">
            {value || <span className="text-muted-foreground">{t.detail.notRecorded}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
