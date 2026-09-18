"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DetailSection,
  ErrorState,
  Timeline,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  AUDIT_HISTORY_PAGE_SIZE,
  AUDIT_READ_PERMISSION,
  fetchEntityHistory,
  type EntityAuditEvent,
} from "@/lib/audit/entity-history-contract";

import { toTimelineEvent } from "./EntityHistoryEvent";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useAuditReferenceLabels } from "@/hooks/useAuditReferenceLabels";
import { auditUserIds } from "@/lib/audit/history-references";

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
  const people = useUserProfiles(auditUserIds(events), canRead && !!entityId, refreshToken);
  const resolvedLabels = useAuditReferenceLabels(events, valueLabels, canRead && !!entityId, refreshToken);
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
            toTimelineEvent(event, lang, copy, t.statusValues, resolvedLabels, { entityType, entityId }, people),
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
