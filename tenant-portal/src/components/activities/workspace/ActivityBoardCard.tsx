"use client";

import { User } from "lucide-react";
import { Badge, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Activity } from "../activity-contract";
import { activityLabel, activityPriorityTone, primaryActivityTarget } from "../activity-presentation";
import { ActivityTypeIcon } from "../ActivityTypeIcon";
import { ActivityAssigneeName } from "./ActivityAssigneeName";
import { ActivityWhen } from "./ActivityWhen";

export interface ActivityBoardCardProps {
  activity: Activity;
  actorId: string | null;
}

/**
 * A board card's content. The lane already says the status, so the card says
 * what, for whom, when — with its due state in words — and who does it.
 * Only a HIGH or URGENT priority is drawn: it is the one category that is an
 * attention signal, and a "Normal" badge on every card would be noise.
 */
export function ActivityBoardCard({ activity, actorId }: ActivityBoardCardProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const record = primaryActivityTarget(activity)?.label;
  const flagged = activityPriorityTone(activity.priority) === "caution";

  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs">
      <div className="flex min-w-0 items-start gap-1.5">
        <ActivityTypeIcon type={activity.type} className="mt-0.5 text-muted-foreground" />
        <span className="sr-only">{activityLabel(copy, "types", activity.type)}</span>
        <bdi
          className={cn(
            "line-clamp-2 min-w-0 font-medium text-foreground",
            activity.status === "CANCELLED" && "text-muted-foreground line-through",
          )}
        >
          {activity.subject}
        </bdi>
      </div>
      {record && <bdi className="truncate text-muted-foreground">{record}</bdi>}
      <ActivityWhen activity={activity} className="text-muted-foreground" />
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <User className={iconSize({ size: "xs" })} aria-hidden="true" />
          <span className="sr-only">{copy.detail.assignee}</span>
          <ActivityAssigneeName activity={activity} actorId={actorId} />
        </span>
        {flagged && <Badge tone="caution">{activityLabel(copy, "priorities", activity.priority)}</Badge>}
      </div>
    </div>
  );
}
