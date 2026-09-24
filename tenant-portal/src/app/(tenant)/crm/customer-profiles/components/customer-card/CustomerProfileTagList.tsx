"use client";

import { Tag } from "lucide-react";
import { TagChip, TagChipOverflow, cn, iconSize } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTag } from "../../../shared/tag-contract";

export function CustomerProfileTagList({
  tags,
  moreLabel,
  maxVisible = 3,
  compact = false,
}: {
  tags: CrmTag[];
  moreLabel: string;
  maxVisible?: number;
  compact?: boolean;
}) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, maxVisible);
  const hidden = tags.slice(maxVisible);
  const size = compact ? "xs" : "sm";

  return (
    <ul
      className={cn(
        "flex items-center gap-1 pt-0.5",
        compact ? "min-w-0 flex-nowrap overflow-hidden" : "flex-wrap",
      )}
    >
      <li
        className="flex shrink-0 items-center text-muted-foreground"
        aria-hidden="true"
      >
        <Tag className={iconSize({ size: "sm" })} />
      </li>
      {visible.map((tag) => (
        <li key={tag.id} className="flex min-w-0 max-w-full">
          <TagChip
            label={tag.name}
            backgroundColor={tag.backgroundColor}
            textColor={tag.textColor}
            size={size}
            className={compact ? "max-w-20" : undefined}
          />
        </li>
      ))}
      {hidden.length > 0 && (
        <li className="flex shrink-0">
          <TagChipOverflow
            label={formatTemplate(moreLabel, { count: hidden.length })}
            hiddenNames={hidden.map((tag) => tag.name)}
            size={size}
          />
        </li>
      )}
    </ul>
  );
}
