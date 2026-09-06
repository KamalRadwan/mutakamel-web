"use client";

import { leadCardHeading } from "../lead-card-contract";
import type { LeadItem } from "../hooks/useLeads";
import { LeadTagList } from "./lead-card/LeadTagList";

export interface LeadCardLabels {
  /** `{count}` more — the tag row's overflow chip. */
  moreTags: string;
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
// Email, phone, stage and source left this card with the redesign. On a board
// the stage is the column the card is standing in, and the rest is detail-screen
// material that was costing the card the room its activity mark and rating now
// use.
export function LeadCard({ lead, labels }: { lead: LeadItem; labels: LeadCardLabels }) {
  const { title, contactName } = leadCardHeading(lead);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="block truncate text-sm font-medium text-foreground">{title}</span>
      {contactName && (
        <span className="block truncate text-xs text-muted-foreground">{contactName}</span>
      )}
      <LeadTagList tags={lead.tags} moreLabel={labels.moreTags} />
    </div>
  );
}
