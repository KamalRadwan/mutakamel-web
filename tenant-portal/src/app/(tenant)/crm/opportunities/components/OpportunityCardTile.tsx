"use client";

import { BriefcaseBusiness, Building2, Mail, MapPin, UserRound } from "lucide-react";
import {
  Badge,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
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
        {item.customerProfileType && (
          <Badge tone="neutral" className={COMPACT_BADGE}>
            {corporate ? t.crmLeads.card.company : t.crmLeads.card.individual}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
        <span className="truncate">{customerName}</span>
      </div>
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
          {item.tags.map((tag) => (
            <Badge key={tag.id} tone="neutral" className={COMPACT_BADGE}>{tag.name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
