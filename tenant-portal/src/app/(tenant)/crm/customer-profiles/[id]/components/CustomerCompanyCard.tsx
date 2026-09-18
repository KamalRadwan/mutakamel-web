"use client";

import { Mail, Pencil } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { CustomerPhoneActionsRow } from "../../components/CustomerPhoneActionsRow";
import type { CustomerProfileDetail } from "../../customer-profile-contract";

export interface CustomerCompanyCardProps {
  profile: CustomerProfileDetail;
  onEdit?: () => void;
  readOnly: boolean;
}

export function CustomerCompanyCard({
  profile,
  onEdit,
  readOnly,
}: CustomerCompanyCardProps) {
  const { t, lang } = useI18n();

  const read = (value: string | null, dir?: "ltr") => (
    <ReadValue value={value} dir={dir} emptyLabel={t.detail.notRecorded} />
  );

  const phoneNumbers = [
    profile.companyPhone,
    profile.primaryMobile,
    ...profile.phones,
  ].filter(
    (phone, idx, arr): phone is string =>
      Boolean(phone) && arr.indexOf(phone) === idx,
  );

  const fields: Array<{
    label: string;
    value: React.ReactNode;
    alignTop?: boolean;
    labelClassName?: string;
  }> = [
    {
      label: t.crmCustomerProfiles.company,
      value: read(profile.companyName || profile.displayName),
    },
    {
      label: t.crmCustomerProfileActions.legalName,
      value: read(profile.legalName),
    },
    {
      label: t.crmCustomerProfileActions.taxNumber,
      value: read(profile.taxNumber, "ltr"),
    },
    {
      label: t.crmCustomerProfileActions.commercialRegistration,
      labelClassName: "whitespace-nowrap",
      value: read(profile.commercialRegistrationNumber, "ltr"),
    },
    {
      label: t.crmLeadDetail.companyPhones,
      alignTop: true,
      value:
        phoneNumbers.length > 0 ? (
          <span className="flex flex-col gap-1">
            {phoneNumbers.map((phone) => (
              <CustomerPhoneActionsRow
                key={phone}
                phone={phone}
                country={profile.address?.country ?? undefined}
                actionsOnly={false}
              />
            ))}
          </span>
        ) : (
          <EmptyValue label={t.detail.notRecorded} />
        ),
    },
    {
      label: t.crmLeadDetail.companyEmail,
      value: (
        <span className="flex items-center gap-1">
          {read(profile.companyEmail || profile.email, "ltr")}
          {(profile.companyEmail || profile.email) && (
            <Button variant="ghost" size="xs" asChild>
              <a
                href={`mailto:${profile.companyEmail || profile.email}`}
                aria-label={t.crmLeadDetail.sendEmail}
                title={t.crmLeadDetail.sendEmail}
              >
                <Mail className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
          )}
        </span>
      ),
    },
    {
      label: t.crmLeadDetail.companyWebsite,
      value: profile.companyWebsite ? (
        <a
          href={
            profile.companyWebsite.startsWith("http")
              ? profile.companyWebsite
              : `https://${profile.companyWebsite}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
          dir="ltr"
        >
          {profile.companyWebsite}
        </a>
      ) : (
        <EmptyValue label={t.detail.notRecorded} />
      ),
    },
    {
      label: t.crmLeadDetail.location,
      value: (
        <CompanyLocation
          address={profile.address}
          lang={lang}
          emptyLabel={t.detail.notRecorded}
        />
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-1.5 p-2">
        <CardTitle className="text-sm">{t.crmLeadDetail.companyTitle}</CardTitle>
        {!readOnly && onEdit && (
          <Button
            variant="ghost"
            size="xs"
            className="text-warning-vivid"
            aria-label={t.crmLeadDetail.editCompany}
            title={t.crmLeadDetail.editCompany}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn(
                "col-span-2 grid grid-cols-subgrid items-center",
                field.alignTop && "items-start",
              )}
            >
              <dt
                className={cn(
                  "flex min-h-(--size-control-xs) items-center text-xs text-muted-foreground",
                  field.labelClassName,
                )}
              >
                {field.label}
              </dt>
              <dd className="min-w-0 text-xs text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function CompanyLocation({
  address,
  lang,
  emptyLabel,
}: {
  address: CustomerProfileDetail["address"];
  lang: "ar" | "en";
  emptyLabel: string;
}) {
  if (!address) return <EmptyValue label={emptyLabel} />;
  const iso = address.country ? countryIsoFromName(address.country) : null;
  const country = iso
    ? getCountryOptions(lang).find(({ isoCode }) => isoCode === iso)
    : undefined;
  const parts = [
    country?.name ?? address.country,
    address.city,
    address.area,
    address.street,
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return <EmptyValue label={emptyLabel} />;
  return (
    <span className="flex min-h-(--size-control-xs) items-center gap-1">
      {country?.flag && (
        <span aria-hidden="true" className="text-sm leading-none">
          {country.flag}
        </span>
      )}
      <span>{parts.join(" / ")}</span>
    </span>
  );
}

function ReadValue({
  value,
  dir,
  emptyLabel,
}: {
  value: string | null;
  dir?: "ltr";
  emptyLabel: string;
}) {
  if (!value) return <EmptyValue label={emptyLabel} />;
  return (
    <span
      className="flex min-h-(--size-control-xs) items-center wrap-anywhere"
      dir={dir}
    >
      {value}
    </span>
  );
}

function EmptyValue({ label }: { label: string }) {
  return (
    <span className="flex min-h-(--size-control-xs) items-center text-muted-foreground">
      {label}
    </span>
  );
}
