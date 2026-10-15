"use client";

import { ChevronsRight } from "lucide-react";
import { Badge, Button, cn, iconSize, mirrorInRtl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

interface LeadBoardCollapsedColumnProps {
  label: string;
  count: number;
  outcomeClassName: string;
  onExpand: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * A collapsed stage: its name, read top to bottom, and its count. A card
 * dragged over it and held there opens it — see `useLeadBoardView`.
 */
export function LeadBoardCollapsedColumn({
  label,
  count,
  outcomeClassName,
  onExpand,
  onPointerEnter,
  onPointerLeave,
}: LeadBoardCollapsedColumnProps) {
  const { t } = useI18n();
  const expandLabel = `${t.views.expandColumn}: ${label}`;

  return (
    <div
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      className={cn(
        "flex h-full min-h-0 w-(--size-column-collapsed) shrink-0 flex-col items-center gap-1.5 rounded-md border border-border bg-card py-1.5",
        outcomeClassName,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-expanded={false}
        aria-label={expandLabel}
        title={expandLabel}
        onClick={onExpand}
      >
        <ChevronsRight className={cn(iconSize({ size: "sm" }), mirrorInRtl)} aria-hidden="true" />
      </Button>
      <span className="min-h-0 truncate text-xs font-medium text-foreground [writing-mode:vertical-rl]">
        {label}
      </span>
      <Badge tone="neutral">{count}</Badge>
    </div>
  );
}
