"use client";

import { UserRound } from "lucide-react";
import { cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { leadCardHeading } from "../../lead-card-contract";
import { formatLeadStageAge } from "../../lead-stage-age";
import type { LeadItem } from "../../hooks/useLeads";
import { LeadBoardTagList } from "./LeadBoardTagList";

const COLLAPSED_TAG_LIMIT = 3;

interface LeadBoardCardContentProps {
  lead: LeadItem;
  now: number;
  isExpanded: boolean;
}

/**
 * The card's activation surface: identity lines, tags and stage age, and no
 * control — everything pressable lives in the card's actions and footer,
 * outside the drag handle.
 */
export function LeadBoardCardContent({ lead, now, isExpanded }: LeadBoardCardContentProps) {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;
  const { title, contactName } = leadCardHeading(lead);
  const age = formatLeadStageAge(lead.stageEnteredAt, now, lang);

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
          <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate">{contactName}</span>
          {lead.primaryContact?.jobTitle && (
            <span className="truncate">{lead.primaryContact.jobTitle}</span>
          )}
        </span>
      )}
      <div className="flex items-end justify-between gap-1.5">
        <LeadBoardTagList
          tags={lead.tags}
          limit={isExpanded ? lead.tags.length : COLLAPSED_TAG_LIMIT}
        />
        {age && (
          <span className="ms-auto shrink-0 text-2xs tabular-nums text-muted-foreground">
            {formatTemplate(card.stageAge, { age })}
          </span>
        )}
      </div>
    </div>
  );
}
