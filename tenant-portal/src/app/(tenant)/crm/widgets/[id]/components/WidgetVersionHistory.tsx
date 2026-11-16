"use client";

import { History } from "lucide-react";
import { Badge, Button, DateTime, PermissionGate, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { useWidgetHistory } from "../hooks/useWidgetHistory";

interface Props {
  history: ReturnType<typeof useWidgetHistory>;
  activeVersion: number | null;
  draftVersion?: number;
  draftName?: string;
  draftUpdatedAt?: string;
}

export function WidgetVersionHistory({ history, activeVersion, draftVersion, draftName, draftUpdatedAt }: Props) {
  const { t, lang } = useI18n();
  const labels = t.crmWidgets.lifecycle.history;
  const draftLabel = t.crmWidgets.lifecycle.statuses.DRAFT;
  if (history.error?.status === 403) return <PermissionGate require="crm.widgets.read" denied>{null}</PermissionGate>;
  return <section aria-label={labels.title} className="min-w-0 space-y-3 rounded-card border border-border bg-card p-4">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4" aria-hidden="true" />{labels.title}</h2>
    <div className="rounded-md border border-border">
      <Table aria-label={labels.title}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{labels.version}</TableHead>
            <TableHead scope="col">{t.crmWidgets.lifecycle.status}</TableHead>
            <TableHead scope="col" className="whitespace-nowrap">{labels.date}</TableHead>
            <TableHead scope="col">{labels.definition}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {draftVersion !== undefined && <TableRow>
            <TableCell>{formatNumber(draftVersion, lang)}</TableCell>
            <TableCell><Badge tone="neutral">{draftLabel}</Badge></TableCell>
            <TableCell className="whitespace-nowrap">{draftUpdatedAt ? <DateTime value={draftUpdatedAt} /> : labels.unknownDate}</TableCell>
            <TableCell>{draftName || t.crmWidgets.lifecycle.untitledDraft}</TableCell>
          </TableRow>}
          {history.items.map((entry) => {
            const active = entry.versionNumber === activeVersion;
            return <TableRow key={entry.versionNumber}>
              <TableCell>{formatNumber(entry.versionNumber, lang)}</TableCell>
              <TableCell><Badge tone={active ? "positive" : "neutral"}>{active ? labels.active : labels.superseded}</Badge></TableCell>
              <TableCell className="whitespace-nowrap">{entry.publishedAt ? <DateTime value={entry.publishedAt} /> : labels.unknownDate}</TableCell>
              <TableCell><p>{entry.name}</p><p className="text-xs text-muted-foreground">{labels.provenance[entry.provenance]}</p></TableCell>
            </TableRow>;
          })}
        </TableBody>
      </Table>
    </div>
    {history.loading && <p role="status" className="text-xs text-muted-foreground">{labels.loading}</p>}
    {history.failed && <div className="flex flex-wrap items-center gap-2">
      <p role="alert" className="text-sm text-muted-foreground">{labels.unavailable}</p>
      <Button variant="outline" size="sm" disabled={history.loading} onClick={history.retry}>{t.common.retry}</Button>
    </div>}
    {!history.loading && !history.failed && history.items.length === 0 &&
      <p className="text-sm text-muted-foreground">{labels.empty}</p>}
    {history.hasMore && <Button variant="outline" size="sm" disabled={history.loading} loading={history.loading} onClick={history.loadMore}>{labels.more}</Button>}
  </section>;
}
