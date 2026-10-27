"use client";

import { Badge, TagChip, toTagColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";

export function CustomerBoardTags({ tags, expanded }: { tags: CustomerProfileItem["tags"]; expanded: boolean }) {
  const { t } = useI18n();
  if (tags.length === 0) return null;
  const visible = expanded ? tags : tags.slice(0, 2);
  return (
    <div className="flex flex-col gap-1">
      {expanded && <span className="text-caption text-muted-foreground">{t.crmCustomerProfiles.ui.board.tags}</span>}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {visible.map((tag) => toTagColor(tag.backgroundColor, tag.textColor) ? (
          <TagChip key={tag.id} size="sm" label={tag.name} backgroundColor={tag.backgroundColor}
            textColor={tag.textColor} className="h-6 max-w-28 rounded-md font-medium" />
        ) : <Badge key={tag.id} size="sm" tone="neutral" className="max-w-28"><bdi className="truncate">{tag.name}</bdi></Badge>)}
        {tags.length > visible.length && <Badge size="sm" tone="neutral">{formatTemplate(t.crmLeads.card.moreTags, { count: String(tags.length - visible.length) })}</Badge>}
      </div>
    </div>
  );
}
