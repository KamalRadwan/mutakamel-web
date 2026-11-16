"use client";
import { Badge, Button, DataTable, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatDecimalString } from "@/lib/format/number";
import type { SessionMovementEntry } from "../movements-contract";
import type { useInventoryMovements } from "../hooks/useInventoryMovements";
import type { MovementDialog } from "../hooks/useMovementWorkspace";

export function MovementSessionLedger({ controller, onOpen }: {
  controller: ReturnType<typeof useInventoryMovements>; onOpen: (dialog: MovementDialog) => void;
}) {
  const { t, lang } = useI18n();
  const names = { openingBalance: t.tradeInventory.openingBalanceTab, reservation: t.tradeInventory.reservationTab,
    receipt: t.tradeInventory.receiptTab, delivery: t.tradeInventory.deliveryTab };
  const columns: ColumnDef<SessionMovementEntry>[] = [
    { id: "kind", header: t.tradeInventory.movementOperation, cell: row => names[row.kind] },
    { id: "source", header: t.tradeInventory.movementSource, cell: row => row.display?.sourceLabel ?? "—" },
    { id: "node", header: t.tradeInventory.movementNode, cell: row => row.display?.nodeLabel ?? controller.knownNodes.find(node => node.id === row.nodeId)?.name ?? t.common.nameUnavailable },
    { id: "status", header: t.common.status, cell: row => <Badge tone={row.status === "POSTED" ? "positive" : "neutral"}>{t.tradeStatus[row.status] ?? t.common.nameUnavailable}</Badge> },
    { id: "result", header: t.tradeInventory.movementResult, cell: row => row.reservation
      ? <span className="tabular-nums"><bdi>{formatDecimalString(row.reservation.quantity, lang, { maximumFractionDigits: 8 })}</bdi> {t.tradeInventory.reserved}
        {row.reservation.backorderedQuantity ? <> · <bdi>{formatDecimalString(row.reservation.backorderedQuantity, lang, { maximumFractionDigits: 8 })}</bdi> {t.tradeInventory.movementBackordered}</> : null}</span>
      : row.summary },
    { id: "time", header: t.tradeInventory.movementRecordedAt, cell: row => formatDateTime(row.recordedAt, lang) },
    { id: "actions", header: t.common.actions, cell: row => {
      const canPost = row.kind === "receipt" ? controller.canReceive : controller.canDeliver;
      const canReverse = controller.canAdjust && ["POSTED", "PARTIALLY_REVERSED"].includes(row.status) && (row.kind === "receipt" || row.kind === "delivery");
      const canRelease = controller.canReserve && row.kind === "reservation" && ["ACTIVE", "PARTIALLY_RELEASED", "PARTIALLY_CONSUMED"].includes(row.status);
      return <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" disabled={controller.pending !== null} onClick={() => onOpen({ kind: row.kind, mode: "result", id: row.id })}>{t.tradeInventory.movementViewResult}</Button>
        {row.status === "DRAFT" && canPost && <Button size="sm" variant="outline" disabled={controller.pending !== null}
          onClick={() => onOpen({ kind: row.kind, mode: "post", id: row.id })}>{row.kind === "receipt" ? t.tradeInventory.postReceipt : t.tradeInventory.postDelivery}</Button>}
        {canRelease && <Button size="sm" variant="outline" disabled={controller.pending !== null || row.stale} title={row.stale ? t.tradeInventory.movementStaleHandle : undefined} onClick={() => onOpen({ kind: row.kind, mode: "release", id: row.id })}>{t.tradeInventory.submitRelease}</Button>}
        {canReverse && <Button size="sm" variant="outline" disabled={controller.pending !== null} onClick={() => onOpen({ kind: row.kind, mode: "reverse", id: row.id })}>{row.kind === "receipt" ? t.tradeInventory.reverseReceipt : t.tradeInventory.reverseDelivery}</Button>}
      </div>;
    } },
  ];
  return <section className="flex flex-col gap-3">
    <div><h2 className="text-lg font-semibold">{t.tradeInventory.movementSessionLedger}</h2><p className="text-sm text-muted-foreground">{t.tradeInventory.movementSessionLedgerHint}</p></div>
    <DataTable columns={columns} rows={controller.sessionLedger} rowKey={row => row.id} isLoading={false} showRowNumbers={false}
      labels={{ retry: t.common.retry, errorTitle: t.tradeCommon.actionFailed, emptyTitle: t.tradeInventory.movementSessionEmpty,
        selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending,
        sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
        pagination: { previous: t.common.previousPage, next: t.common.nextPage,
          summary: (from, to, total) => t.common.showingOf.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total)) } }} />
  </section>;
}
