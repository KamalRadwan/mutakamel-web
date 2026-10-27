"use client";

import { Button, cn } from "@/design-system";
import { crmActivitySegments } from "@/app/(tenant)/crm/shared/crm-activity-segments";
import type { CrmActivityState } from "@/app/(tenant)/crm/shared/crm-activity-tone";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";

const ACTIVITY_BAR_FILL: Record<CrmActivityState, string> = {
  FUTURE: "bg-activity-future",
  TODAY: "bg-activity-today",
  OVERDUE: "bg-activity-overdue",
  NONE: "bg-activity-none",
};

const ACTIVITY_BAR_HOVER_FILL: Record<CrmActivityState, string> = {
  FUTURE: "not-disabled:hover:bg-activity-future",
  TODAY: "not-disabled:hover:bg-activity-today",
  OVERDUE: "not-disabled:hover:bg-activity-overdue",
  NONE: "not-disabled:hover:bg-activity-none",
};

export function leadBoardActivityLabel(state: CrmActivityState, t: Dictionary): string {
  switch (state) {
    case "FUTURE":
      return t.crmLeads.executive.future;
    case "TODAY":
      return t.crmLeads.executive.today;
    case "OVERDUE":
      return t.crmLeads.executive.overdue;
    case "NONE":
      return t.crmLeads.executive.noActivities;
  }
}

export interface LeadBoardActivityBarProps {
  /** Activity state of each lead currently loaded in the stage column. */
  states: readonly CrmActivityState[];
  /** Translated stage name used to label the filter control group. */
  stageLabel?: string;
  /** Currently active activity filter state in this column, when filtered. */
  activeState?: CrmActivityState | null;
  /** Non-empty segments and the active filter act as toggleable filter buttons. */
  onToggleState?: (state: CrmActivityState) => void;
  className?: string;
}

export function LeadBoardActivityBar({
  states,
  stageLabel,
  activeState = null,
  onToggleState,
  className,
}: LeadBoardActivityBarProps) {
  const { t, lang } = useI18n();
  const segments = crmActivitySegments(states);
  const isInteractive = Boolean(onToggleState) && (states.length > 0 || activeState !== null);
  if (isInteractive && activeState !== null && !segments.some((seg) => seg.state === activeState)) {
    segments.push({ state: activeState, count: 0, percent: 0 });
  }

  if (!isInteractive) {
    const summary = segments
      .map((seg) => `${leadBoardActivityLabel(seg.state, t)}: ${formatNumber(seg.count, lang)}`)
      .join(" · ");
    const baseLabel = stageLabel
      ? `${t.crmLeads.card.activityBar} (${stageLabel})`
      : t.crmLeads.card.activityBar;

    return (
      <div
        role="img"
        aria-label={`${baseLabel} — ${summary}`}
        className={cn(
          "flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-activity-none",
          className,
        )}
      >
        {segments.map((seg) => {
          const label = leadBoardActivityLabel(seg.state, t);
          const countText = formatNumber(seg.count, lang);
          return (
            <span
              key={seg.state}
              data-activity-state={seg.state}
              title={`${label}: ${countText}`}
              style={{ width: `${seg.percent}%` }}
              className={cn("h-full shrink", ACTIVITY_BAR_FILL[seg.state])}
            />
          );
        })}
      </div>
    );
  }

  const groupLabel = stageLabel
    ? t.crmLeads.executive.filterColumnTasks(stageLabel)
    : t.crmLeads.card.activityBar;

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn(
        "flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-activity-none",
        className,
      )}
    >
      {segments.filter((seg) => seg.count > 0 || activeState === seg.state).map((seg) => {
        const label = leadBoardActivityLabel(seg.state, t);
        const countText = formatNumber(seg.count, lang);
        const isSelected = activeState === seg.state;
        const isDimmed = activeState !== null && !isSelected;

        return (
          <Button
            key={seg.state}
            type="button"
            variant="ghost"
            data-activity-state={seg.state}
            onClick={() => onToggleState?.(seg.state)}
            style={{ width: `${seg.percent}%` }}
            aria-pressed={isSelected}
            aria-label={`${label}: ${countText}`}
            title={t.crmLeads.executive.filterTaskCount(label, seg.count)}
            className={cn(
              "h-full min-w-0 shrink rounded-none p-0 transition-opacity focus-visible:ring-inset focus-visible:ring-offset-0",
              isSelected && seg.count === 0 && "min-w-6 shrink-0",
              ACTIVITY_BAR_FILL[seg.state],
              ACTIVITY_BAR_HOVER_FILL[seg.state],
              isSelected && "ring-1 ring-inset ring-foreground",
              isDimmed && "opacity-30 not-disabled:hover:opacity-75",
            )}
          />
        );
      })}
    </div>
  );
}
