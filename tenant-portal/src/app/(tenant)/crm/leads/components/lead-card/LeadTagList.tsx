"use client";

import { cardColorFill, cn } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import type { LeadTag } from "../../lead-card-contract";

/**
 * How many tags reach the card face.
 *
 * A lead may carry up to fifty (`MAX_TAGS_PER_ATTACH`), and a card that grew a
 * line per tag would be a different HEIGHT from its neighbours — which is what
 * the windowed column's row estimate is measured against, and what
 * `BoardCardModel.className` is forbidden from touching for the same reason.
 * Three fits the 280px column on at most two lines in either language.
 */
const MAX_VISIBLE_LEAD_TAGS = 3;

export interface LeadTagListProps {
  tags: LeadTag[];
  /** `{count}` more — the overflow chip's whole text. */
  moreLabel: string;
}

/**
 * The lead's tags, under the contact name.
 *
 * Chips, not `Badge`: a badge states a record's STATE, and the primitive says
 * so in uppercase semibold. A tag is a value the tenant chose, so it renders
 * in sentence case at the muted step — docs/design/patterns.md, and the
 * compact-label rule that a pill's label stays on one line.
 *
 * The colour is a leading dot rather than the chip's own background. It keeps
 * every chip on the one `bg-muted`/`text-muted-foreground` pair whose contrast
 * is already known, and it keeps the colour decorative — the tag's name is
 * beside it, so nothing here is carried by hue alone.
 */
export function LeadTagList({ tags, moreLabel }: LeadTagListProps) {
  if (tags.length === 0) return null;

  const visible = tags.slice(0, MAX_VISIBLE_LEAD_TAGS);
  const hidden = tags.slice(MAX_VISIBLE_LEAD_TAGS);

  return (
    <ul className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <li
          key={tag.id}
          title={tag.name}
          className="flex min-w-0 max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground"
        >
          {tag.color && (
            <span
              className={cn("size-1.5 shrink-0 rounded-full", cardColorFill(tag.color))}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{tag.name}</span>
        </li>
      ))}

      {/* The names past the third are still announced, and the card opens the
          lead, where the full set is listed. What must not happen is the card
          silently claiming three tags when there are nine. */}
      {hidden.length > 0 && (
        <li className="rounded-sm bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
          <span aria-hidden="true">{formatTemplate(moreLabel, { count: hidden.length })}</span>
          <span className="sr-only">{hidden.map((tag) => tag.name).join(", ")}</span>
        </li>
      )}
    </ul>
  );
}
