"use client";

import { cn } from "@/design-system";
import type { CrmActivityState } from "../../crm-activity-tone";

const ACTIVITY_BAR_CLASS: Record<CrmActivityState, string> = {
  NONE: "bg-activity-none",
  FUTURE: "bg-activity-future",
  TODAY: "bg-activity-today",
  OVERDUE: "bg-activity-overdue",
};

export function CrmCardStartBar({
  state,
  neutral = false,
  colorClass,
  className,
}: {
  state: CrmActivityState;
  neutral?: boolean;
  colorClass?: string;
  className?: string;
}) {
  const fillClass = neutral
    ? ACTIVITY_BAR_CLASS.NONE
    : colorClass || ACTIVITY_BAR_CLASS[state];

  return (
    <span
      data-testid="crm-card-activity-bar"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 start-0 w-1 rounded-s-card",
        fillClass,
        className,
      )}
    />
  );
}
