"use client";
import { Button, DateTime, EmptyState, ErrorState, PageHeader, PermissionGate,
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tabs, TabsList, TabsTrigger } from "@/design-system";
import { AuditEventDetail } from "@/components/audit/AuditEventDetail";
import { auditCatalogue } from "@/lib/audit/catalogue";
import { wireLabel } from "@/lib/format/wire-label";
import { AuditFilterPanel } from "./components/AuditFilterPanel";
import { useAuditLedger } from "./hooks/useAuditLedger";

export default function AuditPage() {
  const ledger = useAuditLedger();
  const { t, lang, events, error, isLoading } = ledger;
  const copy = t.audit.ledger;
  return <PermissionGate require={[]} denied={!ledger.canRead || error?.status === 403}>
    <div className="flex flex-col gap-4">
      <PageHeader className="sr-only" title={t.coreOperations.audit.title} description={t.coreOperations.audit.subtitle} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={ledger.deletedOnly ? "deleted" : "events"} onValueChange={ledger.changeTab}>
          <TabsList aria-label={t.coreOperations.audit.title}>
            <TabsTrigger value="events">{copy.events}</TabsTrigger><TabsTrigger value="deleted">{copy.deleted}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={ledger.reload} disabled={isLoading}>{t.common.retry}</Button>
      </div>
      <AuditFilterPanel key={String(ledger.deletedOnly)} filters={ledger.filters} onApply={ledger.applyFilters}
        disabled={isLoading} deletedOnly={ledger.deletedOnly} />
      {error ? <ErrorState title={t.coreOperations.audit.loadFailed} description={error.status ? error.message : undefined} onRetry={ledger.reload} retryLabel={t.common.retry} />
        : isLoading ? <Skeleton className="h-48 w-full" />
        : events.length === 0 ? <EmptyState title={t.coreOperations.audit.emptyTitle} description={t.coreOperations.audit.emptyDescription} />
        : <Table>
          <TableHeader><TableRow>{[copy.time, copy.record, copy.action, copy.actor, copy.app, copy.sensitivity, copy.detail].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{events.map((event) => <TableRow key={event.id}>
            <TableCell><DateTime value={event.createdAt} precision="datetime" language={lang} /></TableCell>
            <TableCell>{event.entityLabel ?? copy.entities[auditCatalogue.find((entry) => entry.entityType === event.entityType)?.labelKey ?? ""] ?? copy.unknownEntity}</TableCell>
            <TableCell>{wireLabel(t.audit.actions, event.action, t.common.unknownCode, "audit.actions")}</TableCell>
            <TableCell>{event.actorLabel ?? t.audit.actorUnknown}</TableCell>
            <TableCell>{copy.apps[event.sourceApp ?? ""] ?? copy.unknownValue}</TableCell>
            <TableCell>{copy.sensitivities[event.sensitivity ?? ""] ?? copy.unknownValue}</TableCell>
            <TableCell><Button variant="ghost" size="sm" onClick={() => ledger.setSelectedId(event.id)}>{copy.open}</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={ledger.previous} disabled={isLoading || !ledger.hasPrevious}>{t.common.previousPage}</Button>
        <Button variant="outline" size="sm" onClick={ledger.next} disabled={isLoading || !ledger.hasNext}>{t.common.nextPage}</Button>
      </div>
      <Sheet open={ledger.selectedId !== null} onOpenChange={(open) => { if (!open) ledger.setSelectedId(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader><SheetTitle>{copy.detail}</SheetTitle><SheetDescription>{t.coreOperations.audit.subtitle}</SheetDescription></SheetHeader>
          <AuditEventDetail id={ledger.selectedId} />
        </SheetContent>
      </Sheet>
    </div>
  </PermissionGate>;
}
