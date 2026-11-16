"use client";
import { Boxes, Lock, PackageCheck, Truck } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, PageHeader, PermissionGate } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { InventoryModuleSubnav } from "../../components/InventoryModuleSubnav";
import { INVENTORY_RESERVE_PERMISSION } from "../../inventory-contract";
import { useInventoryReferences } from "../../hooks/useInventoryReferences";
import { useMovementWorkspace } from "../hooks/useMovementWorkspace";
import type { useInventoryMovements } from "../hooks/useInventoryMovements";
import { OpeningBalanceForm } from "./OpeningBalanceForm";
import { ReservationPanel } from "./ReservationPanel";
import { MovementPanel } from "./MovementPanel";
import { MovementActionModal } from "./MovementActionModal";
import { MovementResultModal } from "./MovementResultModal";
import { MovementSessionLedger } from "./MovementSessionLedger";

export function MovementWorkspace({ controller }: { controller: ReturnType<typeof useInventoryMovements> }) {
  const { t } = controller;
  const refs = useInventoryReferences({ headers: controller.headers, scopeKey: controller.scopeKey, enabled: controller.isScopeResolved });
  const workspace = useMovementWorkspace(controller.sessionLedger, controller.clearError, controller.hasUnresolvedWrite);
  const pillars = [
    { kind: "openingBalance" as const, title: t.tradeInventory.openingBalanceTab, description: t.tradeInventory.openingBalanceSummary, icon: Boxes, enabled: controller.canOpeningBalance, action: t.tradeInventory.submitOpeningBalance },
    { kind: "reservation" as const, title: t.tradeInventory.reservationTab, description: t.tradeInventory.reservationSummary, icon: Lock, enabled: controller.canReserve, action: t.tradeInventory.submitReservation },
    { kind: "receipt" as const, title: t.tradeInventory.receiptTab, description: t.tradeInventory.receiptSummary, icon: PackageCheck, enabled: controller.canReceive, action: t.tradeInventory.submitReceipt },
    { kind: "delivery" as const, title: t.tradeInventory.deliveryTab, description: t.tradeInventory.deliverySummary, icon: Truck, enabled: controller.canDeliver, action: t.tradeInventory.submitDelivery },
  ];
  const canUseAny = pillars.some(pillar => pillar.enabled);
  const content = <div className="flex flex-col gap-5">
    <InventoryModuleSubnav active="movements" />
    <PageHeader title={t.tradeInventory.movementsTitle} description={t.tradeInventory.movementsSubtitle}
      secondaryActions={<TenantBranchSelect branchIds={controller.branchIds} branchId={controller.branchId}
        onChange={controller.selectBranch} disabled={controller.pending !== null || workspace.dialog !== null} />} />
    {refs.error && <ErrorState title={t.tradeInventory.movementReferencesFailed} onRetry={refs.refresh} retryLabel={t.common.retry} />}
    {!controller.isScopeResolved ? <EmptyState icon={Truck} title={t.tradeInventory.selectBranchFirst} description={t.tradeInventory.selectBranchFirstDescription} /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pillars.map(pillar => <Card key={pillar.kind} className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary"><pillar.icon className="size-5" aria-hidden="true" /></span>
            <h2 className="text-sm font-semibold">{pillar.title}</h2></div>
          <p className="min-h-10 text-sm text-muted-foreground">{pillar.description}</p>
          <Button variant="outline" size="sm" disabled={!pillar.enabled || controller.pending !== null} onClick={() => workspace.open({ kind: pillar.kind, mode: "create" })}>{pillar.action}</Button>
        </Card>)}
      </div>
      <MovementSessionLedger controller={controller} onOpen={workspace.open} />
      <p className="text-sm text-muted-foreground">{t.tradeInventory.movementDraftHint}</p>
    </>}
    {workspace.dialog?.mode === "create" && workspace.dialog.kind === "openingBalance" && <OpeningBalanceForm refs={refs} onClose={workspace.close}
      isPending={controller.pending !== null} error={controller.formError} onSubmit={controller.submitOpeningBalance}
      retry={controller.hasUnresolvedWrite ? controller.retryUnresolved : undefined} />}
    {workspace.dialog?.mode === "create" && workspace.dialog.kind === "reservation" && <ReservationPanel refs={refs} headers={controller.headers} onClose={workspace.close}
      pending={controller.pending !== null} error={controller.formError} onSubmit={controller.submitReservation} canReadSource={controller.canReadSales}
      retry={controller.hasUnresolvedWrite ? controller.retryUnresolved : undefined} />}
    {workspace.dialog?.mode === "create" && (workspace.dialog.kind === "receipt" || workspace.dialog.kind === "delivery") && <MovementPanel refs={refs} headers={controller.headers}
      onClose={workspace.close} pending={controller.pending !== null} error={controller.formError} isDelivery={workspace.dialog.kind === "delivery"}
      onSubmit={workspace.dialog.kind === "delivery" ? controller.submitDelivery : controller.submitReceipt}
      canReadSource={workspace.dialog.kind === "delivery" ? controller.canReadSales : controller.canReadPurchases} sessionEntries={controller.sessionLedger}
      retry={controller.hasUnresolvedWrite ? controller.retryUnresolved : undefined} />}
    {workspace.target && workspace.dialog?.mode === "result" && <MovementResultModal target={workspace.target} references={refs} onClose={workspace.close} />}
    {workspace.target && workspace.dialog && ["post", "release", "reverse"].includes(workspace.dialog.mode) &&
      <MovementActionModal target={workspace.target} mode={workspace.dialog.mode} controller={controller} references={refs} onClose={workspace.close} />}
  </div>;
  return canUseAny ? content : <PermissionGate require={INVENTORY_RESERVE_PERMISSION}>{content}</PermissionGate>;
}
