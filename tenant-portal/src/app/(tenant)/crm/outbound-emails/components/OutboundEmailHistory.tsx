"use client";

import { Eye } from "lucide-react";
import { Button, DataTable, DateTime, EmptyState, IdentifierText, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { OutboundEmailListItem } from "../outbound-email-contract";
import type { useOutboundEmails } from "../hooks/useOutboundEmails";
import { EmailStatusBadge } from "./EmailStatusBadge";

export function OutboundEmailHistory({ history, onOpen }: {
  history: ReturnType<typeof useOutboundEmails>;
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const copy = t.crmOutboundEmails;
  const columns: ColumnDef<OutboundEmailListItem>[] = [
    { id: "subject", header: copy.subject, cell: (email) => <span className="text-foreground">{email.subjectPreview ?? copy.redactedSubject}</span> },
    { id: "recipient", header: copy.recipient, cell: (email) => <div className="min-w-0">
      <p className="truncate text-foreground">{email.recipient.displayName}</p>
      <p className="truncate text-badge text-muted-foreground"><IdentifierText>{email.recipient.maskedAddress}</IdentifierText></p>
    </div> },
    { id: "status", header: t.common.status, cell: (email) => <EmailStatusBadge status={email.status} /> },
    { id: "requestedAt", header: copy.requestedAt, cell: (email) => <DateTime value={email.requestedAt} /> },
    { id: "details", header: copy.details, cell: (email) => <Button size="sm" variant="outline" className="px-2"
      aria-label={`${copy.viewDetails}: ${email.subjectPreview ?? copy.redactedSubject}`} onClick={() => onOpen(email.outboundEmailId)}>
      <Eye className="size-4" aria-hidden="true" />
    </Button> },
  ];
  return <DataTable columns={columns} rows={history.items} rowKey={(email) => email.outboundEmailId}
    isLoading={history.isLoading && !history.hasLoaded} error={history.queryError} onRetry={history.reload}
    emptyState={<EmptyState title={history.status ? copy.emptyFiltered : copy.empty}
      description={history.status ? copy.emptyFilteredHint : copy.emptyHint}
      action={history.status ? { label: copy.clearStatus, onClick: () => history.setStatus("") } : undefined} />}
    labels={{ retry: t.common.retry, errorTitle: copy.loadFailed,
      emptyTitle: history.status ? copy.emptyFiltered : copy.empty,
      selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending,
      sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
      pagination: { previous: t.common.previousPage, next: t.common.nextPage,
        summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) },
    }} />;
}
