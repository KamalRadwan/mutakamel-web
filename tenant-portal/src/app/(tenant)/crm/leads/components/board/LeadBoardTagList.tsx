"use client";

import { Tag } from "lucide-react";
import { TagChip, TagChipOverflow, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CrmTag } from "../../../shared/tag-contract";

interface LeadBoardTagListProps {
  tags: readonly CrmTag[];
  /**
   * How many chips reach the card face. Three fits a board column on at most
   * two lines in either language; the expanded card passes the full count.
   */
  limit: number;
}

/** The lead's tags. The names past the limit are still announced by the overflow chip. */
export function LeadBoardTagList({ tags, limit }: LeadBoardTagListProps) {
  const { t } = useI18n();
  if (tags.length === 0) return null;

  const visible = tags.slice(0, limit);
  const hidden = tags.slice(limit);

  return (
    <ul className="flex flex-wrap items-center gap-1">
      <li className="flex shrink-0 items-center text-muted-foreground" aria-hidden="true">
        <Tag className={iconSize({ size: "sm" })} />
      </li>
      {visible.map((tag) => (
        <li key={tag.id} className="flex min-w-0 max-w-full">
          <TagChip label={tag.name} backgroundColor={tag.backgroundColor} textColor={tag.textColor} />
        </li>
      ))}
      {hidden.length > 0 && (
        <li className="flex">
          <TagChipOverflow
            label={formatTemplate(t.crmLeads.card.moreTags, { count: hidden.length })}
            hiddenNames={hidden.map((tag) => tag.name)}
          />
        </li>
      )}
    </ul>
  );
}
