"use client";

import Link from "next/link";
import { Activity, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  StatusBadge,
  cn,
  focusRing,
  iconSize,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import {
  countryIsoFromName,
  getCountryOptions,
} from "@/lib/geo/country-data";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import {
  CRM_ACTIVITY_MARK,
  crmActivityState,
} from "../../shared/crm-activity-tone";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";
import { CustomerPhoneActionsRow } from "./CustomerPhoneActionsRow";
import {
  CustomerOwnerAvatar,
  CustomerProfileAvatar,
} from "./customer-card/CustomerProfileAvatar";
import { CustomerProfileTagList } from "./customer-card/CustomerProfileTagList";

export interface CustomerProfileColumnOptions {
  canDelete?: (item: CustomerProfileItem) => boolean;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities?: (item: CustomerProfileItem) => void;
}

const COMPACT_BADGE =
  "shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal";

export function useCustomerProfileColumns(
  options?: CustomerProfileColumnOptions,
): ColumnDef<CustomerProfileItem>[] {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;
  const countryFlags = new Map(
    getCountryOptions(lang).map(({ isoCode, flag }) => [isoCode, flag]),
  );

  return [
    {
      id: "name",
      sortable: true,
      sortField: "displayName",
      header: t.crmCustomerProfiles.name,
      width: "15rem",
      cell: (item) => (
          <Link
            href={"/crm/customer-profiles/" + encodeURIComponent(item.id)}
            className={cn(
              "flex min-w-48 items-start gap-1.5 rounded-xs text-foreground hover:underline",
              focusRing,
            )}
          >
            <CustomerProfileAvatar
              imageUrl={item.imageUrl}
              displayName={item.displayName}
              profileType={item.profileType}
              className="size-7"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{item.displayName}</span>
              <CustomerProfileTagList
                tags={item.tags}
                moreLabel={card.moreTags}
                maxVisible={1}
                compact
              />
            </span>
            <Badge tone="neutral" className={COMPACT_BADGE}>
              {t.crmCustomerProfiles.profileTypes[item.profileType] ??
                item.profileType}
            </Badge>
          </Link>
        ),
    },
    {
      id: "contact",
      header: t.crmCustomerProfiles.contact,
      width: "15rem",
      cell: (item) => {
        const contact =
          item.profileType === "CORPORATE" ? item.primaryContact : null;
        const name =
          contact?.displayName || item.email || t.crmCustomerProfiles.unavailable;
        const jobTitle = contact?.jobTitle ?? "";
        const email = contact?.email ?? "";
        const title = [name, jobTitle, email].filter(Boolean).join(" · ");
        return (
          <Link
            href={"/crm/customer-profiles/" + encodeURIComponent(item.id)}
            className={cn(
              "flex min-w-48 flex-col items-start gap-0.5 rounded-xs hover:underline",
              focusRing,
            )}
            title={title}
          >
            <span className="flex min-w-0 max-w-full items-center gap-1">
              <span className="max-w-36 truncate">{name}</span>
              {contact?.isPrimary && (
                <Badge tone="brand" className={COMPACT_BADGE}>
                  {card.primary}
                </Badge>
              )}
            </span>
            {(jobTitle || email) && (
              <span className="flex max-w-44 items-center gap-1 text-2xs text-muted-foreground">
                {jobTitle && <span className="truncate">{jobTitle}</span>}
                {jobTitle && email && <span aria-hidden="true">·</span>}
                {email && (
                  <span className="truncate" dir="ltr">
                    {email}
                  </span>
                )}
              </span>
            )}
          </Link>
        );
      },
    },
    {
      id: "phone",
      header: t.crmLeads.phone,
      width: "13rem",
      cell: (item) => {
        const phone =
          item.profileType === "CORPORATE"
            ? item.primaryContact?.phones[0] || item.phone
            : item.phone;
        return (
          <span className="flex min-w-48 items-center gap-1 whitespace-nowrap">
            <Link
              href={"/crm/customer-profiles/" + encodeURIComponent(item.id)}
              dir="ltr"
              className={cn(
                "min-w-0 flex-1 truncate rounded-xs text-start hover:underline",
                focusRing,
              )}
            >
              {phone || t.crmCustomerProfiles.unavailable}
            </Link>
            {phone && (
              <CustomerPhoneActionsRow
                phone={phone}
                country={item.country}
                actionsOnly
              />
            )}
          </span>
        );
      },
    },
    {
      id: "country",
      header: t.crmLeads.create.country,
      width: "8rem",
      cell: (item) => {
        const stored = item.country.trim();
        const city = item.city.trim();
        const iso = /^[A-Z]{2}$/u.test(stored.toUpperCase())
          ? stored.toUpperCase()
          : countryIsoFromName(stored);
        const flag = iso ? (countryFlags.get(iso) ?? "") : "";
        return (
          <span className="flex min-w-24 items-start gap-1.5">
            {flag && (
              <span aria-hidden="true" className="text-sm leading-none">
                {flag}
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="max-w-28 truncate whitespace-nowrap">
                {stored || city || t.crmCustomerProfiles.unavailable}
              </span>
              {stored && city && (
                <span className="max-w-28 truncate whitespace-nowrap text-2xs text-muted-foreground">
                  {city}
                </span>
              )}
            </span>
          </span>
        );
      },
    },
    {
      id: "status",
      header: t.common.status,
      width: "9rem",
      cell: (item) => (
        <StatusBadge value={item.status} kind="CustomerStatus" />
      ),
    },
    {
      id: "source",
      header: t.crmCustomerProfiles.source,
      width: "10rem",
      cell: (item) => {
        const source = localizedValue(
          item.acquisitionSourceNameAr,
          item.acquisitionSourceNameEn,
          lang,
        );
        return (
          <span className="flex min-w-28 items-center gap-1.5 whitespace-nowrap text-xs">
            <AcquisitionSourceIcon source={{ iconUrl: item.sourceIconUrl }} />
            <span className="max-w-32 truncate">
              {source || t.crmCustomerProfiles.unavailable}
            </span>
          </span>
        );
      },
    },
    {
      id: "salesperson",
      header: t.crmLeads.salesperson,
      width: "10rem",
      cell: (item) => {
        const name = item.owner
          ? [item.owner.firstName, item.owner.lastName]
              .filter(Boolean)
              .join(" ")
          : "";
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            {item.owner && (
              <CustomerOwnerAvatar owner={item.owner} className="size-5" />
            )}
            <span className="block max-w-32 truncate">
              {name || t.crmCustomerProfiles.unavailable}
            </span>
          </span>
        );
      },
    },
    {
      id: "activity",
      header: t.crmLeads.followUp,
      width: "10rem",
      cell: (item) => {
        const state = crmActivityState(item.nextActivity);
        const stateLabel = card.activityStates[state];
        return options?.onOpenActivities ? (
          <Button
            variant="ghost"
            size="xs"
            className="min-w-0 gap-1 px-1"
            aria-label={formatTemplate(card.activityOpen, {
              state: stateLabel,
            })}
            title={formatTemplate(card.activityOpen, { state: stateLabel })}
            onClick={(event) => {
              event.stopPropagation();
              options.onOpenActivities?.(item);
            }}
          >
            <Activity
              strokeWidth={2.5}
              className={cn(
                iconSize({ size: "sm" }),
                CRM_ACTIVITY_MARK[state],
              )}
              aria-hidden="true"
            />
            <span className="max-w-24 truncate text-muted-foreground">
              {stateLabel}
            </span>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{stateLabel}</span>
        );
      },
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      width: "3.5rem",
      cell: (item) =>
        options?.canDelete?.(item) && options.onDelete ? (
          <Button
            variant="ghost"
            size="xs"
            className="w-7 px-0"
            onClick={(event) => {
              event.stopPropagation();
              options.onDelete?.(item);
            }}
            aria-label={t.common.delete + ": " + item.displayName}
          >
            <Trash2
              className="size-3.5 text-destructive"
              aria-hidden="true"
            />
          </Button>
        ) : null,
    },
  ];
}
