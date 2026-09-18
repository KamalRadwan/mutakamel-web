import { CircleCheck, CircleX, History } from "lucide-react";
import { RatingStars, type TimelineEvent } from "@/design-system";
import type { useI18n } from "@/i18n/I18nContext";
import { formatDateTimeNumeric } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type { EntityAuditEvent } from "@/lib/audit/entity-history-contract";
import { isAuditUserField } from "@/lib/audit/history-references";
import type { UserProfileResult } from "@/lib/people/user-profile";
import { UserProfileLink } from "@/components/people/UserProfileLink";
import type { EntityHistoryCardProps } from "./EntityHistoryCard";

type AuditCopy = ReturnType<typeof useI18n>["t"]["audit"];
interface HistoryPeople {
  profiles: ReadonlyMap<string, UserProfileResult>;
  retry: () => void;
}

/** A field key as a label — `stageId` and `stage_id` both read "Stage id". */
function fieldName(field: string, copy: AuditCopy): string {
  const known = (copy.fields as Record<string, string | undefined>)[field];
  if (known) return known;
  const words = field
    .replace(/[._]+/gu, " ")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * One side of a change, as text.
 *
 * `null` and `undefined` are not the same thing to a reader — one is "it was
 * cleared", the other "it was not set" — but on a diff both mean "there was no
 * value", so both read as the empty marker. An object prints as JSON rather
 * than as `[object Object]`, bounded, because a nested value is still evidence.
 */
function changeValue(
  value: unknown,
  field: string,
  entityType: string,
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels: EntityHistoryCardProps['valueLabels'],
): string {
  if (value === null || value === undefined || value === "") return copy.valueEmpty;
  if (value === "[NOT_RECORDED]") return copy.valueNotRecorded;
  if (Array.isArray(value)) return value.length
    ? value.map((item) => changeValue(item, field, entityType, copy, statusValues, valueLabels)).join(", ") : copy.valueEmpty;
  if (typeof value === "string") {
    if (valueLabels?.[field]) return valueLabels[field][value] || copy.valueUnavailable;
    if (isUUIDv7(value)) return copy.valueUnavailable;
    if (field === "activityEvent") return copy.actions[value] || copy.valueUnavailable;
    const recordStatusGroups: Record<string, Record<string, string>> = {
      Lead: { stageFlag: "LeadStageFlag", status: "LeadStatus" },
      Opportunity: {
        stageFlag: "OpportunityStageFlag",
        status: "OpportunityStatus",
      },
      CustomerProfile: { status: "CustomerStatus" },
    };
    const statusGroup =
      recordStatusGroups[entityType]?.[field] ??
      ({ activityStatus: "ActivityStatus", activityType: "ActivityType",
        activityPriority: "ActivityPriority", activityDirection: "ActivityDirection" } as Record<string, string>)[field];
    return (statusGroup && statusValues[`${statusGroup}.${value}`]) || value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 120);
  } catch {
    return copy.valueUnreadable;
  }
}

export function toTimelineEvent(
  event: EntityAuditEvent,
  lang: "ar" | "en",
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels: EntityHistoryCardProps['valueLabels'],
  context: Pick<EntityHistoryCardProps, 'entityType' | 'entityId'>,
  people?: HistoryPeople,
): TimelineEvent {
  const creationAction = creationSummaryAction(event, context);
  return {
    id: event.id,
    // The actor is the useful headline on a compact per-record history. The
    // action is already expressed by the changed field beneath it, so printing
    // both adds a line without adding information.
    title: event.actorLabel || copy.actorUnknown,
    // All digits, day first, in both languages — a log is read by comparing
    // rows, and a month name is a different width in each.
    timestamp: formatDateTimeNumeric(event.occurredAt, lang),
    tone:
      event.outcome === "FAILURE" ? "negative" : event.outcome === "SUCCESS" ? "positive" : undefined,
    icon: event.outcome === "FAILURE" ? CircleX : event.outcome === "SUCCESS" ? CircleCheck : History,
    description: (
      <span className="flex flex-col gap-1">
        {creationAction ? (
          <span className="text-foreground">{copy.actions[creationAction] ?? creationAction}</span>
        ) : event.changes.length > 0 ? (
          <span className="flex flex-col gap-1.5">
            {event.changes.map((change, index) => (
              <span
                key={`${change.subjectId ?? ""}:${change.field}:${index}`}
                className="flex flex-wrap items-baseline gap-x-1 text-xs"
              >
                <span className="font-medium text-foreground">
                  {change.subjectLabel ? <><bdi>{change.subjectLabel}</bdi> · </> : null}
                  {fieldName(change.field, copy)}:
                </span>
                {/* Keep the transition chronological even on the Arabic page;
                    each value still resolves its own text direction. */}
                <span className="flex flex-wrap items-baseline gap-1" dir="ltr">
                  <HistoryChangeValue value={change.before} field={change.field} side="before"
                    isLead={context.entityType === "Lead" && (!change.subjectId || change.subjectId === context.entityId)}
                    entityType={context.entityType}
                    copy={copy} statusValues={statusValues} valueLabels={valueLabels} people={people} />
                  <span className="text-muted-foreground">
                    &gt;
                  </span>
                  <HistoryChangeValue value={change.after} field={change.field} side="after"
                    isLead={context.entityType === "Lead" && (!change.subjectId || change.subjectId === context.entityId)}
                    entityType={context.entityType}
                    copy={copy} statusValues={statusValues} valueLabels={valueLabels} people={people} />
                </span>
              </span>
            ))}
          </span>
        ) : <span className="text-muted-foreground">{copy.detailsNotRecorded}</span>}
        {/* The reason is the half that matters when something failed, so it is
            rendered rather than dropped. */}
        {event.reason ? (
          <span className="text-foreground">
            {formatTemplate(copy.reasonLine, { reason: event.reason })}
          </span>
        ) : null}
      </span>
    ),
  };
}

