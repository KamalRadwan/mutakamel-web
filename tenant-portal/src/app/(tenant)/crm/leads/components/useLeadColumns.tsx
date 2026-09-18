"use client";

import Link from "next/link";
import { Activity, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  focusRing,
  iconSize,
  resolveStatusRole,
  type BadgeProps,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import { leadActivityState, MAX_LEAD_RATING } from "../lead-card-contract";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import { LEAD_ACTIVITY_MARK } from "./lead-card/activity-tone";
import { LeadRating } from "./lead-card/LeadRating";
import { LeadPhoneActionsRow } from "./LeadPhoneActionsRow";

const ROLE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

const COMPACT_BADGE =
  "shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal";

interface LeadColumnOptions {
  stageById: Map<string, LeadStage>;
  canUpdate: (lead: LeadItem) => boolean;
  canDelete: (lead: LeadItem) => boolean;
  onDelete: (lead: LeadItem) => void;
  onRatingChange: (lead: LeadItem, rating: number) => void;
  onOpenActivities: (lead: LeadItem) => void;
}

/** The compact operational summary used only by the Leads table view. */
export function useLeadColumns({
  stageById,
  canUpdate,
  canDelete,
  onDelete,
  onRatingChange,
  onOpenActivities,
}: LeadColumnOptions): ColumnDef<LeadItem>[] {
  const { t, lang } = useI18n();
  const countryFlags = new Map(
    getCountryOptions(lang).map(({ isoCode, flag }) => [isoCode, flag]),
  );

  return [
    {
      id: "name",
      sortable: true,
      sortField: "displayName",
      header: t.crmLeads.name,
      width: "15rem",
      cell: (item) => (
        <Link
          href={`/crm/leads/${item.id}`}
          className={cn(
            "flex min-w-48 items-center gap-1.5 rounded-xs text-foreground hover:underline",
            focusRing,
          )}
        >
          <span className="min-w-0 truncate font-medium">{item.leadName}</span>
          <Badge tone="neutral" className={COMPACT_BADGE}>
            {item.leadProfileType === "CORPORATE"
              ? t.crmLeads.card.company
              : t.crmLeads.card.individual}
          </Badge>
        </Link>
      ),
    },
    {
      id: "contact",
      header: t.crmLeads.contact,
      width: "15rem",
      cell: (item) => {
        const contact = item.leadProfileType === "CORPORATE" ? item.primaryContact : null;
        const name = contact?.displayName || item.email || t.crmLeads.unavailable;
        const detail = contact?.jobTitle || contact?.email || "";
        const title = detail ? `${name} · ${detail}` : name;
        return (
          <Link
            href={`/crm/leads/${item.id}`}
            className={cn(
              "flex min-w-48 items-center gap-1.5 whitespace-nowrap rounded-xs hover:underline",
              focusRing,
            )}
            title={title}
          >
            <span className="max-w-36 truncate">{name}</span>
            {detail && <span className="max-w-28 truncate text-muted-foreground">{detail}</span>}
            {contact?.isPrimary && (
              <Badge tone="neutral" className={COMPACT_BADGE}>
                {t.crmLeads.card.primary}
              </Badge>
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
        const phone = item.leadProfileType === "CORPORATE"
          ? item.primaryContact?.phones[0] || item.phone
          : item.phone;
        return (
          <span className="flex min-w-48 items-center gap-1 whitespace-nowrap">
            <Link
              href={`/crm/leads/${item.id}`}
              dir="ltr"
              className={cn(
                "min-w-0 flex-1 truncate rounded-xs text-start hover:underline",
                focusRing,
              )}
            >
              {phone || t.crmLeads.unavailable}
            </Link>
            {phone && <LeadPhoneActionsRow phone={phone} country={item.country} actionsOnly />}
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
        const iso = /^[A-Z]{2}$/u.test(stored.toUpperCase())
          ? stored.toUpperCase()
          : countryIsoFromName(stored);
        const flag = iso ? countryFlags.get(iso) ?? "" : "";
        return (
          <span className="flex min-w-24 items-center gap-1.5 whitespace-nowrap">
            {flag && <span aria-hidden="true" className="text-sm leading-none">{flag}</span>}
            <span className="max-w-28 truncate">{stored || t.crmLeads.unavailable}</span>
          </span>
        );
      },
    },
    {
      id: "stage",
      header: t.crmLeads.stage,
      width: "8rem",
      cell: (item) => {
        const stage = stageById.get(item.stageId);
        const role = stage ? resolveStatusRole("LeadStageFlag", stage.flag) : undefined;
        return (
          <Badge tone={role ? ROLE_TONE[role] : "neutral"} className="whitespace-nowrap">
            {stage ? localizedName(stage, lang) : t.crmLeads.unavailable}
          </Badge>
        );
      },
    },
    {
      id: "source",
      header: t.crmLeads.source,
      width: "10rem",
      cell: (item) => {
        const source = localizedValue(item.sourceNameAr, item.sourceNameEn, lang);
        return (
          <span className="flex min-w-28 items-center gap-1.5 whitespace-nowrap">
            <AcquisitionSourceIcon source={{ iconUrl: item.sourceIconUrl }} />
            <span className="max-w-32 truncate">{source || t.crmLeads.unavailable}</span>
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
          ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
          : "";
        return <span className="block max-w-36 truncate">{name || t.crmLeads.unavailable}</span>;
      },
    },
    {
      id: "followUp",
      header: t.crmLeads.followUp,
      width: "13rem",
      cell: (item) => {
        const state = leadActivityState(item.nextActivity);
        const stateLabel = t.crmLeads.card.activityStates[state];
        return (
          <span className="flex min-w-40 items-center gap-2 whitespace-nowrap">
            <LeadRating
              value={item.rating}
              disabled={!canUpdate(item)}
              onChange={(rating) => onRatingChange(item, rating)}
              labels={{
                group: formatTemplate(t.crmLeads.card.ratingValue, {
                  count: formatNumber(item.rating, lang),
                  max: formatNumber(MAX_LEAD_RATING, lang),
                }),
                setStars: t.crmLeads.card.rateStars,
                clear: t.crmLeads.card.clearRating,
              }}
            />
            <Button
              variant="ghost"
              size="xs"
              className="min-w-0 gap-1 px-1"
              aria-label={formatTemplate(t.crmLeads.card.activityOpen, { state: stateLabel })}
              title={formatTemplate(t.crmLeads.card.activityOpen, { state: stateLabel })}
              onClick={(event) => {
                event.stopPropagation();
                onOpenActivities(item);
              }}
            >
              <Activity
                strokeWidth={2.5}
                className={cn(iconSize({ size: "sm" }), LEAD_ACTIVITY_MARK[state])}
                aria-hidden="true"
              />
              <span className="max-w-24 truncate text-muted-foreground">{stateLabel}</span>
            </Button>
          </span>
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
        canDelete(item) ? (
          <Button
            variant="ghost"
            size="xs"
            className="w-7 px-0"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
            aria-label={`${t.common.delete}: ${item.leadName}`}
          >
            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
          </Button>
        ) : null,
    },
  ];
}
