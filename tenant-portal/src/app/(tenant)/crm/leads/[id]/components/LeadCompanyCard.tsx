"use client";

import { Building2, Mail, Pencil } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import type { LeadDetail } from "../../lead-contract";
import type { LeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import { useLeadCompanyModal } from "../hooks/useLeadCompanyModal";
import { LeadCompanyEditModal } from "./LeadCompanyEditModal";
import { LeadPhoneActionsRow } from "../../components/LeadPhoneActionsRow";

function formatFullLegalAddress(address: LeadDetail["address"]): string | null {
  if (!address) return null;
  const parts = [
    address.street,
    address.buildingNo ? `Bldg ${address.buildingNo}` : null,
    address.floor ? `Floor ${address.floor}` : null,
    address.apartment,
    address.area,
    address.city,
    address.country,
    address.landmark ? `Landmark: ${address.landmark}` : null,
    address.postalCode ? `Postal Code: ${address.postalCode}` : null,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Corporate Company Details Card (Dossier 360° Section 1).
 * In View Mode: displays the highlighted Emerald-Cyan Company Phones box and 2-column boxed field grid.
 * In Edit Mode: transforms in-place into the Inline Company & Split Phones Editor (hiding the view card).
 */
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
  const fullLegalAddress = formatFullLegalAddress(lead.address);

  // When editing, hide the original View Mode card in-place and render the Inline Editor card
  if (modal.form) {
    return <LeadCompanyEditModal state={modal} edit={edit} readOnly={readOnly} />;
  }

  const fields: Array<{
    label: string;
    value: React.ReactNode;
    alignTop?: boolean;
    labelClassName?: string;
    fullWidth?: boolean;
  }> = [
    { label: t.crmLeads.companyName, value: read(lead.companyName) },
    {
      label: t.crmLeadDetail.companyEmail,
      value: (
        <span className="flex items-center gap-1.5">
          {read(lead.companyEmail, "ltr")}
          {lead.companyEmail && (
            <Button variant="ghost" size="xs" asChild>
              <a href={`mailto:${lead.companyEmail}`} aria-label={t.crmLeadDetail.sendEmail} title={t.crmLeadDetail.sendEmail}>
                <Mail className="size-3.5 text-primary" aria-hidden="true" />
              </a>
            </Button>
          )}
        </span>
      ),
    },
    { label: t.crmLeads.create.taxNumber, value: read(lead.taxNumber, "ltr") },
    {
      label: t.crmLeads.create.commercialRegistrationNumber,
      labelClassName: "whitespace-nowrap",
      value: read(lead.commercialRegistrationNumber, "ltr"),
    },
    {
      label: t.crmLeadDetail.companyWebsite,
      value: lead.companyWebsite ? (
        <a
          href={lead.companyWebsite.startsWith("http") ? lead.companyWebsite : `https://${lead.companyWebsite}`}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="text-primary underline-offset-2 hover:underline"
        >
          {lead.companyWebsite} ↗
        </a>
      ) : (
        <EmptyValue label={t.detail.notRecorded} />
      ),
    },
    {
      label: t.crmLeadDetail.location,
      value: <LeadCompanyLocation address={lead.address} lang={lang} emptyLabel={t.detail.notRecorded} />,
    },
    {
      label: t.crmLeads.executive.fullLegalAddress,
      fullWidth: true,
      value: read(fullLegalAddress),
    },
  ];

  return (
    <Card className="dossier-card dossier-card-indigo">
      <CardHeader className="dossier-card-head flex-row items-center justify-between gap-2">
        <div className="dossier-card-title">
          <span className="dossier-icon-pill dossier-ip-indigo" aria-hidden="true">
            <Building2 className="size-3.5" aria-hidden="true" />
          </span>
          <CardTitle className="text-xs font-semibold tracking-wider uppercase">
            {t.crmLeadDetail.companyTitle}
          </CardTitle>
          <span className="dossier-badge dossier-badge-corporate">
            {t.crmCustomerProfiles.profileTypes.CORPORATE}
          </span>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="dossier-btn-action"
            aria-label={t.crmLeadDetail.editCompany}
            title={t.crmLeadDetail.editCompany}
            disabled={edit.savingKey !== null}
            onClick={modal.open}
          >
            <Pencil className="size-3" aria-hidden="true" />
            <span>{t.crmLeadDetail.editCompany}</span>
          </Button>
        ) : (
          <span className="dossier-badge dossier-badge-converted">
            🔒 {t.crmLeads.executive.readOnly}
          </span>
        )}
      </CardHeader>
      <CardContent className="dossier-card-body">
        {/* Highlighted Emerald-Cyan Company Phones Box (View Mode) */}
        <div className="dossier-phone-box-view">
          <div className="dossier-phone-box-head">
            <span className="dossier-phone-box-label">
              📞 {t.crmLeadDetail.companyPhones}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={edit.savingKey !== null}
                onClick={modal.open}
                className="dossier-btn-action dossier-btn-action-emerald"
              >
                <Pencil className="size-3" aria-hidden="true" />
                <span>
                  {t.crmLeads.executive.editPhones}
                </span>
              </Button>
            )}
          </div>
          {lead.phones.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {lead.phones.map((phone, index) => (
                <LeadPhoneActionsRow
                  key={`${phone}-${index}`}
                  phone={phone}
                  country={lead.address?.country ?? undefined}
                  badge={
                    index === 0
                      ? t.crmLeads.executive.primaryPhone
                      : t.crmLeads.executive.secondaryPhone
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyValue label={t.detail.notRecorded} />
          )}
        </div>

        {/* 2-Column Boxed Company Fields Grid */}
        <dl className="dossier-grid-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-2.5 sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn(
                "dossier-field-box flex flex-col justify-center",
                field.fullWidth && "dossier-span-all",
              )}
            >
              <dt
                className={cn(
                  "dossier-field-label text-xs text-muted-foreground",
                  field.labelClassName,
                )}
              >
                {field.label}
              </dt>
              <dd className="dossier-field-val min-w-0 text-xs font-semibold text-foreground">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
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

