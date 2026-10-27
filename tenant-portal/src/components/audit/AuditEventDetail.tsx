"use client";
import Link from "next/link";
import { DateTime, DetailSection, ErrorState, NotFoundState, PermissionGate, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useAuditEvent } from "./hooks/useAuditEvent";
import { auditRecordHref } from "@/lib/audit/catalogue";
import { wireLabel } from "@/lib/format/wire-label";

function snapshotValue(value: unknown, empty: string): string {
  if (value === undefined || value === null) return empty;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? empty;
}

export function AuditEventDetail({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const { event, error, isLoading, canRead, reload } = useAuditEvent(id);
  const copy = t.audit.ledger;
  const recordHref = event && event.action !== "DELETE" && event.action !== "SOFT_DELETE"
    ? auditRecordHref(event.entityType, event.entityId) : null;
  return <PermissionGate require={[]} denied={!canRead || error?.status === 403}>
    {isLoading ? <Skeleton className="h-48 w-full" /> : null}
    {error?.status === 404 ? <NotFoundState title={copy.notFound} description={copy.notFoundDescription}
      backHref="/core/audit" backLabel={t.common.back} /> : error ? <ErrorState title={t.audit.loadFailed}
        description={error.status ? error.message : undefined} onRetry={reload} retryLabel={t.common.retry} /> : null}
    {event ? <div className="flex min-w-0 flex-col gap-4">
      <p className="break-words text-sm">{event.entityLabel ?? copy.unknownEntity}</p>
      <p className="text-sm">{wireLabel(t.audit.actions, event.action, t.common.unknownCode, "audit.actions")}</p>
      {event.outcome ? <p className="text-sm">{wireLabel(t.coreOperations.audit.outcomes, event.outcome, t.common.unknownCode, "coreOperations.audit.outcomes")}</p> : null}
      {recordHref ? <Link className="text-sm text-primary underline" href={recordHref}>{copy.liveRecord}</Link> : null}
      <p className="text-xs text-muted-foreground">{event.actorLabel ?? t.audit.actorUnknown} · <DateTime value={event.createdAt} precision="datetime" language={lang} /></p>
      {event.reason ? <p className="break-words text-sm">{event.reason}</p> : null}
      <Table>
        <TableHeader><TableRow><TableHead>{copy.field}</TableHead><TableHead>{copy.before}</TableHead><TableHead>{copy.after}</TableHead></TableRow></TableHeader>
        <TableBody>{event.diff.map((change, index) => <TableRow key={`${change.field}:${index}`}>
          <TableCell>{change.subjectLabel ? `${change.subjectLabel} · ` : ""}{t.audit.fields[change.field] ?? change.field}</TableCell>
          <TableCell className="whitespace-pre-wrap break-words">{snapshotValue(change.before, t.audit.valueEmpty)}</TableCell>
          <TableCell className="whitespace-pre-wrap break-words">{snapshotValue(change.after, t.audit.valueEmpty)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      {event.diff.length === 0 ? <p className="text-sm text-muted-foreground">{t.audit.detailsNotRecorded}</p> : null}
      <DetailSection title={copy.snapshot}>
        <h3 className="text-sm font-medium">{copy.before}</h3>
        <pre className="max-w-full whitespace-pre-wrap break-words text-xs">{snapshotValue(event.before, t.audit.valueEmpty)}</pre>
        <h3 className="text-sm font-medium">{copy.after}</h3>
        <pre className="max-w-full whitespace-pre-wrap break-words text-xs">{snapshotValue(event.after, t.audit.valueEmpty)}</pre>
      </DetailSection>
    </div> : null}
  </PermissionGate>;
}
