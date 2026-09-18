"use client";

import {
  BriefcaseBusiness,
  FileText,
  Mail,
  MapPin,
  ReceiptText,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { Badge, cn, iconSize } from "@/design-system";
import type { LeadItem } from "../../hooks/useLeads";
import type {
  LeadDocumentCounts,
  LeadDocumentCountVisibility,
} from "../../lead-document-counts-contract";
import type { LeadCardFooterLabels } from "./LeadCardFooter";
import { LeadCardFooter } from "./LeadCardFooter";
import { LeadPhoneActionsRow } from "../LeadPhoneActionsRow";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";

export interface LeadCardViewFooterLabels extends LeadCardFooterLabels {
  emailAction: string;
  source: string;
  salesperson: string;
  country: string;
  primary: string;
  position: string;
  contactEmailAction: string;
  quotations: string;
  salesOrders: string;
  invoices: string;
}

/** The richer Card View footer. All controls remain outside the card's open surface. */
export function LeadCardViewFooter({
  lead,
  source,
  sourceIconUrl,
  countryFlag,
  counts,
  countVisibility,
  onRatingChange,
  isRatingDisabled,
  onOpenActivities,
  labels,
}: {
  lead: LeadItem;
  source: string;
  sourceIconUrl: string | null;
  countryFlag: string;
  counts?: LeadDocumentCounts;
  countVisibility?: LeadDocumentCountVisibility;
  onRatingChange: (next: number) => void;
  isRatingDisabled?: boolean;
  onOpenActivities: () => void;
  labels: LeadCardViewFooterLabels;
}) {
  const ownerName = lead.owner
    ? [lead.owner.firstName, lead.owner.lastName].filter(Boolean).join(" ")
    : "";
  const contact = lead.leadProfileType === "CORPORATE" ? lead.primaryContact : null;
  const countRows = [
    { key: "quotations" as const, icon: FileText, abbreviation: "PQ", label: labels.quotations },
    { key: "salesOrders" as const, icon: ShoppingCart, abbreviation: "SO", label: labels.salesOrders },
    { key: "invoices" as const, icon: ReceiptText, abbreviation: "IN", label: labels.invoices },
  ];
  const hasVisibleCounts = countVisibility
    ? countRows.some(({ key }) => countVisibility[key])
    : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-border pt-1.5">
      {lead.country && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          {countryFlag && (
            <span aria-hidden="true" className="shrink-0 text-sm leading-none">{countryFlag}</span>
          )}
          <span className="truncate">{labels.country}</span>
        </div>
      )}

      {lead.phones.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {lead.phones.map((phone) => (
            <LeadPhoneActionsRow key={phone} phone={phone} country={lead.country} />
          ))}
        </div>
      )}

      {lead.email && (
        <a
          href={`mailto:${lead.email}`}
          aria-label={labels.emailAction}
          title={labels.emailAction}
          className="flex min-w-0 items-center gap-1.5 rounded-xs text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mail className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate" dir="ltr">{lead.email}</span>
        </a>
      )}

      {contact && (
        <div className="mt-0.5 flex flex-col gap-1 rounded-xs bg-muted/60 p-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
            <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium">{contact.displayName}</span>
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
              <BriefcaseBusiness className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
              <span className="truncate">{labels.position}</span>
            </div>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              aria-label={labels.contactEmailAction}
              title={labels.contactEmailAction}
              className="flex min-w-0 items-center gap-1.5 rounded-xs text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mail className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
              <span className="truncate" dir="ltr">{contact.email}</span>
            </a>
          )}
          {contact.phones.map((phone) => (
            <LeadPhoneActionsRow key={phone} phone={phone} country={lead.country} />
          ))}
        </div>
      )}

      {source && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <AcquisitionSourceIcon source={{ iconUrl: sourceIconUrl }} />
          <span className="truncate">{labels.source}</span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-1.5">
        {counts && countVisibility && hasVisibleCounts && (
          <div className="grid grid-cols-3 gap-1">
            {countRows.map(({ key, icon: CountIcon, abbreviation, label }) => countVisibility[key] && (
              <div
                key={key}
                className="flex min-w-0 items-center gap-1 rounded-xs bg-muted/60 px-1.5 py-1 text-xs text-muted-foreground"
                title={label}
              >
                <CountIcon className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
                <span className="truncate">{abbreviation}: {counts[key] ?? "—"}</span>
              </div>
            ))}
          </div>
        )}

        {ownerName && (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
            <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")} aria-hidden="true" />
            <span className="truncate font-medium">{labels.salesperson}</span>
          </div>
        )}

        <LeadCardFooter
          nextActivity={lead.nextActivity}
          owner={null}
          rating={lead.rating}
          onRatingChange={onRatingChange}
          isRatingDisabled={isRatingDisabled}
          onOpenActivities={onOpenActivities}
          labels={labels}
        />
      </div>
    </div>
  );
}
