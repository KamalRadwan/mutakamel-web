"use client";

import { Tag } from "lucide-react";
import { cn, iconSize } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import type { CustomerProfileTag } from "../../hooks/useCustomerProfiles";

export function CustomerProfileTagList({
  tags,
  moreLabel,
  maxVisible = 3,
  compact = false,
}: {
  tags: CustomerProfileTag[];
  moreLabel: string;
  maxVisible?: number;
  compact?: boolean;
}) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, maxVisible);
  const hidden = tags.slice(maxVisible);

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
        <li
          key={tag.id}
          title={tag.name}
          className={cn(
            "inline-flex min-w-0 max-w-full items-center rounded-full border border-border/70 bg-muted/60 font-medium leading-none text-muted-foreground",
            compact ? "max-w-20 px-1.5 py-0.5 text-2xs" : "px-2 py-0.5 text-xs",
          )}
        >
          <span className="truncate">{tag.name}</span>
        </li>
      ))}
      {hidden.length > 0 && (
        <li
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted/60 font-medium leading-none text-muted-foreground",
            compact ? "px-1 py-0.5 text-2xs" : "px-1.5 py-0.5 text-xs",
          )}
        >
          <span aria-hidden="true">
            {formatTemplate(moreLabel, { count: hidden.length })}
          </span>
          <span className="sr-only">
            {hidden.map((tag) => tag.name).join(", ")}
          </span>
        </li>
      )}
    </ul>
  );
}
