"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, History } from "lucide-react";
import {
  DetailSection,
  ErrorState,
  Timeline,
  type TimelineEvent,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTimeNumeric } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import {
  AUDIT_HISTORY_PAGE_SIZE,
  AUDIT_READ_PERMISSION,
  fetchEntityHistory,
  type EntityAuditEvent,
} from "@/lib/audit/entity-history-contract";

export interface EntityHistoryCardProps {
  /** The ledger's own name for this kind of record — `lead`, `invoice`. */
  entityType: string;
  entityId: string | null;
  relatedPartyIds?: readonly string[];
  /** Change after a committed save, including changes that leave Lead.updatedAt untouched. */
  refreshToken?: object | number;
  valueLabels?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  density?: "standard" | "compact";
}

/**
 * **The history card.** One record's audit log: who did it, when, and what
 * happened — on any screen, in any app.
 *
 * This is the template to reach for the next time a detail screen needs one.
 * It lives in `src/components/` for the reason `src/components/address/` does:
 * a component two screens share cannot sit inside either of them
 * (file-architecture.md#dependency-direction), and it reads an API, so it
 * cannot sit in `design-system/` either — that layer may import `lib/format`
 * and `i18n`, and nothing else.
 *
 * `audit.read` gates it, and a user without that permission gets **nothing**
 * rather than an empty card: an audit log they may not read is not a log with
 * no entries, and a card saying "no history" would be a different claim.
 *
 * Paging appends rather than replaces, because the surface is a timeline: a
 * reader following an incident scrolls back through time, and a pager that
 * swapped the visible rows would break that reading.
 */
export function EntityHistoryCard({ entityType, entityId, relatedPartyIds, refreshToken, valueLabels, density }: EntityHistoryCardProps) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const copy = t.audit;
  const canRead = user?.permissions.includes(AUDIT_READ_PERMISSION) ?? false;

  const [events, setEvents] = useState<EntityAuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  // Bumped to ask again. A counter rather than a callback the effect depends
  // on: the effect owns the AbortController, so a retry has to go through it or
  // a slow first response can land after a fast second one.
  const [reloadCount, setReloadCount] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const relatedKey = [...new Set(relatedPartyIds ?? [])].sort().join(",");

  useEffect(() => {
    if (!entityId || !canRead) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    // Deferred past the effect body: a synchronous setState there cascades a
    // render, which `react-hooks/set-state-in-effect` rejects.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setIsLoadingMore(false);
      setFailed(false);
      void (async () => {
        try {
          const first = await fetchEntityHistory(
            entityType,
            entityId,
            1,
            AUDIT_HISTORY_PAGE_SIZE,
            controller.signal,
            relatedKey ? relatedKey.split(",") : undefined,
          );
          if (controller.signal.aborted) return;
          setEvents(first.events);
          setHasNext(first.hasNext);
          setPage(1);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setEvents([]);
          setHasNext(false);
          setFailed(true);
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      })();
    });
    return () => controller.abort();
  }, [entityType, entityId, canRead, reloadCount, relatedKey, refreshToken]);

  const loadMore = useCallback(() => {
    const controller = activeRequest.current;
    if (!entityId || !canRead || isLoading || isLoadingMore || !controller || controller.signal.aborted) return;
    setIsLoadingMore(true);
    void (async () => {
      try {
        const next = await fetchEntityHistory(
          entityType,
          entityId,
          page + 1,
          AUDIT_HISTORY_PAGE_SIZE,
          controller.signal,
          relatedKey ? relatedKey.split(",") : undefined,
        );
        if (controller.signal.aborted) return;
        setEvents((current) => {
          const seen = new Set(current.map((event) => event.id));
          return [...current, ...next.events.filter((event) => !seen.has(event.id))];
        });
        setHasNext(next.hasNext);
        setPage((current) => current + 1);
      } catch {
        if (controller.signal.aborted) return;
        // The page already on screen stays. A failed "load more" is not a
        // reason to throw away the history a reader is in the middle of.
        setHasNext(false);
      } finally {
        if (!controller.signal.aborted) setIsLoadingMore(false);
      }
    })();
  }, [entityType, entityId, page, isLoading, isLoadingMore, canRead, relatedKey]);

  if (!canRead) return null;

  return (
    <DetailSection title={copy.historyTitle} density={density}>
      {failed ? (
        <ErrorState
          title={copy.loadFailed}
          onRetry={() => setReloadCount((count) => count + 1)}
          retryLabel={t.common.retry}
        />
      ) : (
        <Timeline
          density={density}
          label={copy.historyTitle}
          events={events.map((event) =>
            toTimelineEvent(event, lang, copy, t.statusValues, valueLabels),
          )}
          isLoading={isLoading}
          emptyTitle={copy.historyEmptyTitle}
          emptyDescription={copy.historyEmptyDescription}
          onLoadMore={hasNext ? loadMore : undefined}
          loadMoreLabel={copy.loadMore}
          isLoadingMore={isLoadingMore}
        />
      )}
    </DetailSection>
  );
}

type AuditCopy = ReturnType<typeof useI18n>["t"]["audit"];

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
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels: EntityHistoryCardProps['valueLabels'],
): string {
  if (value === null || value === undefined || value === "") return copy.valueEmpty;
  if (value === "[NOT_RECORDED]") return copy.valueNotRecorded;
  if (Array.isArray(value)) return value.length
    ? value.map((item) => changeValue(item, field, copy, statusValues, valueLabels)).join(", ") : copy.valueEmpty;
  if (typeof value === "string") {
    if (valueLabels?.[field]) return valueLabels[field][value] || copy.valueUnavailable;
    if (field === "activityEvent") return copy.actions[value] || copy.valueUnavailable;
    const statusGroup =
      ({ stageFlag: "LeadStageFlag", status: "LeadStatus", activityStatus: "ActivityStatus",
        activityType: "ActivityType", activityPriority: "ActivityPriority", activityDirection: "ActivityDirection" } as Record<string, string>)[field];
    return (statusGroup && statusValues[`${statusGroup}.${value}`]) || value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 120);
  } catch {
    return copy.valueUnreadable;
  }
}

function toTimelineEvent(
  event: EntityAuditEvent,
  lang: "ar" | "en",
  copy: AuditCopy,
  statusValues: Record<string, string | undefined>,
  valueLabels: EntityHistoryCardProps['valueLabels'],
): TimelineEvent {
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
        {event.changes.length > 0 ? (
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
                  <span
                    className="break-words text-danger-600 line-through dark:text-danger-300"
                    dir="auto"
                  >
                    {changeValue(change.before, change.field, copy, statusValues, valueLabels)}
                  </span>
                  <span className="text-muted-foreground">
                    &gt;
                  </span>
                  <span className="break-words text-foreground" dir="auto">
                    {changeValue(change.after, change.field, copy, statusValues, valueLabels)}
                  </span>
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
