"use client";

import {
  BriefcaseBusiness,
  Mail,
  MapPin,
  UserRound,
} from "lucide-react";
import { Badge, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { CustomerPhoneActionsRow } from "../CustomerPhoneActionsRow";
import {
  CustomerProfileCardFooter,
  type CustomerProfileCardFooterLabels,
} from "./CustomerProfileCardFooter";

export interface CustomerProfileCardViewFooterLabels
  extends CustomerProfileCardFooterLabels {
  emailAction: string;
  contactEmailAction: string;
  source: string;
  salesperson: string;
  country: string;
  primary: string;
  position: string;
}

export interface CustomerProfileCardViewFooterProps {
  item: CustomerProfileItem;
  sourceName?: string | null;
  onOpenActivities: () => void;
  labels: CustomerProfileCardViewFooterLabels;
}

export function CustomerProfileCardViewFooter({
  item,
  sourceName,
  onOpenActivities,
  labels,
}: CustomerProfileCardViewFooterProps) {
  const { lang } = useI18n();
  const storedCountry = item.country.trim();
  const countryIso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
    ? storedCountry.toUpperCase()
    : countryIsoFromName(storedCountry);
  const country = countryIso
    ? getCountryOptions(lang).find(({ isoCode }) => isoCode === countryIso)
    : undefined;
  const contact =
    item.profileType === "CORPORATE" ? item.primaryContact : null;
  const ownerName = item.owner
    ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-border pt-1.5">
      {storedCountry && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin
            className={cn(iconSize({ size: "sm" }), "shrink-0")}
            aria-hidden="true"
          />
          {country?.flag && (
            <span aria-hidden="true" className="shrink-0 text-sm leading-none">
              {country.flag}
            </span>
          )}
          <span className="truncate">{labels.country}</span>
        </div>
      )}

      {item.phones.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {item.phones.map((phone) => (
            <CustomerPhoneActionsRow
              key={phone}
              phone={phone}
              country={item.country}
            />
          ))}
        </div>
      )}

      {item.email && (
        <a
          href={"mailto:" + item.email}
          aria-label={labels.emailAction}
          title={labels.emailAction}
          onClick={(event) => event.stopPropagation()}
          className="flex min-w-0 items-center gap-1.5 rounded-xs text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mail
            className={cn(iconSize({ size: "sm" }), "shrink-0")}
            aria-hidden="true"
          />
          <span className="truncate" dir="ltr">
            {item.email}
          </span>
        </a>
      )}

      {contact && (
        <div className="mt-0.5 flex flex-col gap-1 rounded-xs bg-muted/60 p-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
            <UserRound
              className={cn(
                iconSize({ size: "sm" }),
                "shrink-0 text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {contact.displayName}
            </span>
            {contact.isPrimary && (
              <Badge
                tone="brand"
                className="shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal"
              >
                {labels.primary}
              </Badge>
            )}
          </div>
          {contact.jobTitle && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <BriefcaseBusiness
                className={cn(iconSize({ size: "sm" }), "shrink-0")}
                aria-hidden="true"
              />
              <span className="truncate">{labels.position}</span>
            </div>
          )}
          {contact.email && (
            <a
              href={"mailto:" + contact.email}
              aria-label={labels.contactEmailAction}
              title={labels.contactEmailAction}
              onClick={(event) => event.stopPropagation()}
              className="flex min-w-0 items-center gap-1.5 rounded-xs text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mail
                className={cn(iconSize({ size: "sm" }), "shrink-0")}
                aria-hidden="true"
              />
              <span className="truncate" dir="ltr">
                {contact.email}
              </span>
            </a>
          )}
          {contact.phones.map((phone) => (
            <CustomerPhoneActionsRow
              key={phone}
              phone={phone}
              country={item.country}
            />
          ))}
        </div>
      )}

      {sourceName && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <AcquisitionSourceIcon source={{ iconUrl: item.sourceIconUrl }} />
          <span className="truncate">{labels.source}</span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-1.5">
        {ownerName && (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
            <UserRound
              className={cn(
                iconSize({ size: "sm" }),
                "shrink-0 text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span className="truncate font-medium">{labels.salesperson}</span>
          </div>
        )}

        <CustomerProfileCardFooter
          nextActivity={item.nextActivity}
          onOpenActivities={onOpenActivities}
          owner={null}
          labels={labels}
        />
      </div>
    </div>
  );
}
