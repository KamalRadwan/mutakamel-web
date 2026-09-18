"use client";

import { ActivityList, type ActivityListProps, type BadgeProps } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatDateTime } from "@/lib/format/date";
import type { CrmPlannedActivity } from "../crm-activity-contract";

const PRIORITY_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  URGENT: "negative",
  HIGH: "caution",
  NORMAL: "neutral",
  LOW: "neutral",
};

export type CrmActivityListProps = Omit<
  ActivityListProps<CrmPlannedActivity>,
  "labels" | "describe"
>;

export function CrmActivityList(props: CrmActivityListProps) {
  const { t, lang } = useI18n();
  const copy = t.crmLeads.activities;

  return (
    <ActivityList<CrmPlannedActivity>
      {...props}
      labels={copy}
      describe={(activity) => ({
        type: copy.types[activity.type] ?? activity.type,
        priority: copy.priorities[activity.priority] ?? activity.priority,
        priorityTone: PRIORITY_TONE[activity.priority] ?? "neutral",
        due: formatDateTime(activity.dueAt, lang),
        actions: formatTemplate(copy.rowActions, { subject: activity.subject }),
      })}
    />
  );
}
