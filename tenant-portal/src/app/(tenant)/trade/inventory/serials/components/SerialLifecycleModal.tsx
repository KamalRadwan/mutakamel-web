"use client";

import { ArrowRight, ChevronDown, History, RefreshCw } from "lucide-react";
import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, CopyButton, DetailSection, Dialog, DialogContent, DialogDescription, DialogTitle, EmptyState, ErrorState, IdentifierText, NotFoundState, PermissionGate, Skeleton, Timeline } from "@/design-system";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { inventoryMessage } from "../../inventory-messages";
import { useInventorySerial } from "../[id]/hooks/useInventorySerial";

export function SerialLifecycleModal({ id, onClose, onRestoreFocus }: { id: string; onClose: () => void; onRestoreFocus: (event: Event) => void }) {
  const vm = useInventorySerial(id);
  const { t, lang, serial, references } = vm;
  const copy = t.tradeInventory.readViews;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent size="2xl" onCloseAutoFocus={onRestoreFocus} className="max-h-[90dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0">
      <header className="border-b border-border px-5 py-4 pe-16">
        <DialogTitle><bdi>{serial?.serialKey ?? t.tradeInventory.serialDetailTitle}</bdi></DialogTitle>
        <DialogDescription className="mt-1 text-sm">{serial ? references.itemLabel(serial.itemId) : t.tradeInventory.serialsSubtitle}</DialogDescription>
      </header>
      <div className="min-h-0 overflow-y-auto p-5">
        {vm.isNotFound ? <NotFoundState title={t.tradeInventory.serialNotFound} description={t.tradeInventory.serialNotFoundDescription} backLabel={t.common.close} onBack={onClose} />
          : !vm.isScopeResolved ? <EmptyState title={t.tradeInventory.selectCompanyFirst} description={t.tradeInventory.selectCompanyFirstDescription} />
          : <PermissionGate require={vm.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!vm.canRead || vm.queryError?.status === 403}>
            {vm.isLoading ? <Skeleton className="h-72" /> : vm.queryError ? <ErrorState title={t.tradeInventory.serialLoadFailed} description={inventoryMessage(vm.queryError, t) ?? t.tradeInventory.serialLoadFailed} onRetry={() => void vm.reload()} retryLabel={t.common.retry} /> : serial && <RecordHistoryTab entityType="InventorySerialUnitEntity" entityId={serial.id}>
              <div className="flex flex-col gap-4">
                <DetailSection title={t.tradeInventory.serialDetailTitle} density="compact" fields={[
                  { label: t.tradeInventory.serialState, value: <Badge tone={serial.state === "ON_HAND" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, serial.state, t.common.unknownCode)}</Badge> },
                  { label: t.tradeInventory.currentNode, value: <bdi>{serial.currentFulfillmentNodeId ? references.nodeLabel(serial.currentFulfillmentNodeId) : t.tradeInventory.serialNoCustody}</bdi> },
                  { label: copy.item, value: <bdi>{references.itemLabel(serial.itemId)}</bdi> },
                  { label: copy.unit, value: serial.currentUomId ? <bdi>{references.uomLabel(serial.currentUomId)}</bdi> : t.tradeInventory.readViews.notSet },
                  { label: t.tradeInventory.lastTransitionAt, value: formatDateTime(serial.lastTransitionAt, lang) },
                ]} />
                <DetailSection title={t.tradeInventory.serialLifecycle} description={copy.lifecycleLimit} density="compact">
                  <p className="text-sm text-muted-foreground">{formatTemplate(t.tradeInventory.serialEventsCount, { count: formatNumber(serial.lifecycle.length, lang) })}</p>
                  <Timeline label={t.tradeInventory.serialLifecycle} emptyTitle={t.tradeInventory.serialLifecycleEmpty} density="compact" events={serial.lifecycle.map((event) => ({
                    id: event.id, title: tradeStatusLabel(copy.events, event.eventType, t.common.unknownCode),
                    timestamp: formatDateTime(event.occurredAt, lang), icon: History,
                    description: <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {event.fromState && <><span><span className="sr-only">{copy.fromState}: </span>{tradeStatusLabel(t.tradeStatus, event.fromState, t.common.unknownCode)}</span><ArrowRight className="size-3 rtl:-scale-x-100" aria-hidden="true" /></>}
                      {event.toState && <span><span className="sr-only">{copy.toState}: </span>{tradeStatusLabel(t.tradeStatus, event.toState, t.common.unknownCode)}</span>}
                      {event.fulfillmentNodeId && <bdi>{references.nodeLabel(event.fulfillmentNodeId)}</bdi>}
                      {event.uomId && <bdi>{references.uomLabel(event.uomId)}</bdi>}
                    </div>,
                    children: event.sourceId || event.reservationId || event.ledgerEntryId ? <Collapsible><CollapsibleTrigger className="text-xs text-muted-foreground">{copy.technicalDetails}<ChevronDown className="size-3" aria-hidden="true" /></CollapsibleTrigger><CollapsibleContent className="pt-2"><dl className="flex flex-col gap-2 text-xs">
                      {event.sourceType && <div><dt className="text-muted-foreground">{copy.sourceTypeLabel}</dt><dd><IdentifierText className="text-xs">{event.sourceType}</IdentifierText></dd></div>}
                      {event.sourceId && <div><dt className="text-muted-foreground">{copy.sourceReference}</dt><dd><IdentifierText className="text-xs">{event.sourceId}</IdentifierText></dd></div>}
                      {event.reservationId && <div><dt className="text-muted-foreground">{t.tradeInventory.reservationId}</dt><dd><IdentifierText className="text-xs">{event.reservationId}</IdentifierText></dd></div>}
                      {event.ledgerEntryId && <div><dt className="text-muted-foreground">{copy.ledgerReference}</dt><dd><IdentifierText className="text-xs">{event.ledgerEntryId}</IdentifierText></dd></div>}
                    </dl></CollapsibleContent></Collapsible> : undefined,
                  }))} />
                </DetailSection>
                <Collapsible><CollapsibleTrigger className="text-sm text-muted-foreground">{copy.technicalDetails}<ChevronDown className="size-4" aria-hidden="true" /></CollapsibleTrigger>
                  <CollapsibleContent className="pt-3"><DetailSection title={copy.technicalDetails} density="compact" fields={[
                    { label: copy.recordReference, value: <div className="flex flex-wrap items-center gap-2"><IdentifierText>{serial.id}</IdentifierText><CopyButton value={serial.id} copyLabel={copy.copyReference} copiedLabel={t.tradeInventory.readViews.copied} failedLabel={t.tradeInventory.readViews.copyFailed} showLabel /></div> },
                    { label: t.tradeInventory.itemId, value: <IdentifierText>{serial.itemId}</IdentifierText> },
                    { label: t.tradeInventory.itemCompanyProfileId, value: <IdentifierText>{serial.itemCompanyProfileId}</IdentifierText> },
                    { label: t.tradeInventory.reservationId, value: serial.currentReservationId ? <IdentifierText>{serial.currentReservationId}</IdentifierText> : t.tradeInventory.readViews.notSet },
                  ]} /></CollapsibleContent>
                </Collapsible>
              </div>
            </RecordHistoryTab>}
          </PermissionGate>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3"><Button variant="outline" size="sm" onClick={() => void vm.reload()} loading={vm.isRefreshing} disabled={!vm.canRead || vm.isNotFound}><RefreshCw className="size-4" aria-hidden="true" />{t.tradeCommon.reload}</Button><Button variant="outline" size="sm" onClick={onClose}>{t.common.close}</Button></footer>
    </DialogContent>
  </Dialog>;
}
