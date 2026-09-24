"use client";

import { Tag } from "lucide-react";
import { TagChip, TagChipOverflow, iconSize } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTag } from "../../../shared/tag-contract";

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
  tags: CrmTag[];
  /** `{count}` more — the overflow chip's whole text. */
  moreLabel: string;
}

/**
 * The lead's tags, under the contact name.
 *
 * Every chip is a `TagChip`: a coloured tag draws its own background/text
 * pair, an uncoloured one is the neutral theme-aware chip. The tag's name is
 * always the text, so nothing here is carried by hue alone.
 */
export function LeadTagList({ tags, moreLabel }: LeadTagListProps) {
  if (tags.length === 0) return null;

  const visible = tags.slice(0, MAX_VISIBLE_LEAD_TAGS);
  const hidden = tags.slice(MAX_VISIBLE_LEAD_TAGS);

  return (
    <ul className="flex flex-wrap items-center gap-1 pt-0.5">
      <li className="flex shrink-0 items-center text-muted-foreground" aria-hidden="true">
        <Tag className={iconSize({ size: "sm" })} />
      </li>
      {visible.map((tag) => (
        <li key={tag.id} className="flex min-w-0 max-w-full">
          <TagChip label={tag.name} backgroundColor={tag.backgroundColor} textColor={tag.textColor} />
        </li>
      ))}

      {/* The names past the third are still announced, and the card opens the
          lead, where the full set is listed. */}
      {hidden.length > 0 && (
        <li className="flex">
          <TagChipOverflow
            label={formatTemplate(moreLabel, { count: hidden.length })}
            hiddenNames={hidden.map((tag) => tag.name)}
          />
        </li>
      )}
    </ul>
  );
}
