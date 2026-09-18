"use client";

import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CirclePercent,
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import {
  Badge,
  DateTime,
  Money,
  StatusBadge,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  countryIsoFromName,
  getCountryOptions,
} from "@/lib/geo/country-data";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import type { OpportunityCardItem } from "../hooks/useOpportunityCards";
import { OpportunityPhoneActionsRow } from "./OpportunityPhoneActionsRow";

const COMPACT_BADGE =
  "shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal";

export function OpportunityCardTile({
  item,
  stageName,
}: {
  item: OpportunityCardItem;
  stageName?: string;
}) {
  const { t, lang } = useI18n();
  const corporate = item.customerProfileType === "CORPORATE";
  const ProfileIcon = corporate ? Building2 : UserRound;
  const storedCountry = item.customerCountry?.trim() ?? "";
  const countryIso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
    ? storedCountry.toUpperCase()
    : countryIsoFromName(storedCountry);
  const country = getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso);
  const location = [item.customerCity, country?.name ?? item.customerCountry]
    .filter(Boolean)
    .join(", ");
  const contact = corporate ? item.primaryContact : null;
  const phones = contact?.phones.length
    ? contact.phones
    : item.customerPhone
      ? [item.customerPhone]
      : [];
  const email = contact?.email ?? item.customerEmail;
  const customerName =
    (corporate ? item.customerCompanyName : null) ??
    item.customerDisplayName ??
    t.crmOpportunities.notProvided;
  const probability =
    item.probabilityPercent === null
      ? null
      : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
          percent: formatNumber(item.probabilityPercent, lang),
        });
  const hasCommercialSummary = Boolean(
    item.amount || probability || item.expectedCloseDate,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <ProfileIcon
          className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {item.title}
        </p>
        <span className="flex shrink-0 items-center gap-1">
          <StatusBadge
            value={item.status}
            kind="OpportunityStatus"
            className={COMPACT_BADGE}
          />
          {item.customerProfileType && (
            <Badge tone="neutral" className={COMPACT_BADGE}>
              {corporate ? t.crmLeads.card.company : t.crmLeads.card.individual}
            </Badge>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
        <span className="truncate">{customerName}</span>
      </div>
      {hasCommercialSummary && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xs bg-muted/60 px-1.5 py-1 text-2xs text-muted-foreground">
          {item.amount && (
            <span
              className="inline-flex min-w-0 items-center gap-1"
              title={t.crmOpportunityDetail.amount}
            >
              <Banknote className="size-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t.crmOpportunityDetail.amount}: </span>
              <Money
                value={item.amount}
                currency={item.currencyCode ?? undefined}
                language={lang}
                className="min-w-0 truncate font-medium text-foreground"
              />
            </span>
          )}
          {probability && (
            <span
              className="inline-flex items-center gap-1"
              title={t.crmOpportunityDetail.probability}
            >
              <CirclePercent className="size-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t.crmOpportunityDetail.probability}: </span>
              <span>{probability}</span>
            </span>
          )}
          {item.expectedCloseDate && (
            <span
              className="inline-flex items-center gap-1"
              title={t.crmOpportunities.expectedClose}
            >
              <Calendar className="size-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t.crmOpportunities.expectedClose}: </span>
              <DateTime
                value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`}
                precision="date"
                language={lang}
                timeZone="UTC"
              />
            </span>
          )}
        </div>
      )}
      {contact && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <BriefcaseBusiness className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate text-foreground">{contact.displayName}</span>
          {contact.jobTitle && <span className="truncate">· {contact.jobTitle}</span>}
          {contact.isPrimary && (
            <Badge tone="brand" className={COMPACT_BADGE}>{t.crmLeads.card.primary}</Badge>
          )}
        </div>
      )}
      {phones.map((phone) => (
        <OpportunityPhoneActionsRow
          key={phone}
          phone={phone}
          country={item.customerCountry}
        />
      ))}
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          <Mail className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate">{email}</span>
        </a>
      )}
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{location}</span>
          {country?.flag && <span aria-hidden="true">{country.flag}</span>}
        </div>
      )}
      <div className="flex min-w-0 items-center justify-between gap-2">
        {item.leadSourceName && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <AcquisitionSourceIcon source={{ iconUrl: item.leadSourceIconUrl }} />
            <span className="truncate">{item.leadSourceName}</span>
          </span>
        )}
        {stageName && <Badge tone="neutral" className="shrink-0">{stageName}</Badge>}
      </div>
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} tone="neutral" className={COMPACT_BADGE}>{tag.name}</Badge>
          ))}
          {item.tags.length > 3 && (
            <span className="text-2xs text-muted-foreground">
              {formatTemplate(t.crmLeads.card.moreTags, {
                count: item.tags.length - 3,
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
