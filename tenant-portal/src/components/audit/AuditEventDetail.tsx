"use client";

import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  Badge,
  DateTime,
  DetailSection,
  ErrorState,
  HistoryDiffList,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { auditRecordHref } from "@/lib/audit/catalogue";
import { formatTemplate } from "@/lib/format/template";
import { wireLabel } from "@/lib/format/wire-label";
import { actionIconFor, actorInitials, humanizeAuditAction } from "./EntityHistoryEvent";
import { buildAuditDiffRows } from "./HistoryChangeValue";
import { useAuditEvent } from "./hooks/useAuditEvent";

function snapshotValue(value: unknown, empty: string): string {
  if (value === undefined || value === null) return empty;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? empty;
}

export function AuditEventDetail({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const { event, error, isLoading, canRead, reload } = useAuditEvent(id);
  const copy = t.audit.ledger;
  const recordHref =
    event && event.action !== "DELETE" && event.action !== "SOFT_DELETE"
      ? auditRecordHref(event.entityType, event.entityId)
      : null;

  return (
    <PermissionGate require={[]} denied={!canRead || error?.status === 403}>
      {isLoading ? <Skeleton className="h-48 w-full" /> : null}
      {error?.status === 404 ? (
        <NotFoundState
          title={copy.notFound}
          description={copy.notFoundDescription}
          backHref="/core/audit"
          backLabel={t.common.back}
        />
      ) : error ? (
        <ErrorState
          title={t.audit.loadFailed}
          description={error.status ? error.message : undefined}
          onRetry={reload}
          retryLabel={t.common.retry}
        />
      ) : null}

      {event ? (
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection title={event.entityLabel ?? copy.unknownEntity} columns={1}>
            {/* Level 1: Actor - Date */}
            <div className="flex flex-wrap items-center gap-2">
              <Avatar className="size-5">
                <AvatarFallback className="text-xs">
                  {actorInitials(event.actorLabel ?? t.audit.actorUnknown)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-foreground">
                {event.actorLabel ?? t.audit.actorUnknown}
              </span>
              <span aria-hidden="true" className="text-xs text-muted-foreground">
                -
              </span>
              <span className="text-xs text-muted-foreground">
                <DateTime value={event.createdAt} precision="datetime" language={lang} />
              </span>
            </div>

            {/* Level 2: Action Title + Outcome + Live Record Link */}
            <div className="ms-2.5 flex flex-col gap-2 border-s border-border ps-3">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const ActionIcon = actionIconFor(event.action);
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
                      <ActionIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{humanizeAuditAction(event.action, t.audit)}</span>
                    </span>
                  );
                })()}
                {event.outcome ? (
                  <Badge
                    tone={event.outcome === "FAILURE" ? "negative" : "neutral"}
                    size="sm"
                  >
                    {wireLabel(
                      t.coreOperations.audit.outcomes,
                      event.outcome,
                      t.common.unknownCode,
                      "coreOperations.audit.outcomes",
                    )}
                  </Badge>
                ) : null}
                {recordHref ? (
                  <Link className="text-xs font-semibold text-primary underline" href={recordHref}>
                    {copy.liveRecord}
                  </Link>
                ) : null}
              </div>

              {/* Level 3: Shared HistoryDiffList */}
              <div className="rounded-md border border-border bg-muted/30 p-2.5">
                <HistoryDiffList
                  rows={buildAuditDiffRows(
                    event.diff,
                    t.audit,
                    t.statusValues,
                    undefined,
                    { entityType: event.entityType, entityId: event.entityId },
                  )}
                  emptyMessage={t.audit.detailsNotRecorded}
                  footer={
                    event.reason
                      ? formatTemplate(t.audit.reasonLine, { reason: event.reason })
                      : undefined
                  }
                />
              </div>
            </div>
          </DetailSection>

          <DetailSection title={copy.snapshot} columns={1}>
            <h3 className="text-sm font-medium">{copy.before}</h3>
            <pre className="max-w-full whitespace-pre-wrap break-words text-xs">
              {snapshotValue(event.before, t.audit.valueEmpty)}
            </pre>
            <h3 className="text-sm font-medium">{copy.after}</h3>
            <pre className="max-w-full whitespace-pre-wrap break-words text-xs">
              {snapshotValue(event.after, t.audit.valueEmpty)}
            </pre>
          </DetailSection>
        </div>
      ) : null}
    </PermissionGate>
  );
}
