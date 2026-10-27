"use client";

import type { ReactNode } from "react";
import { ChevronsLeft, Plus } from "lucide-react";
import { Button, cn, mirrorInRtl } from "@/design-system";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";

export function crmBoardCountToneClass(
  count: number,
  countTone: "default" | "danger" = "default",
): string {
  if (countTone === "danger") {
    return "bg-count-danger-surface text-count-danger-fg";
  }
  if (count > 0) {
    return "bg-count-active-surface text-count-active-fg";
  }
  return "bg-count-zero-surface text-count-zero-fg";
}

export function CrmBoardColumnHeader({
  title,
  count,
  countTone = "default",
  activity,
  extra,
  filterPill,
  onQuickAdd,
  quickAddLabel,
  onCollapse,
  collapseLabel,
  className,
}: {
  title: string;
  count: number;
  countTone?: "default" | "danger";
  activity: ReactNode;
  extra?: ReactNode;
  filterPill?: ReactNode;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  onCollapse?: () => void;
  collapseLabel?: string;
  className?: string;
}) {
  const lang = useLanguage();

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2.5 rounded-t-column border-b border-line-divider bg-surface-column-header px-3.5 pt-[13px] pb-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-column-title font-bold text-foreground">
            {title}
          </span>
          <span
            data-testid="column-count-pill"
            className={cn(
              "inline-flex h-5 min-w-[23px] shrink-0 items-center justify-center rounded-full px-1.5 text-badge font-bold tabular-nums",
              crmBoardCountToneClass(count, countTone),
            )}
          >
            {formatNumber(count, lang)}
          </span>
        </div>

        {(onQuickAdd || onCollapse) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {onQuickAdd && (
              <Button
                type="button"
                variant="ghost"
                onClick={onQuickAdd}
                aria-label={quickAddLabel}
                title={quickAddLabel}
                className="size-[26px] shrink-0 rounded-[7px] border border-line-card bg-surface-subtle p-0 text-muted-foreground not-disabled:hover:bg-count-active-surface not-disabled:hover:text-primary"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            )}

            {onCollapse && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCollapse}
                aria-expanded={true}
                aria-label={collapseLabel}
                title={collapseLabel}
                className="size-[26px] shrink-0 rounded-[7px] border border-line-card bg-surface-subtle p-0 text-muted-foreground not-disabled:hover:bg-accent not-disabled:hover:text-foreground"
              >
                <ChevronsLeft
                  className={cn("size-3.5", mirrorInRtl)}
                  aria-hidden="true"
                />
              </Button>
            )}
          </div>
        )}
      </div>

      {extra}

      {activity}

      {filterPill}
    </div>
  );
}
