"use client";

import Link from "next/link";
import { ExternalLink, FileText, Globe, Link2, Lock, MapPin, User } from "lucide-react";
import { Button, DateTime, IdentifierText, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import type { Activity } from "./activity-contract";
import { toLocalDate } from "./activity-form";
import {
  activityDueState,
  activityDurationMinutes,
  activityLabel,
  activityTargetHref,
  activityTargetTypeBadgeClasses,
  activityTypePalette,
  primaryActivityTarget,
} from "./activity-presentation";
import { ActivityTypeIcon } from "./ActivityTypeIcon";

export interface ActivityDetailsProps {
  activity: Activity;
  /** The viewer, so their own name reads as "Me". */
  actorId: string | null;
}

function getInitials(name: string): string {
  const cleaned = name.replace(/\(.*?\)/gu, "").trim();
  const parts = cleaned.split(/\s+/u).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  return (cleaned.slice(0, 2) || "ME").toUpperCase();
}

/** The read-only body of the modal's Current Activity Inspector screen. */
export function ActivityDetails({ activity, actorId }: ActivityDetailsProps) {
  const { t, lang } = useI18n();
  const copy = t.activities;
  const target = primaryActivityTarget(activity);
  // A record its application reports gone keeps its label and loses its link.
  const href = target && !target.unavailableAt ? activityTargetHref(target.targetType, target.targetId) : null;
  const typeLabel = target ? activityLabel(copy, "targetTypes", target.targetType) : null;
  const dueState = activityDueState(activity);
  const palette = activityTypePalette(activity.type);
  const durationMinutes = activityDurationMinutes(activity.dueAt, activity.endsAt);
  const endsSameDay =
    activity.endsAt !== null &&
    toLocalDate(new Date(activity.endsAt)) === toLocalDate(new Date(activity.dueAt));
  // A join link is offered for http(s) only — anything else is shown, never followed.
  const joinUrl = activity.meetingUrl && /^https?:\/\//u.test(activity.meetingUrl) ? activity.meetingUrl : null;
  const assignee =
    activity.assigneeUserId === actorId
      ? activity.assigneeName
        ? `${activity.assigneeName} (${copy.form.assigneeMe})`
        : copy.form.assigneeMe
      : activity.assigneeName;
  const created = formatDateTime(activity.createdAt, lang);
  const priorityLabel = activityLabel(copy, "priorities", activity.priority);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1. Scheduled Window Banner */}
      <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5", palette.sectionCard)}>
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md border", palette.iconBoxActive)}>
            <ActivityTypeIcon type={activity.type} size="md" />
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="text-muted-foreground">{copy.detail.scheduledWindow}</span>
              <span>
                <DateTime value={activity.dueAt} />
                {activity.endsAt && (
                  <>
                    {" – "}
                    <DateTime value={activity.endsAt} precision={endsSameDay ? "time" : "datetime"} />
                  </>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>
                {durationMinutes !== null
                  ? formatTemplate(copy.detail.durationLine, {
                      minutes: durationMinutes,
                      priority: priorityLabel,
                    })
                  : priorityLabel}
              </span>
              {dueState && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={cn(
                      "font-semibold",
                      dueState === "OVERDUE"
                        ? "text-destructive-subtle-foreground"
                        : dueState === "TODAY"
                          ? "text-warning-subtle-foreground"
                          : "text-success-subtle-foreground",
                    )}
                  >
                    {copy.dueStates[dueState]}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {joinUrl && (
          <Button variant="primary" size="sm" asChild>
            <a href={joinUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className={iconSize({ size: "xs" })} aria-hidden="true" />
              {copy.detail.joinMeeting}
            </a>
          </Button>
        )}
      </div>

      {/* 2. Structured 2x2 Info Tile Grid */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailTile
          icon={<Link2 className={iconSize({ size: "xs" })} aria-hidden="true" />}
          label={copy.detail.relatedTo}
        >
          {target ? (
            <span className="flex flex-wrap items-center gap-2">
              {typeLabel && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-semibold",
                    activityTargetTypeBadgeClasses(target.targetType, true),
                  )}
                >
                  {typeLabel}
                </span>
              )}
              {href ? (
                <Link
                  href={href}
                  title={formatTemplate(copy.detail.openRecord, { type: typeLabel ?? "" })}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
                >
                  <span>{target.label}</span>
                  <ExternalLink className={iconSize({ size: "xs" })} aria-hidden="true" />
                </Link>
              ) : (
                <span className="font-semibold">{target.label}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{t.detail.notRecorded}</span>
          )}
        </DetailTile>

        <DetailTile
          icon={<User className={iconSize({ size: "xs" })} aria-hidden="true" />}
          label={copy.detail.assignee}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            {assignee && (
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-swatch-indigo text-2xs font-semibold text-primary-foreground">
                {getInitials(assignee)}
              </span>
            )}
            <span>{assignee ?? <IdentifierText>{activity.assigneeUserId}</IdentifierText>}</span>
          </span>
        </DetailTile>

        {activity.location && (
          <DetailTile
            icon={<MapPin className={iconSize({ size: "xs" })} aria-hidden="true" />}
            label={copy.detail.location}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <MapPin className={cn(iconSize({ size: "xs" }), palette.iconText)} aria-hidden="true" />
              <span>{activity.location}</span>
            </span>
          </DetailTile>
        )}

        {activity.meetingUrl && (
          <DetailTile
            icon={<Globe className={iconSize({ size: "xs" })} aria-hidden="true" />}
            label={copy.detail.meetingUrl}
            wide={!activity.location}
          >
            <span dir="ltr" className="block max-w-full text-xs font-medium text-primary wrap-anywhere">
              {activity.meetingUrl}
            </span>
          </DetailTile>
        )}

        <DetailTile
          icon={<FileText className={iconSize({ size: "xs" })} aria-hidden="true" />}
          label={copy.detail.agendaAndNotes}
          wide
        >
          {activity.description ? (
            <span className="whitespace-pre-wrap leading-relaxed">{activity.description}</span>
          ) : (
            <span className="text-muted-foreground">{copy.detail.noNotes}</span>
          )}
        </DetailTile>

        {activity.outcome && (
          // Core keeps a cancellation's reason in the same column as a completion's outcome.
          <DetailTile
            label={activity.status === "CANCELLED" ? copy.cancel.reason : copy.detail.outcome}
            wide
            className={
              activity.status === "CANCELLED"
                ? "border-destructive/30 bg-destructive-subtle/30"
                : "border-success/30 bg-success-subtle/30"
            }
          >
            <span className="whitespace-pre-wrap">{activity.outcome}</span>
          </DetailTile>
        )}
      </dl>

      {/* 3. Audit & Version Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
        <span className="inline-flex items-center gap-1.5">
          <Lock className={iconSize({ size: "xs" })} aria-hidden="true" />
          <span>{copy.detail.optimisticLock}</span>
          <span className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-foreground">
            v{activity.version}
          </span>
        </span>
      </div>
    </div>
  );
}

function DetailTile({
  icon,
  label,
  wide,
  className,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border bg-card p-3.5",
        wide && "sm:col-span-2",
        className,
      )}
    >
      <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="mt-1.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}
