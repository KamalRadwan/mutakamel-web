"use client";

import type { MouseEventHandler, ReactNode } from "react";
import {
  ChevronsRight,
  CircleCheck,
  CirclePause,
  CircleX,
  Lock,
  Sprout,
} from "lucide-react";
import { Button, cn, mirrorInRtl } from "@/design-system";
import type { LeadStageFlag } from "@/app/(tenant)/crm/lead-stages/lead-stage-contract";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { leadBoardCountToneClass } from "./LeadBoardColumnHeader";

function railStatusBadge(stageFlag: LeadStageFlag): ReactNode {
  switch (stageFlag) {
    case "QUALIFIED":
      return (
        <span
          aria-hidden="true"
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-activity-future-line bg-activity-future-surface text-activity-future-text"
        >
          <CircleCheck className="size-3.5" />
        </span>
      );
    case "CONVERTED":
      return (
        <span
          aria-hidden="true"
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-activity-future-line bg-activity-future-surface text-activity-future-text"
        >
          <Lock className="size-3.5" />
        </span>
      );
    case "ON_HOLD":
      return (
        <span
          aria-hidden="true"
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-line-card bg-card text-muted-foreground"
        >
          <CirclePause className="size-3.5" />
        </span>
      );
    case "DISQUALIFIED":
      return (
        <span
          aria-hidden="true"
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-activity-overdue-line bg-count-danger-surface text-count-danger-fg"
        >
          <CircleX className="size-3.5" />
        </span>
      );
    case "NURTURING":
      return (
        <span
          aria-hidden="true"
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-line-card bg-entity-company-surface text-entity-company-fg"
        >
          <Sprout className="size-3.5" />
        </span>
      );
    default:
      return null;
  }
}

export interface LeadBoardCollapsedRailProps {
  stageLabel: string;
  stageFlag: LeadStageFlag;
  totalCount: number;
  /** True while any lead card is being dragged, enabling hover-to-peek cues. */
  isDragging?: boolean;
  showStatusIcon?: boolean;
  onExpand: () => void;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}

export function LeadBoardCollapsedRail({
  stageLabel,
  stageFlag,
  totalCount,
  isDragging = false,
  showStatusIcon = true,
  onExpand,
  onMouseEnter,
  onMouseLeave,
  className,
}: LeadBoardCollapsedRailProps) {
  const { t, lang } = useI18n();
  const isDisqualified = stageFlag === "DISQUALIFIED";
  const statusBadge = showStatusIcon ? railStatusBadge(stageFlag) : null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "flex h-full min-h-0 w-[52px] flex-[0_0_52px] flex-col items-center gap-3 rounded-column border border-line-column bg-surface-column py-3 shadow-column transition-colors",
        isDragging && "border-dashed border-chip-active-line",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onExpand}
        aria-expanded={false}
        aria-label={`${t.views.expandColumn}: ${stageLabel}`}
        title={`${t.views.expandColumn}: ${stageLabel}`}
        className="size-7 shrink-0 rounded-lg border border-line-card bg-card p-0 text-foreground-secondary not-disabled:hover:bg-surface-subtle not-disabled:hover:text-foreground"
      >
        <ChevronsRight className={cn("size-4", mirrorInRtl)} aria-hidden="true" />
      </Button>

      <span
        data-testid="rail-count-badge"
        className={`inline-flex size-[26px] shrink-0 items-center justify-center rounded-full text-badge font-bold tabular-nums ${leadBoardCountToneClass(totalCount, isDisqualified)}`}
      >
        {formatNumber(totalCount, lang)}
      </span>

      <span className="min-h-0 truncate text-tab font-bold text-foreground-secondary [writing-mode:vertical-rl] rotate-180">
        {stageLabel}
      </span>

      <span className="min-h-2 w-px flex-1 bg-line-divider" aria-hidden="true" />

      {isDragging ? (
        <span className="px-1 text-center text-badge font-semibold text-chip-active-fg [writing-mode:vertical-rl] rotate-180">
          {t.crmLeads.executive.hoverToPeek}
        </span>
      ) : (
        statusBadge
      )}
    </div>
  );
}
