"use client";

import type { ReactNode } from "react";
import { CircleX, Inbox, Plus, Sprout } from "lucide-react";
import { Button, cn } from "@/design-system";
import type { LeadStageFlag } from "@/app/(tenant)/crm/lead-stages/lead-stage-contract";
import { useI18n } from "@/i18n/I18nContext";

function emptyStageBadge(stageFlag: LeadStageFlag): {
  badgeClass: string;
  icon: ReactNode;
} {
  if (stageFlag === "NURTURING") {
    return {
      badgeClass: "bg-entity-company-surface text-entity-company-fg",
      icon: <Sprout className="size-5" aria-hidden="true" />,
    };
  }
  if (stageFlag === "DISQUALIFIED") {
    return {
      badgeClass: "bg-count-danger-surface text-count-danger-fg",
      icon: <CircleX className="size-5" aria-hidden="true" />,
    };
  }
  return {
    badgeClass: "bg-count-zero-surface text-count-zero-fg",
    icon: <Inbox className="size-5" aria-hidden="true" />,
  };
}

export interface LeadBoardEmptyStageProps {
  stageFlag: LeadStageFlag;
  /** Omitted when the actor cannot create leads or quick-add is unavailable. */
  onQuickAdd?: () => void;
  className?: string;
}

export function LeadBoardEmptyStage({
  stageFlag,
  onQuickAdd,
  className,
}: LeadBoardEmptyStageProps) {
  const { t } = useI18n();
  const { badgeClass, icon } = emptyStageBadge(stageFlag);
  const hints: Partial<Record<LeadStageFlag, string>> & { readonly default: string } =
    t.crmLeads.emptyStage.hint;
  const hint = hints[stageFlag] ?? hints.default;
  const canQuickAdd = Boolean(onQuickAdd) && stageFlag !== "CONVERTED";

  return (
    <div
      className={cn(
        "flex min-h-40 flex-1 flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-line-control bg-card/70 px-5 py-8 text-center",
        className,
      )}
    >
      <span
        data-testid="empty-stage-icon-badge"
        className={`inline-flex size-12 shrink-0 items-center justify-center rounded-card ${badgeClass}`}
      >
        {icon}
      </span>

      <div className="flex flex-col items-center gap-1">
        <p className="text-tab font-bold text-foreground">{t.crmLeads.emptyStage.title}</p>
        <p className="max-w-[220px] text-caption leading-relaxed text-muted-foreground">{hint}</p>
      </div>

      {canQuickAdd && (
        <Button
          type="button"
          variant="outline"
          onClick={onQuickAdd}
          className="mt-1 h-[34px] gap-1.5 rounded-lg border border-line-control bg-card px-3.5 font-bold text-primary shadow-2xs not-disabled:hover:bg-count-active-surface"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="text-caption">{t.crmLeads.emptyStage.quickAdd}</span>
        </Button>
      )}
    </div>
  );
}
