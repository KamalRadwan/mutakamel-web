"use client";

import { X } from "lucide-react";
import { Badge, Button, Tooltip, TooltipContent, TooltipTrigger, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { wireLabel } from "@/lib/format/wire-label";
import { activityLabel } from "../activity-presentation";
import type { ActivityRelatedFilter } from "./activity-workspace-url";

export interface ActivityRelatedChipProps {
  related: ActivityRelatedFilter;
  onRemove: () => void;
}

/**
 * The deep-link filter a record screen hands over, as one removable chip beside
 * FilterBar's: "Related record: Lead" for one record, "Related to: Leads" for a
 * whole record type. It is not one of FilterBar's filters — nothing in the
 * filter popover could set it — so it draws the same chip itself.
 */
export function ActivityRelatedChip({ related, onRemove }: ActivityRelatedChipProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const filters = copy.workspace.filters;
  const text = related.id
    ? formatTemplate(filters.related, { type: activityLabel(copy, "targetTypes", related.type) })
    : formatTemplate(filters.relatedType, {
        type: wireLabel(filters.relatedTypes, related.type, copy.unknownValue, "activities.workspace.filters.relatedTypes"),
      });
  const removeLabel = formatTemplate(t.filters.remove, { label: text });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone="neutral" className="max-w-64 gap-0.5 pe-0.5">
        <span>{text}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              aria-label={removeLabel}
              onClick={onRemove}
              className="size-4 shrink-0 cursor-pointer rounded-xs p-0!"
            >
              <X className={iconSize({ size: "xs" })} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{removeLabel}</TooltipContent>
        </Tooltip>
      </Badge>
    </div>
  );
}
