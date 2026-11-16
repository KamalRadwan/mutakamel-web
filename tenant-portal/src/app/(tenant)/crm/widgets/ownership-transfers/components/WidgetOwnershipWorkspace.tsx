"use client";

import { RefreshCw, Search, UserCog } from "lucide-react";
import { Badge, Button, DegradedBanner, EmptyState, ErrorState, Input, PageHeader, PermissionGate, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { CRM_WIDGET_TRANSFER_PERMISSION } from "@/lib/navigation/tenant-routes";
import { useTransferWidgetList } from "../hooks/useTransferWidgetList";
import { useWidgetOwnershipTransfer } from "../hooks/useWidgetOwnershipTransfer";
import { WidgetOwnershipDialog } from "./WidgetOwnershipDialog";

export function WidgetOwnershipWorkspace() {
  const { t, lang } = useI18n();
  const labels = t.crmWidgets.ownership;
  const list = useTransferWidgetList();
  const transfer = useWidgetOwnershipTransfer(list.refresh);
  const { visible } = list;
  const { recovery, recoveryId, recoveryReady, readOnly } = transfer;
  if (visible?.error?.status === 403) return <PermissionGate require={CRM_WIDGET_TRANSFER_PERMISSION} denied>{null}</PermissionGate>;
  const version = (value: number | null) => value === null ? "—" : formatNumber(value, lang);
  const recoveryText = recovery?.widget === null ? labels.deleted : recovery?.widget ? formatTemplate(labels.recoveryOwner, {
    widget: recovery.widget.name, owner: recovery.widget.ownerName ?? labels.unknownOwner,
  }) : null;
  return <div className="flex w-full flex-col gap-4 px-1 pb-6 sm:px-3">
    <PageHeader title={labels.title} description={labels.description} secondaryActions={
      <Button variant="outline" disabled={visible?.loading} onClick={() => void list.refresh()}>
        <RefreshCw className="size-4" aria-hidden="true" />{t.connectivity.reload}
      </Button>} />
    <form role="search" onSubmit={(event) => { event.preventDefault(); list.search(); }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <div className="relative min-w-0 flex-1 sm:max-w-lg">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" className="ps-8" aria-label={labels.search} placeholder={labels.search}
          maxLength={120} value={list.input} onChange={(event) => list.setInput(event.target.value)} />
      </div>
      <Button type="submit" variant="outline" disabled={visible?.loading}>{labels.searchAction}</Button>
      <Badge tone="neutral">{labels.metadataOnly}</Badge>
    </form>
    {readOnly && <p role="note" className="text-sm text-muted-foreground">{labels.readOnly}</p>}
    {transfer.blocked && !recoveryId && <DegradedBanner message={labels.blocked} />}
    {recoveryId && <section className="space-y-2 rounded-lg border border-border bg-card p-3" aria-label={labels.checkCurrent}>
      <DegradedBanner message={labels.uncertain} />
      {recovery?.error?.status === 403 ? <PermissionGate require={CRM_WIDGET_TRANSFER_PERMISSION} denied>{null}</PermissionGate>
        : recovery?.error && <p role="alert" className="text-sm text-destructive">{labels.unavailable}</p>}
      {recoveryText && <p role="status" className="text-sm">{recoveryText}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" loading={recovery?.loading} disabled={recovery?.loading}
          onClick={() => void transfer.checkCurrent()}>{labels.checkCurrent}</Button>
        <Button variant="outline" disabled={!recoveryReady} onClick={transfer.reviewRecovery}>{labels.resume}</Button>
      </div>
    </section>}
    {visible?.error ? <ErrorState title={labels.unavailable} onRetry={() => void list.refresh()} retryLabel={t.common.retry} />
      : !visible || (visible.loading && !visible.items.length) ? <div role="status" aria-label={labels.loading}><Skeleton className="h-32 w-full" /></div>
        : visible.items.length === 0 ? <EmptyState title={labels.empty} />
          : <div className="rounded-lg border border-border bg-card">
            <Table aria-label={labels.title} aria-busy={visible.loading}>
              <TableHeader><TableRow>
                <TableHead scope="col">{t.crmWidgets.name}</TableHead>
                <TableHead scope="col">{labels.currentOwner}</TableHead>
                <TableHead scope="col">{t.common.status}</TableHead>
                <TableHead scope="col">{t.crmWidgets.lifecycle.currentVersion}</TableHead>
                <TableHead scope="col">{t.crmWidgets.lifecycle.statuses.DRAFT}</TableHead>
                {!readOnly && <TableHead scope="col">{t.common.actions}</TableHead>}
              </TableRow></TableHeader>
              <TableBody>{visible.items.map((widget) => <TableRow key={widget.id}>
                <TableCell><span className="break-words font-medium">{widget.name}</span></TableCell>
                <TableCell>{widget.ownerName ?? labels.unknownOwner}</TableCell>
                <TableCell><Badge tone={!widget.archived && widget.activeVersionNumber !== null ? "positive" : "neutral"}>
                  {t.crmWidgets.lifecycle.statuses[widget.archived ? "ARCHIVED" : widget.activeVersionNumber === null ? "DRAFT" : "PUBLISHED"]}
                </Badge></TableCell>
                <TableCell>{version(widget.activeVersionNumber)}</TableCell>
                <TableCell>{version(widget.draftRevision)}</TableCell>
                {!readOnly && <TableCell><Button variant="outline" size="sm" aria-disabled={!transfer.allowed || visible.loading}
                  className="aria-disabled:opacity-50"
                  aria-label={formatTemplate(labels.openNamed, { name: widget.name })}
                  onClick={(event) => { if (!visible.loading) transfer.open(widget.id, event.currentTarget); }}>
                  <UserCog className="size-4" aria-hidden="true" />{labels.open}
                </Button></TableCell>}
              </TableRow>)}</TableBody>
            </Table>
          </div>}
    {visible?.cursor && !visible.error && <div><Button variant="outline" disabled={visible.loading} onClick={list.more}>{labels.more}</Button></div>}
    <WidgetOwnershipDialog transfer={transfer} />
  </div>;
}
