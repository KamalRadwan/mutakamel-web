"use client";

import { Clock, UserRound } from "lucide-react";
import { cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { leadCardHeading } from "../../lead-card-contract";
import { formatLeadStageAge } from "../../lead-stage-age";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadCountryLabel } from "../table-view/LeadCountryLabel";
import { LeadStageBadge } from "../table-view/LeadStageBadge";
import { LeadCardTags } from "./LeadCardTags";

const ICON = cn(iconSize({ size: "sm" }), "shrink-0");

export interface LeadCardViewBodyProps {
  lead: LeadItem;
  stage: LeadStage | undefined;
  /** Epoch milliseconds, or null before the client has a clock. */
  now: number | null;
}

/**
 * The card's activation surface: identity, stage, location, need and tags —
 * no control, so pressing anywhere here opens the lead.
 */
export function LeadCardViewBody({ lead, stage, now }: LeadCardViewBodyProps) {
  const { t, lang } = useI18n();
  const views = t.crmLeadViews;
  const { title, contactName } = leadCardHeading(lead);
  const age = (now !== null && formatLeadStageAge(lead.stageEnteredAt, now, lang)) || null;
  const legalIds = [
    lead.taxNumber && formatTemplate(views.taxNumber, { value: lead.taxNumber }),
    lead.commercialRegistrationNumber &&
      formatTemplate(views.commercialRegistration, { value: lead.commercialRegistrationNumber }),
  ].filter(Boolean);
  const need = lead.interestSummary || lead.expectedNeed || lead.description;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t.crmLeads.create.types[lead.leadProfileType]}
        </span>
      </div>

      {contactName && (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className={ICON} aria-hidden="true" />
          <span className="truncate">{contactName}</span>
          {lead.primaryContact?.jobTitle && <span className="truncate">· {lead.primaryContact.jobTitle}</span>}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <LeadStageBadge stage={stage} />
        {age && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className={ICON} aria-hidden="true" />
            {formatTemplate(t.crmLeads.card.stageAge, { age })}
          </span>
        )}
      </div>

      {(lead.country.trim() || legalIds.length > 0) && (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {lead.country.trim() && <LeadCountryLabel country={lead.country} city={lead.city} />}
          {legalIds.length > 0 && <span className="truncate" dir="auto">{legalIds.join(" · ")}</span>}
        </div>
      )}

      {need && <p className="line-clamp-2 text-xs text-foreground">{need}</p>}

      <LeadCardTags tags={lead.tags} moreLabel={t.crmLeads.card.moreTags} />
    </div>
  );
}
