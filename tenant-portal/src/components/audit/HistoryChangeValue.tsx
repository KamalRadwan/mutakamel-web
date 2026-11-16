import { RatingStars, type HistoryDiffRow } from "@/design-system";
import type { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import type { EntityAuditEvent } from "@/lib/audit/entity-history-contract";
import { isAuditUserField } from "@/lib/audit/history-references";
import type { UserProfileResult } from "@/lib/people/user-profile";
import { UserProfileLink } from "@/components/people/UserProfileLink";

export type AuditCopy = ReturnType<typeof useI18n>["t"]["audit"];
export type HistoryValueLabels = Record<string, Record<string, string>>;

export interface HistoryPeople {
  profiles: ReadonlyMap<string, UserProfileResult>;
  retry: () => void;
}

/** Formats a wire field key into a localized or human-readable label. */
function auditFieldName(field: string, copy: AuditCopy): string {
  const known = (copy.fields as Record<string, string | undefined>)[field];
  if (known) return known;
  const words = field
    .replace(/[._]+/gu, " ")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return String(bytes);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats one side of a field change into display text.
 * Null/undefined/empty map to the localized empty marker; raw UUIDv7 values
 * never leak to the screen.
 */
function formatAuditScalarValue(
  value: unknown,
  field: string,
  entityType: string,
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels?: HistoryValueLabels,
): string {
  if (value === null || value === undefined || value === "") return copy.valueEmpty;
  if (value === "[NOT_RECORDED]") return copy.valueNotRecorded;
  if (Array.isArray(value)) {
    return value.length
      ? value
          .map((item) =>
            formatAuditScalarValue(item, field, entityType, copy, statusValues, valueLabels),
          )
          .join(", ")
      : copy.valueEmpty;
  }
  if (field === "sizeBytes" && typeof value === "number") {
    return formatByteSize(value);
  }
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
      ({
        activityStatus: "ActivityStatus",
        activityType: "ActivityType",
        activityPriority: "ActivityPriority",
        activityDirection: "ActivityDirection",
      } as Record<string, string>)[field];
    return (statusGroup && statusValues[`${statusGroup}.${value}`]) || value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 120);
  } catch {
    return copy.valueUnreadable;
  }
}

// crm-app/src/crm/leads/dto/lead.dto.ts: UpdateLeadDto.rating is an integer 0–3.
const LEAD_RATING_MAX = 3;

function resolveChangeSide(
  value: unknown,
  field: string,
  side: "before" | "after",
  isLead: boolean,
  entityType: string,
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels?: HistoryValueLabels,
  people?: HistoryPeople,
): React.ReactNode {
  if (isAuditUserField(field) && isUUIDv7(value)) {
    return (
      <UserProfileLink
        result={people?.profiles.get(value)}
        previous={side === "before"}
        onRetry={people?.retry}
      />
    );
  }
  if (isAuditUserField(field) && Array.isArray(value) && value.length) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1">
        {value.map((item, index) => {
          const rendered = resolveChangeSide(
            item,
            field,
            side,
            isLead,
            entityType,
            copy,
            statusValues,
            valueLabels,
            people,
          );
          if (typeof rendered === "string" || typeof rendered === "number") {
            return (
              <span
                key={index}
                className={
                  side === "before"
                    ? "break-words text-danger-600 line-through dark:text-danger-300"
                    : "break-words text-foreground"
                }
                dir="auto"
              >
                {rendered}
              </span>
            );
          }
          return <span key={index}>{rendered}</span>;
        })}
      </span>
    );
  }
  // Missing/redacted/invalid evidence must keep its text marker, never become 0.
  if (
    isLead &&
    field === "rating" &&
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= LEAD_RATING_MAX
  ) {
    return (
      <RatingStars
        value={value}
        max={LEAD_RATING_MAX}
        label={formatTemplate(
          side === "before" ? copy.ratingBefore : copy.ratingAfter,
          { count: value, max: LEAD_RATING_MAX },
        )}
      />
    );
  }
  // Return string so `HistoryDiffList` applies the canonical accessible styling.
  return formatAuditScalarValue(value, field, entityType, copy, statusValues, valueLabels);
}

/** Converts audit event diffs into `HistoryDiffRow[]` for `@/design-system` `HistoryDiffList`. */
export function buildAuditDiffRows(
  changes: EntityAuditEvent["changes"],
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels: HistoryValueLabels | undefined,
  context: { entityType: string; entityId?: string | null },
  people?: HistoryPeople,
): HistoryDiffRow[] {
  return changes.map((change, index) => {
    const isLead =
      context.entityType === "Lead" &&
      (!change.subjectId || change.subjectId === context.entityId);
    const labelText = auditFieldName(change.field, copy);
    const label = change.subjectLabel ? (
      <>
        <bdi>{change.subjectLabel}</bdi> · {labelText}
      </>
    ) : (
      labelText
    );
    return {
      key: `${change.subjectId ?? ""}:${change.field}:${index}`,
      label,
      before: resolveChangeSide(
        change.before,
        change.field,
        "before",
        isLead,
        context.entityType,
        copy,
        statusValues,
        valueLabels,
        people,
      ),
      after: resolveChangeSide(
        change.after,
        change.field,
        "after",
        isLead,
        context.entityType,
        copy,
        statusValues,
        valueLabels,
        people,
      ),
    };
  });
}
