"use client";

import { Mail, Pencil } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import type { LeadDetail } from "../../lead-contract";
import type { LeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import { useLeadCompanyModal } from "../hooks/useLeadCompanyModal";
import { LeadCompanyEditModal } from "./LeadCompanyEditModal";
import { LeadCompanyPhoneRow } from "./LeadCompanyPhoneRow";

/** Company facts stay readable; editing owns a separate, prefilled modal. */
export function LeadCompanyCard({ lead, edit, readOnly }: {
  lead: LeadDetail;
  edit: LeadCompanyEdit;
  readOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const modal = useLeadCompanyModal(lead, edit, readOnly);
  const read = (value: string | null, dir?: "ltr") => (
    <ReadValue value={value} dir={dir} emptyLabel={t.detail.notRecorded} />
  );
  const fields: Array<{ label: string; value: React.ReactNode; alignTop?: boolean; labelClassName?: string }> = [
    { label: t.crmLeads.companyName, value: read(lead.companyName) },
    { label: t.crmLeads.create.taxNumber, value: read(lead.taxNumber, "ltr") },
    {
      label: t.crmLeadDetail.companyPhones,
      alignTop: true,
      value: lead.phones.length > 0 ? (
        <span className="flex flex-col gap-1">
          {lead.phones.map((phone, index) => <LeadCompanyPhoneRow key={`${phone}-${index}`} phone={phone} />)}
        </span>
      ) : <EmptyValue label={t.detail.notRecorded} />,
    },
    {
      label: t.crmLeads.create.commercialRegistrationNumber,
      labelClassName: "whitespace-nowrap",
      value: read(lead.commercialRegistrationNumber, "ltr"),
    },
    {
      label: t.crmLeadDetail.companyEmail,
      value: (
        <span className="flex items-center gap-1">
          {read(lead.companyEmail, "ltr")}
          {lead.companyEmail && (
            <Button variant="ghost" size="xs" asChild>
              <a href={`mailto:${lead.companyEmail}`} aria-label={t.crmLeadDetail.sendEmail} title={t.crmLeadDetail.sendEmail}>
                <Mail className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
          )}
        </span>
      ),
    },
    { label: t.crmLeadDetail.companyWebsite, value: read(lead.companyWebsite, "ltr") },
    { label: t.crmLeadDetail.location, value: <LeadCompanyLocation address={lead.address} lang={lang} emptyLabel={t.detail.notRecorded} /> },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-1.5 p-2">
          <CardTitle className="text-sm">{t.crmLeadDetail.companyTitle}</CardTitle>
          {!readOnly && (
            <Button variant="ghost" size="xs" className="text-warning-vivid"
              aria-label={t.crmLeadDetail.editCompany} title={t.crmLeadDetail.editCompany}
              disabled={edit.savingKey !== null} onClick={modal.open}>
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-2">
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
            {fields.map((field) => (
              <div key={field.label} className={cn("col-span-2 grid grid-cols-subgrid items-center", field.alignTop && "items-start")}>
                <dt className={cn("flex min-h-(--size-control-xs) items-center text-xs text-muted-foreground", field.labelClassName)}>{field.label}</dt>
                <dd className="min-w-0 text-xs text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <LeadCompanyEditModal state={modal} edit={edit} readOnly={readOnly} />
    </>
  );
}

function ReadValue({ value, dir, emptyLabel }: { value: string | null; dir?: "ltr"; emptyLabel: string }) {
  if (!value) return <EmptyValue label={emptyLabel} />;
  return <span className="flex min-h-(--size-control-xs) items-center wrap-anywhere" dir={dir}>{value}</span>;
}

function EmptyValue({ label }: { label: string }) {
  return <span className="flex min-h-(--size-control-xs) items-center text-muted-foreground">{label}</span>;
}

function LeadCompanyLocation({ address, lang, emptyLabel }: {
  address: LeadDetail["address"];
  lang: Language;
  emptyLabel: string;
}) {
  if (!address) return <EmptyValue label={emptyLabel} />;
  const isoCode = address.country ? countryIsoFromName(address.country) : null;
  const country = isoCode ? getCountryOptions(lang).find((option) => option.isoCode === isoCode) : undefined;
  const parts = [country?.name ?? address.country, address.city].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return <EmptyValue label={emptyLabel} />;
  return (
    <span className="flex min-h-(--size-control-xs) items-center gap-1">
      {country && <span aria-hidden="true" className="text-sm leading-none">{country.flag}</span>}
      <span>{parts.join(" / ")}</span>
    </span>
  );
}
