"use client";

import { Mail, Phone, Share2 } from "lucide-react";
import { Badge, type BadgeProps, resolveStatusRole } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

const ROLE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

// The card body the board and the card view both render. Content only — the
// surface, the focus ring, the selection checkbox, the "Move to…" menu and
// the delete action all live outside it on WorkspaceCard.
export function LeadCard({ lead, stage }: { lead: LeadItem; stage: LeadStage | undefined }) {
  const { lang } = useI18n();
  const role = stage ? resolveStatusRole("LeadStageFlag", stage.flag) : undefined;
  const sourceName = localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{lead.leadName}</span>
      <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
      {lead.email && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{lead.email}</span>
        </div>
      )}
      {lead.phone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{lead.phone}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
        <Badge tone={role ? ROLE_TONE[role] : "neutral"}>
          {stage ? localizedName(stage, lang) : lead.stageId}
        </Badge>
        {sourceName && (
          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Share2 className="size-3 shrink-0" aria-hidden="true" />
            <span className="max-w-24 truncate">{sourceName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
