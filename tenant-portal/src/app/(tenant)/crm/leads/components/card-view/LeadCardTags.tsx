"use client";

import { Tag } from "lucide-react";
import { TagChip, TagChipOverflow, iconSize } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTag } from "../../../shared/tag-contract";

// Three chips fit a grid card on at most two lines in either language, so a
// heavily tagged lead does not make its card taller than its neighbours.
const MAX_VISIBLE_TAGS = 3;

/** The lead's tags; the names past the third are still announced. */
export function LeadCardTags({ tags, moreLabel }: { tags: readonly CrmTag[]; moreLabel: string }) {
  if (tags.length === 0) return null;
  const hidden = tags.slice(MAX_VISIBLE_TAGS);

  return (
    <ul className="flex flex-wrap items-center gap-1">
      <li className="flex shrink-0 items-center text-muted-foreground" aria-hidden="true">
        <Tag className={iconSize({ size: "sm" })} />
      </li>
      {tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
        <li key={tag.id} className="flex min-w-0 max-w-full">
          <TagChip label={tag.name} backgroundColor={tag.backgroundColor} textColor={tag.textColor} />
        </li>
      ))}
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
