"use client";

import { CircleCheck, CircleX, History } from "lucide-react";
import {
  DetailSection,
  ErrorState,
  IdentifierText,
  PermissionGate,
  Timeline,
  type TimelineEvent,
} from "@/design-system";
import type { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { AUDIT_READ_PERMISSION, type AuditEvent } from "../contracts/audit-contract";
import { useCoreOperationsErrorText } from "../hooks/useCoreOperationsErrorText";
import { useEntityHistory } from "../hooks/useEntityHistory";

/**
 * The per-record audit history every Core detail screen embeds (task 7.21).
 *
 * `outcome` and `reason` are rendered, never dropped: a row that only says
 * "user X updated Y" throws away the half that matters during an incident
 * (docs/api/core-directory.md#audit--2-routes).
 */
export function EntityHistoryPanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string | null;
}) {
  const { t, lang, canRead, events, isLoading, isLoadingMore, error, hasNext, loadMore, reload } =
    useEntityHistory(entityType, entityId);
  const copy = t.coreOperations.audit;
  const describeError = useCoreOperationsErrorText();

  if (!canRead) {
    return (
      <DetailSection title={copy.historyTitle} description={copy.historyDescription}>
        <PermissionGate require={AUDIT_READ_PERMISSION}>{null}</PermissionGate>
      </DetailSection>
    );
  }

  return (
    <DetailSection title={copy.historyTitle} description={copy.historyDescription}>
      {error ? (
        <ErrorState
          title={copy.loadFailed}
          description={describeError(error)}
          onRetry={reload}
          retryLabel={t.common.retry}
        />
      ) : (
        <Timeline
          label={copy.historyTitle}
          events={events.map((event) => toTimelineEvent(event, lang, copy))}
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

type AuditCopy = ReturnType<typeof useI18n>["t"]["coreOperations"]["audit"];

function toTimelineEvent(
  event: AuditEvent,
  lang: Language,
  copy: AuditCopy,
): TimelineEvent {
  const outcomeLabel = event.outcome ? copy.outcomes[event.outcome] : copy.outcomeUnknown;
  return {
    id: event.id,
    title: event.action,
    timestamp: formatDateTime(event.createdAt, lang),
    actor: event.actorLabel ?? event.actorType,
    tone: event.outcome === "FAILURE" ? "negative" : event.outcome === "SUCCESS" ? "positive" : undefined,
    icon: event.outcome === "FAILURE" ? CircleX : event.outcome === "SUCCESS" ? CircleCheck : History,
    description: (
      <span className="flex flex-col gap-1">
        <span>
          {formatTemplate(copy.outcomeLine, {
            outcome: outcomeLabel,
            source: event.sourceApp ?? copy.sourceUnknown,
            kind: event.sourceKind ?? copy.sourceUnknown,
          })}
        </span>
        {event.reason ? (
          <span className="text-foreground">
            {formatTemplate(copy.reasonLine, { reason: event.reason })}
          </span>
        ) : null}
        {event.correlationId ? (
          <IdentifierText className="text-xs text-muted-foreground">
            {formatTemplate(copy.referenceLine, { reference: event.correlationId })}
          </IdentifierText>
        ) : null}
      </span>
    ),
  };
}
