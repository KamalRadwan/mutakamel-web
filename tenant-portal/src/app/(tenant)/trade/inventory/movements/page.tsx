"use client";

import { Truck } from "lucide-react";
import {
  DegradedBanner,
  EmptyState,
  PageHeader,
  PermissionGate,
  SubNav,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { TRADE_INVENTORY_NAV_ITEMS } from "../inventory-nav";
import { INVENTORY_RESERVE_PERMISSION } from "../inventory-contract";
import { MovementPanel } from "./components/MovementPanel";
import { OpeningBalanceForm } from "./components/OpeningBalanceForm";
import { ReservationPanel } from "./components/ReservationPanel";
import { useInventoryMovements } from "./hooks/useInventoryMovements";

export default function InventoryMovementsPage() {
  const {
    t,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    created,
    pending,
    formError,
    canOpeningBalance,
    canReserve,
    canReceive,
    canDeliver,
    canAdjust,
    submitOpeningBalance,
    submitReservation,
    releaseReservation,
    submitReceipt,
    postReceipt,
    reverseReceipt,
    submitDelivery,
    postDelivery,
    reverseDelivery,
  } = useInventoryMovements();

  const canUseAny = canOpeningBalance || canReserve || canReceive || canDeliver;

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.movementsTitle}
        description={t.tradeInventory.movementsSubtitle}
        secondaryActions={
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={selectBranch}
            disabled={pending !== null}
          />
        }
      />

      <SubNav items={TRADE_INVENTORY_NAV_ITEMS} />

      {/* Not a warning about this screen's health — a statement about the API:
          receipts, deliveries, reservations and opening balances expose no GET
          at all, so nothing here can be listed or reopened later (Q37). */}
      <DegradedBanner message={t.tradeInventory.movementsNoReadRoute} />

      {!isScopeResolved ? (
        <EmptyState
          icon={Truck}
          title={t.tradeInventory.selectBranchFirst}
          description={t.tradeInventory.selectBranchFirstDescription}
        />
      ) : (
        <Tabs defaultValue="openingBalance">
          <TabsList>
            <TabsTrigger value="openingBalance">{t.tradeInventory.openingBalanceTab}</TabsTrigger>
            <TabsTrigger value="reservation">{t.tradeInventory.reservationTab}</TabsTrigger>
            <TabsTrigger value="receipt">{t.tradeInventory.receiptTab}</TabsTrigger>
            <TabsTrigger value="delivery">{t.tradeInventory.deliveryTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="openingBalance">
            <OpeningBalanceForm
              onSubmit={submitOpeningBalance}
              isPending={pending === "openingBalance"}
              disabled={!canOpeningBalance || pending !== null}
              error={formError}
            />
          </TabsContent>

          <TabsContent value="reservation">
            <ReservationPanel
              onCreate={submitReservation}
              onRelease={releaseReservation}
              createdId={created.reservation}
              pending={pending}
              disabled={!canReserve || pending !== null}
              error={formError}
            />
          </TabsContent>

          <TabsContent value="receipt">
            <MovementPanel
              sourceDocumentLabel={t.tradeInventory.purchaseOrderId}
              createLabel={t.tradeInventory.submitReceipt}
              postLabel={t.tradeInventory.postReceipt}
              reverseLabel={t.tradeInventory.reverseReceipt}
              createPendingKey="receipt"
              postPendingKey="receiptPost"
              reversePendingKey="receiptReverse"
              createdId={created.receipt}
              onCreate={submitReceipt}
              onPost={postReceipt}
              onReverse={reverseReceipt}
              pending={pending}
              disabled={!canReceive || pending !== null}
              canReverse={canAdjust && pending === null}
              error={formError}
            />
          </TabsContent>

          <TabsContent value="delivery">
            <MovementPanel
              sourceDocumentLabel={t.tradeInventory.salesOrderId}
              createLabel={t.tradeInventory.submitDelivery}
              postLabel={t.tradeInventory.postDelivery}
              reverseLabel={t.tradeInventory.reverseDelivery}
              createPendingKey="delivery"
              postPendingKey="deliveryPost"
              reversePendingKey="deliveryReverse"
              createdId={created.delivery}
              onCreate={submitDelivery}
              onPost={postDelivery}
              onReverse={reverseDelivery}
              pending={pending}
              disabled={!canDeliver || pending !== null}
              canReverse={canAdjust && pending === null}
              error={formError}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );

  // No `trade.inventory.movements` grant exists — these routes carry four
  // separate write permissions and no read one, so admission is "any of them".
  return canUseAny ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_RESERVE_PERMISSION}>{content}</PermissionGate>
  );
}