// Related Core history reports the FIRST child action in a request, which may
// be a Party CREATE/UPDATE rather than the CRM record's own creation action
// (related-history.view.ts). A small set of required initial fields identifies
// the root record without collapsing a later contact creation into it.
const CREATION_ACTIONS: Record<string, string> = {
  Lead: "LEAD_CREATED",
  CustomerProfile: "CUSTOMER_PROFILE_CREATED",
  Opportunity: "OPPORTUNITY_CREATED",
};

const CREATION_FIELDS: Record<
  string,
  readonly { field: string; valid: (value: unknown) => boolean }[]
> = {
  Lead: [
    {
      field: "leadProfileType",
      valid: (value) => value === "INDIVIDUAL" || value === "CORPORATE",
    },
    { field: "branchId", valid: isUUIDv7 },
    { field: "stageId", valid: isUUIDv7 },
  ],
  CustomerProfile: [
    {
      field: "profileType",
      valid: (value) => value === "INDIVIDUAL" || value === "CORPORATE",
    },
    { field: "branchId", valid: isUUIDv7 },
    { field: "status", valid: (value) => typeof value === "string" && value.length > 0 },
  ],
  Opportunity: [
    { field: "branchId", valid: isUUIDv7 },
    { field: "customerProfileId", valid: isUUIDv7 },
    { field: "pipelineId", valid: isUUIDv7 },
    { field: "stageId", valid: isUUIDv7 },
  ],
};

function creationSummaryAction(
  event: EntityAuditEvent,
  context: Pick<EntityHistoryCardProps, 'entityType' | 'entityId'>,
): string | null {
  if (event.outcome === "FAILURE") return null;
  const action = CREATION_ACTIONS[context.entityType];
  if (!action) return null;
  if (event.action === action) return action;
  if (!context.entityId) return null;
  const required = CREATION_FIELDS[context.entityType];
  if (!required) return null;
  return required.every(({ field, valid }) => event.changes.some((change) =>
    change.subjectId === context.entityId &&
    change.field === field &&
    change.before == null &&
    valid(change.after),
  )) ? action : null;
}

// crm-app/src/crm/leads/dto/lead.dto.ts: UpdateLeadDto.rating is an integer 0–3.
const LEAD_RATING_MAX = 3;
function HistoryChangeValue({ value, field, side, isLead, entityType, copy, statusValues, valueLabels, people }: {
  value: unknown;
  field: string;
  side: "before" | "after";
  isLead: boolean;
  entityType: string;
  copy: AuditCopy;
  statusValues: Record<string, string | undefined>;
  valueLabels: EntityHistoryCardProps['valueLabels'];
  people?: HistoryPeople;
}) {
  if (isAuditUserField(field) && isUUIDv7(value)) {
    return <UserProfileLink result={people?.profiles.get(value)} previous={side === "before"} onRetry={people?.retry} />;
  }
  if (isAuditUserField(field) && Array.isArray(value) && value.length) {
    return <span className="inline-flex flex-wrap items-baseline gap-1">{value.map((item, index) => (
      <HistoryChangeValue key={index} value={item} field={field} side={side} isLead={isLead}
        entityType={entityType}
        copy={copy} statusValues={statusValues} valueLabels={valueLabels} people={people} />
    ))}</span>;
  }
  // Missing/redacted/invalid evidence must keep its text marker, never become 0.
  if (isLead && field === "rating" && typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= LEAD_RATING_MAX) {
    return <RatingStars value={value} max={LEAD_RATING_MAX}
      label={formatTemplate(side === "before" ? copy.ratingBefore : copy.ratingAfter, { count: value, max: LEAD_RATING_MAX })} />;
  }
  return <span className={side === "before"
    ? "break-words text-danger-600 line-through dark:text-danger-300"
    : "break-words text-foreground"} dir="auto">
    {changeValue(value, field, entityType, copy, statusValues, valueLabels)}
  </span>;
}
