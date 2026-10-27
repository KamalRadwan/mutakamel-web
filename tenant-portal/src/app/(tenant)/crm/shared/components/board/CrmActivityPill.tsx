"use client";

import { Activity, AlertCircle, Calendar, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/design-system";
import type { CrmActivityState } from "../../crm-activity-tone";

const ACTIVITY_PILL_TONE_CLASS: Record<CrmActivityState, string> = {
  NONE: "border-activity-none-line bg-activity-none-surface text-activity-none-text",
  FUTURE: "border-activity-future-line bg-activity-future-surface text-activity-future-text",
  TODAY: "border-activity-today-line bg-activity-today-surface text-activity-today-text",
  OVERDUE: "border-activity-overdue-line bg-activity-overdue-surface text-activity-overdue-text",
};

const ACTIVITY_PILL_ICON: Record<CrmActivityState, LucideIcon> = {
  NONE: Activity,
  FUTURE: Calendar,
  TODAY: Clock,
  OVERDUE: AlertCircle,
};

export function CrmActivityPill({
  state,
  label,
  title,
  neutral = false,
  className,
}: {
  state: CrmActivityState;
  label: string;
  title?: string;
  neutral?: boolean;
  className?: string;
}) {
  const effectiveState: CrmActivityState = neutral ? "NONE" : state;
  const Icon = ACTIVITY_PILL_ICON[effectiveState];

  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[23px] shrink-0 items-center gap-1 rounded-full border px-2 text-badge font-semibold whitespace-nowrap",
        ACTIVITY_PILL_TONE_CLASS[effectiveState],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
