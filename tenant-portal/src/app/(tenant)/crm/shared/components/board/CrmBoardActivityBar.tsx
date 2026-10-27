"use client";

import { Button, cn } from "@/design-system";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { crmActivitySegments } from "../../crm-activity-segments";
import type { CrmActivityState } from "../../crm-activity-tone";

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

export function CrmBoardActivityBar({
  states,
  labels,
  activeState = null,
  onToggleState,
  ariaLabel,
  className,
}: {
  states: readonly CrmActivityState[];
  labels: Record<CrmActivityState, string>;
  activeState?: CrmActivityState | null;
  onToggleState?: (s: CrmActivityState) => void;
  ariaLabel: string;
  className?: string;
}) {
  const lang = useLanguage();
  const segments = crmActivitySegments(states);
  const isInteractive =
    Boolean(onToggleState) && (states.length > 0 || activeState !== null);
  if (
    isInteractive &&
    activeState !== null &&
    !segments.some((seg) => seg.state === activeState)
  ) {
    segments.push({ state: activeState, count: 0, percent: 0 });
  }

  if (!isInteractive) {
    const summary = segments
      .map((seg) => `${labels[seg.state]}: ${formatNumber(seg.count, lang)}`)
      .join(" · ");

    return (
      <div
        role="img"
        aria-label={`${ariaLabel} — ${summary}`}
        className={cn(
          "flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-activity-none",
          className,
        )}
      >
        {segments.map((seg) => {
          const itemLabel = `${labels[seg.state]}: ${formatNumber(seg.count, lang)}`;
          return (
            <span
              key={seg.state}
              data-activity-state={seg.state}
              title={itemLabel}
              style={{ width: `${seg.percent}%` }}
              className={cn("h-full shrink", ACTIVITY_BAR_FILL[seg.state])}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-activity-none",
        className,
      )}
    >
      {segments
        .filter((seg) => seg.count > 0 || activeState === seg.state)
        .map((seg) => {
          const itemLabel = `${labels[seg.state]}: ${formatNumber(seg.count, lang)}`;
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
              aria-label={itemLabel}
              title={itemLabel}
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
