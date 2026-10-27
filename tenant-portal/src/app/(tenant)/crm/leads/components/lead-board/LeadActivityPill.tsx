"use client";

import { Activity, AlertCircle, Calendar, Clock, type LucideIcon } from "lucide-react";
import { Button, cn, hitTarget } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { LeadActivityState } from "../../lead-card-contract";
import type { LeadStage } from "../../lead-list-contract";

interface LeadActivityPillProps {
  state: LeadActivityState;
  stageFlag?: LeadStage["flag"];
  showActivityEntry: boolean;
  onOpenActivities: () => void;
}

const ACTIVITY_PILL_TONE_CLASS: Record<LeadActivityState, string> = {
  NONE: "border-activity-none-line bg-activity-none-surface text-activity-none-text",
  FUTURE: "border-activity-future-line bg-activity-future-surface text-activity-future-text",
  TODAY: "border-activity-today-line bg-activity-today-surface text-activity-today-text",
  OVERDUE: "border-activity-overdue-line bg-activity-overdue-surface text-activity-overdue-text",
};

const ACTIVITY_PILL_HOVER_CLASS: Record<LeadActivityState, string> = {
  NONE: "not-disabled:hover:bg-activity-none-surface",
  FUTURE: "not-disabled:hover:bg-activity-future-surface",
  TODAY: "not-disabled:hover:bg-activity-today-surface",
  OVERDUE: "not-disabled:hover:bg-activity-overdue-surface",
};

const ACTIVITY_PILL_ICON: Record<LeadActivityState, LucideIcon> = {
  NONE: Activity,
  FUTURE: Calendar,
  TODAY: Clock,
  OVERDUE: AlertCircle,
};

export function LeadActivityPill({
  state: activityState,
  stageFlag,
  showActivityEntry,
  onOpenActivities,
}: LeadActivityPillProps) {
  const { t } = useI18n();
  const isTerminal = stageFlag === "CONVERTED" || stageFlag === "DISQUALIFIED";
  const state = isTerminal ? "NONE" : activityState;
  const label = stageFlag === "CONVERTED"
    ? t.crmLeads.executive.converted
    : stageFlag === "DISQUALIFIED"
      ? t.crmLeads.executive.closed
      : t.crmLeads.card.activityStates[state];
  const Icon = ACTIVITY_PILL_ICON[state];

  if (!showActivityEntry) {
    return (
      <span
        className={`inline-flex h-[23px] shrink-0 items-center gap-1 rounded-full border px-2 text-badge font-semibold whitespace-nowrap ${ACTIVITY_PILL_TONE_CLASS[state]}`}
      >
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onOpenActivities}
      aria-label={formatTemplate(t.crmLeads.card.activityOpen, { state: label })}
      className={cn(
        hitTarget,
        "inline-flex h-[23px] shrink-0 items-center gap-1 rounded-full border px-2 font-semibold whitespace-nowrap transition-opacity not-disabled:hover:opacity-85",
        ACTIVITY_PILL_TONE_CLASS[state],
        ACTIVITY_PILL_HOVER_CLASS[state],
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="text-badge font-semibold whitespace-nowrap">{label}</span>
    </Button>
  );
}
