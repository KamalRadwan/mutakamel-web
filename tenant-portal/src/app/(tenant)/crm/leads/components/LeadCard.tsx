"use client";

import { Building2, UserRound } from "lucide-react";
import { Badge, cn, iconSize } from "@/design-system";
import { leadCardHeading } from "../lead-card-contract";
import type { LeadItem } from "../hooks/useLeads";
import { LeadTagList } from "./lead-card/LeadTagList";

export interface LeadCardLabels {
  /** `{count}` more — the tag row's overflow chip. */
  moreTags: string;
  individual: string;
  company: string;
}

// What the ACTIVATION SURFACE holds, and nothing else: the identity lines and
// the lead's tags, no control. Everything a user can press — the rating, the
// activity mark, the overflow menu — lives in WorkspaceCard's `footer` and
// `actions`, outside both this surface and @hello-pangea/dnd's drag handle.
// See useLeadCardSlots.
//
// The tags sit under the CONTACT rather than under the title, because they
// describe the lead the contact belongs to and the two identity lines have to
// stay adjacent to read as one block. They are bounded — see LeadTagList — so
// the card's height still moves by at most one row, the same way the optional
// contact line already does.
//
// The Board keeps this compact identity-only body because the stage is already
// the column. Card View adds its richer country, contact and document details
// through `LeadCardViewFooter`, while reusing this same heading.
export function LeadCard({ lead, labels }: { lead: LeadItem; labels: LeadCardLabels }) {
  const { title, contactName } = leadCardHeading(lead);
  const isCompany = lead.leadProfileType === "CORPORATE";
  const TypeIcon = isCompany ? Building2 : UserRound;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <TypeIcon
          className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <Badge
          tone="neutral"
          className="shrink-0 px-1 py-0 text-xs font-medium leading-none normal-case tracking-normal"
        >
          {isCompany ? labels.company : labels.individual}
        </Badge>
      </div>
      {contactName && (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className={cn(iconSize({ size: "sm" }), "shrink-0")} aria-hidden="true" />
          <span className="truncate">{contactName}</span>
        </span>
      )}
      <LeadTagList tags={lead.tags} moreLabel={labels.moreTags} />
    </div>
  );
}
