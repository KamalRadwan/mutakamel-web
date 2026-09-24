"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge, Button, DateTime, IdentifierText, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import type { Activity } from "./activity-contract";
import { toLocalDate } from "./activity-form";
import {
  ACTIVITY_DUE_STATE_TONE,
  activityDueState,
  activityLabel,
  activityPriorityTone,
  activityTargetHref,
  primaryActivityTarget,
} from "./activity-presentation";
import { ActivityTypeIcon } from "./ActivityTypeIcon";

export interface ActivityDetailsProps {
  activity: Activity;
  /** The viewer, so their own name reads as "Me". */
  actorId: string | null;
}

/** The read-only body of the modal's view screen. */
export function ActivityDetails({ activity, actorId }: ActivityDetailsProps) {
  const { t, lang } = useI18n();
  const copy = t.activities;
  const target = primaryActivityTarget(activity);
  // A record its application reports gone keeps its label and loses its link.
  const href = target && !target.unavailableAt ? activityTargetHref(target.targetType, target.targetId) : null;
  const typeLabel = target ? activityLabel(copy, "targetTypes", target.targetType) : null;
  const dueState = activityDueState(activity);
  const endsSameDay = activity.endsAt !== null
    && toLocalDate(new Date(activity.endsAt)) === toLocalDate(new Date(activity.dueAt));
  // A join link is offered for http(s) only — anything else is shown, never followed.
  const joinUrl = activity.meetingUrl && /^https?:\/\//u.test(activity.meetingUrl) ? activity.meetingUrl : null;
  const assignee = activity.assigneeUserId === actorId ? copy.form.assigneeMe : activity.assigneeName;
  const created = formatDateTime(activity.createdAt, lang);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <ActivityTypeIcon type={activity.type} size="lg" className="text-muted-foreground" />
          {activityLabel(copy, "types", activity.type)}
        </span>
        <Badge tone={activityPriorityTone(activity.priority)}>{activityLabel(copy, "priorities", activity.priority)}</Badge>
        {activity.direction && <Badge tone="neutral">{activityLabel(copy, "directions", activity.direction)}</Badge>}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailRow label={copy.detail.when}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              <DateTime value={activity.dueAt} />
              {activity.endsAt && (
                <>
                  {" – "}
                  <DateTime value={activity.endsAt} precision={endsSameDay ? "time" : "datetime"} />
                </>
              )}
            </span>
            {dueState && dueState !== "UPCOMING" && (
              <Badge tone={ACTIVITY_DUE_STATE_TONE[dueState]}>{copy.dueStates[dueState]}</Badge>
            )}
          </span>
        </DetailRow>
        <DetailRow label={copy.detail.relatedTo}>
          {target ? (
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              {href ? (
                <Link
                  href={href}
                  title={formatTemplate(copy.detail.openRecord, { type: typeLabel ?? "" })}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {target.label}
                </Link>
              ) : (
                <span>{target.label}</span>
              )}
              <span className="text-xs text-muted-foreground">{typeLabel}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t.detail.notRecorded}</span>
          )}
        </DetailRow>
        <DetailRow label={copy.detail.assignee}>
          {assignee ?? <IdentifierText>{activity.assigneeUserId}</IdentifierText>}
        </DetailRow>
        {activity.location && <DetailRow label={copy.detail.location}>{activity.location}</DetailRow>}
        {activity.meetingUrl && (
          <DetailRow label={copy.detail.meetingUrl} wide>
            <span className="flex min-w-0 flex-col items-start gap-1">
              {joinUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={joinUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className={iconSize({ size: "sm" })} aria-hidden="true" />
                    {copy.detail.joinMeeting}
                  </a>
                </Button>
              )}
              <span dir="ltr" className="max-w-full text-xs text-muted-foreground wrap-anywhere">{activity.meetingUrl}</span>
            </span>
          </DetailRow>
        )}
        <DetailRow label={copy.detail.description} wide>
          {activity.description
            ? <span className="whitespace-pre-wrap">{activity.description}</span>
            : <span className="text-muted-foreground">{copy.detail.noNotes}</span>}
        </DetailRow>
        {activity.outcome && (
          // Core keeps a cancellation's reason in the same column as a completion's outcome.
          <DetailRow label={activity.status === "CANCELLED" ? copy.cancel.reason : copy.detail.outcome} wide>
            <span className="whitespace-pre-wrap">{activity.outcome}</span>
          </DetailRow>
        )}
      </dl>

      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <li>
          {activity.createdByName
            ? formatTemplate(copy.detail.created, { date: created, name: activity.createdByName })
            : formatTemplate(copy.detail.createdNoName, { date: created })}
        </li>
        {activity.updatedAt !== activity.createdAt && (
          <li>{formatTemplate(copy.detail.updated, { date: formatDateTime(activity.updatedAt, lang) })}</li>
        )}
        {activity.completedAt && (
          <li>{formatTemplate(copy.detail.completed, { date: formatDateTime(activity.completedAt, lang) })}</li>
        )}
        {activity.cancelledAt && (
          <li>{formatTemplate(copy.detail.cancelled, { date: formatDateTime(activity.cancelledAt, lang) })}</li>
        )}
      </ul>
    </div>
  );
}

function DetailRow({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}
