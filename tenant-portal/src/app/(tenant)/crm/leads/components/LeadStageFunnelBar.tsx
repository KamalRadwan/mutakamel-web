"use client";

import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

interface LeadStageFunnelBarProps {
  stages: readonly LeadStage[];
  leads: readonly LeadItem[];
  selectedStageId?: string;
  onSelectStage: (stageId: string | undefined) => void;
  disabled?: boolean;
}

/**
 * Full-width segmented Stage Funnel Ribbon for Card View & Table View
 * matching Screens 05, 06, and 07 (`All Leads 48 | New 14 | Contacted 11 | ...`).
 */
export function LeadStageFunnelBar({
  stages,
  leads,
  selectedStageId,
  onSelectStage,
  disabled,
}: LeadStageFunnelBarProps) {
  const { t, lang } = useI18n();

  const countByStageId = new Map<string, number>();
  for (const lead of leads) {
    countByStageId.set(lead.stageId, (countByStageId.get(lead.stageId) ?? 0) + 1);
  }

  const isAllActive = !selectedStageId;

  return (
    <div
      role="navigation"
      aria-label={t.crmLeads.executive.stageFilter}
      className="flex w-full items-stretch divide-x divide-border overflow-x-auto rounded-lg border border-border bg-card shadow-2xs"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-pressed={isAllActive}
        onClick={() => onSelectStage(undefined)}
        className={cn(
          "flex h-auto min-w-32 flex-1 items-center justify-center gap-2 rounded-none px-3.5 py-2 text-xs font-semibold transition-colors",
          isAllActive
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            : "bg-card text-foreground hover:bg-muted/50",
        )}
      >
        <span className="truncate">{t.crmLeads.executive.allLeads}</span>
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            isAllActive
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {leads.length}
        </span>
      </Button>

      {stages.map((stage) => {
        const isActive = selectedStageId === stage.id;
        const count = countByStageId.get(stage.id) ?? 0;
        const topAccent =
          stage.flag === "QUALIFIED" || stage.flag === "CONVERTED"
            ? "border-t-2 border-t-success"
            : stage.flag === "DISQUALIFIED"
              ? "border-t-2 border-t-destructive"
              : "";

        return (
          <Button
            key={stage.id}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelectStage(isActive ? undefined : stage.id)}
            className={cn(
              "flex h-auto min-w-28 flex-1 items-center justify-center gap-1.5 rounded-none px-3 py-2 text-xs font-semibold transition-colors",
              topAccent,
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : stage.flag === "QUALIFIED"
                  ? "bg-success-subtle/40 text-success-subtle-foreground hover:bg-success-subtle/80"
                  : stage.flag === "DISQUALIFIED"
                    ? "bg-card text-foreground hover:bg-destructive-subtle/40"
                    : "bg-card text-foreground hover:bg-muted/50",
            )}
          >
            <span className="truncate">{localizedName(stage, lang)}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : stage.flag === "QUALIFIED"
                    ? "bg-success-subtle text-success-subtle-foreground"
                    : stage.flag === "DISQUALIFIED"
                      ? "bg-destructive-subtle text-destructive-subtle-foreground"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
