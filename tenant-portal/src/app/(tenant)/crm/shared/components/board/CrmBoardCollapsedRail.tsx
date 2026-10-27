"use client";

import type { DragEventHandler, MouseEventHandler } from "react";
import { ChevronsRight } from "lucide-react";
import { Button, cn, mirrorInRtl } from "@/design-system";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { crmBoardCountToneClass } from "./CrmBoardColumnHeader";

export function CrmBoardCollapsedRail({
  title,
  count,
  countTone = "default",
  onExpand,
  expandLabel,
  onMouseEnter,
  onMouseLeave,
  onDragOver,
  onDragLeave,
  onDrop,
  isDropTarget = false,
  className,
}: {
  title: string;
  count: number;
  countTone?: "default" | "danger";
  onExpand: () => void;
  expandLabel: string;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  isDropTarget?: boolean;
  className?: string;
}) {
  const lang = useLanguage();

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex h-full min-h-0 w-[52px] flex-[0_0_52px] flex-col items-center gap-3 rounded-column border border-line-column bg-surface-column py-3 shadow-column transition-colors",
        isDropTarget && "border-dashed border-chip-active-line ring-2 ring-primary",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onExpand}
        aria-expanded={false}
        aria-label={expandLabel}
        title={expandLabel}
        className="size-7 shrink-0 rounded-lg border border-line-card bg-card p-0 text-foreground-secondary not-disabled:hover:bg-surface-subtle not-disabled:hover:text-foreground"
      >
        <ChevronsRight
          className={cn("size-4", mirrorInRtl)}
          aria-hidden="true"
        />
      </Button>

      <span
        data-testid="rail-count-badge"
        className={cn(
          "inline-flex size-[26px] shrink-0 items-center justify-center rounded-full text-badge font-bold tabular-nums",
          crmBoardCountToneClass(count, countTone),
        )}
      >
        {formatNumber(count, lang)}
      </span>

      <span className="min-h-0 truncate text-tab font-bold text-foreground-secondary [writing-mode:vertical-rl] rotate-180">
        {title}
      </span>

      <span className="min-h-2 w-px flex-1 bg-line-divider" aria-hidden="true" />
    </div>
  );
}
