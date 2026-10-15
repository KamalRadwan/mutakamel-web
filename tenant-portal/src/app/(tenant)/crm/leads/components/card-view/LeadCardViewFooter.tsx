"use client";

import { Mail } from "lucide-react";
import { cn, focusRing, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { localizedValue } from "@/lib/format/localized";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { leadOwnerInitials } from "../../lead-card-contract";
import type {
  LeadDocumentCounts,
  LeadDocumentCountVisibility,
} from "../../lead-document-counts-contract";
import { leadEditablePrimaryPhone } from "../../lead-phone-patch";
import type { LeadItem } from "../../hooks/useLeads";
import { LeadPhoneActionsRow } from "../LeadPhoneActionsRow";
import { LeadFollowUp } from "../table-view/LeadFollowUp";
import { LeadCardDocumentCounts } from "./LeadCardDocumentCounts";

export interface LeadCardViewFooterProps {
  lead: LeadItem;
  counts: LeadDocumentCounts | undefined;
  countVisibility: LeadDocumentCountVisibility;
  canRate: boolean;
  onRatingChange: (rating: number) => void;
  onOpenActivities: () => void;
}

/** Everything on the card a user can press, outside its activation surface. */
export function LeadCardViewFooter({
  lead,
  counts,
  countVisibility,
  canRate,
  onRatingChange,
  onOpenActivities,
}: LeadCardViewFooterProps) {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;
  const phone = leadEditablePrimaryPhone(lead) || lead.phone || lead.phones[0];
  const email = lead.primaryContact?.email || lead.email;
  const source = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang);
  const ownerName = [lead.owner?.firstName, lead.owner?.lastName].filter(Boolean).join(" ");
  const ownerInitials = (lead.owner && leadOwnerInitials(lead.owner)) || "";

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-1.5 text-xs">
      {phone && <LeadPhoneActionsRow phone={phone} country={lead.country} />}

      {email && (
        <a
          href={`mailto:${email}`}
          aria-label={formatTemplate(card.emailAction, { value: email })}
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-xs text-muted-foreground hover:text-foreground hover:underline",
            focusRing,
          )}
        >
          <Mail className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate" dir="ltr">{email}</span>
        </a>
      )}

      {source && (
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <AcquisitionSourceIcon source={{ iconUrl: lead.sourceIconUrl }} />
          <span className="truncate">{formatTemplate(card.source, { name: source })}</span>
        </span>
      )}

      <LeadCardDocumentCounts counts={counts} visibility={countVisibility} />

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border pt-1.5">
        <LeadFollowUp
          lead={lead}
          canRate={canRate}
          onRatingChange={onRatingChange}
          onOpenActivities={onOpenActivities}
        />
        {ownerInitials && (
          <span
            className="flex min-w-0 items-center gap-1.5"
            title={formatTemplate(card.owner, { name: ownerName })}
          >
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-xs bg-muted font-medium text-muted-foreground"
            >
              {ownerInitials}
            </span>
            <span className="max-w-24 truncate text-foreground">{ownerName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
