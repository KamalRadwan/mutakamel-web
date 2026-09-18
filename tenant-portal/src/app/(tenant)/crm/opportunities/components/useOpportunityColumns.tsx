"use client";

import Link from "next/link";
import { Activity, Calendar, Trash2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  StatusBadge,
  cn,
  focusRing,
  iconSize,
  resolveStatusRole,
  type BadgeProps,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { AcquisitionSourceIcon } from "../../shared/components/AcquisitionSourceIcon";
import { CrmRating } from "../../shared/components/CrmRating";
import { CRM_ACTIVITY_MARK } from "../../shared/crm-activity-tone";
import { opportunityActivityDisplayState } from "../opportunity-read-model";
import type { OpportunityStage } from "../hooks/pipeline-types";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";
import { OpportunityPhoneActionsRow } from "./OpportunityPhoneActionsRow";

const ROLE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

const COMPACT_BADGE =
  "shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal";

export interface OpportunityColumnOptions {
  stageById: Map<string, OpportunityStage>;
  canUpdate?: (item: OpportunityListItem) => boolean;
  canDelete?: (item: OpportunityListItem) => boolean;
  onDelete: (item: OpportunityListItem) => void;
  onImportanceChange?: (item: OpportunityListItem, importance: number) => void;
  onOpenActivities?: (item: OpportunityListItem) => void;
  importances?: Record<string, number>;
}

/** Compact Opportunity table backed by the enriched list projection. */
export function useOpportunityColumns({
  stageById,
  canUpdate,
  canDelete,
  onDelete,
  onImportanceChange,
  onOpenActivities,
  importances,
}: OpportunityColumnOptions): ColumnDef<OpportunityListItem>[] {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;
  const oppCopy = t.crmOpportunities;
  const opportunityHref = (item: OpportunityListItem) =>
    `/crm/opportunities/${encodeURIComponent(item.id)}`;
  const countryFlags = new Map(
    getCountryOptions(lang).map(({ isoCode, flag }) => [isoCode, flag]),
  );

  return [
    {
      id: "title",
      sortable: true,
      header: oppCopy.title,
      width: "16rem",
      cell: (item) => (
        <Link
          href={opportunityHref(item)}
          className={cn(
            "flex min-w-48 items-center gap-1.5 rounded-xs text-foreground hover:underline",
            focusRing,
          )}
        >
          <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
          <StatusBadge value={item.status} kind="OpportunityStatus" />
        </Link>
      ),
    },
    {
      id: "customer",
      header: oppCopy.customer,
      width: "15rem",
      cell: (item) => {
        const name =
          (item.customerProfileType === "CORPORATE" ? item.customerCompanyName : null) ??
          item.customerDisplayName ??
          oppCopy.notProvided;
        return (
          <Link
            href={opportunityHref(item)}
            className={cn(
              "flex min-w-48 items-center gap-1.5 rounded-xs hover:underline",
              focusRing,
            )}
          >
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {item.customerProfileType && (
              <Badge tone="neutral" className={COMPACT_BADGE}>
                {item.customerProfileType === "CORPORATE" ? card.company : card.individual}
              </Badge>
            )}
          </Link>
        );
      },
    },
    {
      id: "contact",
      header: t.crmLeads.contact,
      width: "15rem",
      cell: (item) => {
        const contact = item.customerProfileType === "CORPORATE" ? item.primaryContact : null;
        const name = contact?.displayName ?? item.customerEmail ?? oppCopy.notProvided;
        const detail = contact?.jobTitle ?? contact?.email ?? "";
        return (
          <Link
            href={opportunityHref(item)}
            className={cn(
              "flex min-w-48 items-center gap-1.5 whitespace-nowrap rounded-xs hover:underline",
              focusRing,
            )}
            title={detail ? `${name} · ${detail}` : name}
          >
            <span className="max-w-36 truncate">{name}</span>
            {detail && <span className="max-w-28 truncate text-muted-foreground">{detail}</span>}
            {contact?.isPrimary && (
              <Badge tone="brand" className={COMPACT_BADGE}>{card.primary}</Badge>
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
          item.customerProfileType === "CORPORATE"
            ? item.primaryContact?.phones[0] ?? item.customerPhone
            : item.customerPhone;
        return (
          <span className="flex min-w-48 items-center gap-1 whitespace-nowrap">
            <span dir="ltr" className="min-w-0 flex-1 truncate text-start">
              {phone ?? oppCopy.notProvided}
            </span>
            {phone && (
              <OpportunityPhoneActionsRow
                phone={phone}
                country={item.customerCountry}
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
        const stored = item.customerCountry?.trim() ?? "";
        const iso = /^[A-Z]{2}$/u.test(stored.toUpperCase())
          ? stored.toUpperCase()
          : countryIsoFromName(stored);
        const flag = iso ? countryFlags.get(iso) ?? "" : "";
        return (
          <span className="flex min-w-24 items-center gap-1.5 whitespace-nowrap">
            {flag && <span aria-hidden="true" className="text-sm leading-none">{flag}</span>}
            <span className="max-w-28 truncate">{stored || oppCopy.notProvided}</span>
          </span>
        );
      },
    },
    {
      id: "stage",
      header: oppCopy.stage,
      width: "9rem",
      cell: (item) => {
        const stage = stageById.get(item.stageId);
        const role = stage ? resolveStatusRole("OpportunityStageFlag", stage.flag) : undefined;
        return (
          <Badge tone={role ? ROLE_TONE[role] : "neutral"} className="whitespace-nowrap">
            {stage ? localizedName(stage, lang) : oppCopy.notProvided}
          </Badge>
        );
      },
    },
    {
      id: "source",
      header: t.crmLeads.source,
      width: "10rem",
      cell: (item) => (
        <span className="flex min-w-28 items-center gap-1.5 whitespace-nowrap text-xs">
          <AcquisitionSourceIcon source={{ iconUrl: item.leadSourceIconUrl }} />
          <span className="max-w-32 truncate">
            {item.leadSourceName ?? oppCopy.notProvided}
          </span>
        </span>
      ),
    },
    {
      id: "owner",
      header: oppCopy.owner,
      width: "11rem",
      cell: (item) => {
        const initials = item.ownerDisplayName
          ?.split(/\s+/u)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("");
        return (
          <span className="flex min-w-36 items-center gap-1.5">
            <Avatar className="size-6 shrink-0">
              <AvatarImage src={item.ownerAvatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-2xs">{initials || "?"}</AvatarFallback>
            </Avatar>
            <span className="truncate">{item.ownerDisplayName ?? oppCopy.notProvided}</span>
          </span>
        );
      },
    },
    {
      id: "expectedClose",
      header: oppCopy.expectedClose,
      sortable: true,
      sortField: "expectedCloseDate",
      width: "10rem",
      cell: (item) =>
        item.expectedCloseDate ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
            <Calendar className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
            <span>{formatDate(item.expectedCloseDate, lang)}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{oppCopy.notProvided}</span>
        ),
    },
    {
      id: "followUp",
      header: t.crmLeads.followUp,
      width: "13rem",
      cell: (item) => {
        const currentImportance = importances?.[item.id] ?? item.importance;
        const canEdit = canUpdate ? canUpdate(item) : false;
        const state = opportunityActivityDisplayState(item.activityState);
        const stateLabel = card.activityStates[state];
        return (
          <span className="flex min-w-40 items-center gap-2 whitespace-nowrap">
            <CrmRating
              value={currentImportance}
              disabled={!canEdit}
              onChange={(next) => onImportanceChange?.(item, next)}
              labels={{
                group: oppCopy.importance,
                setStars: oppCopy.setImportance,
                clear: oppCopy.clearImportance,
              }}
            />
            {onOpenActivities && (
              <Button
                variant="ghost"
                size="xs"
                className="min-w-0 gap-1 px-1"
                aria-label={formatTemplate(card.activityOpen, { state: stateLabel })}
                title={formatTemplate(card.activityOpen, { state: stateLabel })}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenActivities(item);
                }}
              >
                <Activity
                  strokeWidth={2.5}
                  className={cn(iconSize({ size: "sm" }), CRM_ACTIVITY_MARK[state])}
                  aria-hidden="true"
                />
                <span className="max-w-24 truncate text-muted-foreground">{stateLabel}</span>
              </Button>
            )}
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
        (canDelete ? canDelete(item) : true) ? (
          <Button
            variant="ghost"
            size="xs"
            className="w-7 px-0"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
            aria-label={`${t.common.delete}: ${item.title}`}
          >
            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
          </Button>
        ) : null,
    },
  ];
}
