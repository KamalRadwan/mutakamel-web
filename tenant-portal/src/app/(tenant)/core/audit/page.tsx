"use client";

import { CircleCheck, CircleX, History, RefreshCw } from "lucide-react";
import {
  Button,
  ErrorState,
  IdentifierText,
  PageHeader,
  Pagination,
  PermissionGate,
  Timeline,
  type TimelineEvent,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { AUDIT_READ_PERMISSION } from "../contracts/audit-contract";
import { useCoreOperationsErrorText } from "../hooks/useCoreOperationsErrorText";
import { AuditFilterPanel } from "./components/AuditFilterPanel";
import { useAuditLedger } from "./hooks/useAuditLedger";

export default function AuditPage() {
  const ledger = useAuditLedger();
  const { t, lang, events, pager, isLoading, error } = ledger;
  const copy = t.coreOperations.audit;
  const describeError = useCoreOperationsErrorText();

  const timelineEvents: TimelineEvent[] = events.map((event) => ({
    id: event.id,
    title: event.action,
    timestamp: formatDateTime(event.createdAt, lang),
    actor: event.actorLabel ?? event.actorType,
    tone:
      event.outcome === "FAILURE" ? "negative" : event.outcome === "SUCCESS" ? "positive" : undefined,
    icon:
      event.outcome === "FAILURE" ? CircleX : event.outcome === "SUCCESS" ? CircleCheck : History,
    description: (
      <span className="flex flex-col gap-1">
        <span>
          {formatTemplate(copy.entityLine, {
            entityType: event.entityType,
            entityId: event.entityId ?? copy.entityUnknown,
          })}
        </span>
        <span>
          {formatTemplate(copy.outcomeLine, {
            outcome: event.outcome ? copy.outcomes[event.outcome] : copy.outcomeUnknown,
            source: event.sourceApp ?? copy.sourceUnknown,
            kind: event.sourceKind ? copy.sourceKinds[event.sourceKind] : copy.sourceUnknown,
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
  }));

  return (
    <PermissionGate require={AUDIT_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.title}
          description={copy.subtitle}
          secondaryActions={
            <Button variant="outline" onClick={ledger.reload} disabled={isLoading}>
              <RefreshCw
                className={isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <AuditFilterPanel
          filters={ledger.filters}
          onApply={ledger.applyFilters}
          disabled={isLoading}
        />

        {error ? (
          <ErrorState
            title={copy.loadFailed}
            description={describeError(error)}
            onRetry={ledger.reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <>
            <Timeline
              label={copy.title}
              events={timelineEvents}
              isLoading={isLoading}
              emptyTitle={copy.emptyTitle}
              emptyDescription={copy.emptyDescription}
            />
            {/* `hasNext`/`hasPrev` are derived from page and totalPages: this
                endpoint returns neither, unlike every other Core list. */}
            {pager.total > 0 ? (
              <Pagination
                page={{ page: pager.page, limit: pager.limit, total: pager.total }}
                onPageChange={ledger.setPage}
                labels={{
                  previous: t.common.previousPage,
                  next: t.common.nextPage,
                  summary: (from, to, total) =>
                    formatTemplate(t.common.showingOf, { from, to, total }),
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </PermissionGate>
  );
}
