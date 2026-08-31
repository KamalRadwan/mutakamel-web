"use client";

import { use } from "react";
import {
  Button,
  DetailHeader,
  DetailSection,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  NotFoundState,
  ReasonDialog,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../../documents/components/TradeBoundaryStates";
import { TradeDocumentSkeleton } from "../../documents/components/TradeDocumentSkeleton";
import { TradeDocumentTotals } from "../../documents/components/TradeDocumentTotals";
import { TradeDraftReferenceDrawer } from "../../documents/components/TradeDraftReferenceDrawer";
import { TradeGate } from "../../documents/components/TradeGate";
import { TradePdfPanel } from "../../documents/components/TradePdfPanel";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import {
  TRADE_REASON_CODE_MAX_LENGTH,
  partyDisplayName,
  readTotalsSnapshot,
} from "../../documents/trade-document-contract";
import { PurchaseOrderLadder } from "../components/PurchaseOrderLadder";
import { useTradeDraftReference } from "../../documents/hooks/useTradeDraftReference";
import { usePurchaseOrderScreen } from "../hooks/usePurchaseOrderScreen";
import {
  PURCHASE_ORDERS_PATH,
  PURCHASE_ORDER_PERMISSIONS,
  purchaseOrderTotals,
} from "../purchase-order-contract";

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const screen = usePurchaseOrderScreen(id);
  const { detail, write, pdf, allowed } = screen;
  const order = detail.document;
  const editReference = useTradeDraftReference(
    PURCHASE_ORDERS_PATH,
    id,
    order?.version ?? null,
    order?.draftReference ?? null,
    t.tradeDocuments.purchaseOrders.editTitle,
    detail.scope.headers,
    async () => {
      await detail.reload();
    },
  );

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={PURCHASE_ORDER_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={PURCHASE_ORDER_PERMISSIONS.read}>
        <NotFoundState
          title={t.tradeDocuments.purchaseOrders.notFoundTitle}
          description={t.tradeDocuments.purchaseOrders.notFoundDescription}
          backLabel={t.tradeDocuments.purchaseOrders.back}
          backHref={TENANT_ROUTES.tradePurchaseOrders}
        />
      </TradeGate>
    );
  }

  // One filled action, computed from the ladder position. Submit advances a
  // fresh draft, Approve advances a pending one for the checker, and Confirm
  // advances an approved one — never two at once.
  const advance = allowed.submit
    ? { label: t.tradeDocuments.purchaseOrders.submit, action: "submit" as const }
    : allowed.approve
      ? { label: t.tradeDocuments.purchaseOrders.approve, action: "approve" as const }
      : allowed.confirm
        ? { label: t.tradeDocuments.purchaseOrders.confirm, action: "confirm" as const }
        : null;

  return (
    <TradeGate require={PURCHASE_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !order ? (
          detail.loadError ? (
            <ErrorState
              title={t.tradeDocuments.purchaseOrders.loadFailed}
              description={detail.loadError.code ?? undefined}
              onRetry={() => void detail.reload()}
              retryLabel={t.common.retry}
            />
          ) : (
            <TradeDocumentSkeleton />
          )
        ) : (
          <>
            <DetailHeader
              title={order.documentNumber ?? order.draftReference ?? order.id}
              subtitle={partyDisplayName(order.partySnapshot) ?? undefined}
              status={
                <TradeStatusBadge kind="TradeApprovalStatus" value={order.approvalStatus} />
              }
              backLabel={t.tradeDocuments.purchaseOrders.back}
              backHref={TENANT_ROUTES.tradePurchaseOrders}
              primaryAction={
                advance
                  ? {
                      label: advance.label,
                      onClick: () => screen.requestAction(advance.action),
                      disabled: write.isWriting,
                    }
                  : undefined
              }
              secondaryActions={
                <>
                  {detail.scope.canWrite(PURCHASE_ORDER_PERMISSIONS.update) &&
                  order.lifecycleStatus === "DRAFT" ? (
                    <Button variant="outline" onClick={editReference.open}>
                      {t.tradeDocuments.purchaseOrders.editTitle}
                    </Button>
                  ) : null}
                  {allowed.withdraw || allowed.reject || allowed.cancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost">{t.common.actions}</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {allowed.withdraw ? (
                          <DropdownMenuItem onSelect={() => screen.requestAction("withdraw")}>
                            {t.tradeDocuments.purchaseOrders.withdraw}
                          </DropdownMenuItem>
                        ) : null}
                        {allowed.reject ? (
                          <DropdownMenuItem onSelect={() => screen.requestAction("reject")}>
                            {t.tradeDocuments.purchaseOrders.reject}
                          </DropdownMenuItem>
                        ) : null}
                        {allowed.cancel ? (
                          <DropdownMenuItem onSelect={() => screen.requestAction("cancel")}>
                            {t.tradeDocuments.purchaseOrders.cancel}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              }
            />

            <TradeWriteOutcome write={write} />
            <TradeWriteOutcome write={pdf.write} />
            <TradeWriteOutcome write={editReference.write} />

            <PurchaseOrderLadder order={order} />

            <DetailSection
              title={t.tradeDocuments.identity}
              // The maker–checker rule decides which half of the ladder this
              // person sees, so it is stated rather than left to be discovered
              // through a 409.
              description={
                order.approvalStatus === "PENDING"
                  ? screen.isMaker
                    ? t.tradeDocuments.purchaseOrders.checkerOnly
                    : t.tradeDocuments.purchaseOrders.makerOnly
                  : undefined
              }
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                { label: t.tradeDocuments.documentNumber, value: order.documentNumber },
                { label: t.tradeDocuments.draftReference, value: order.draftReference },
                { label: t.tradeDocuments.currency, value: order.currencyCode },
                { label: t.tradeDocuments.businessDate, value: order.businessDate },
                {
                  label: t.tradeDocuments.purchaseOrders.supplierAccount,
                  value: order.supplierAccountId,
                },
                {
                  label: t.tradeDocuments.purchaseOrders.receivingNode,
                  value: order.receivingNodeId,
                },
                {
                  label: t.tradeDocuments.purchaseOrders.dispatchAxis,
                  value: order.dispatchStatus,
                },
                {
                  label: t.tradeDocuments.purchaseOrders.lifecycleAxis,
                  value: (
                    <TradeStatusBadge
                      kind="TradePurchaseOrderStatus"
                      value={order.lifecycleStatus}
                    />
                  ),
                },
              ]}
            />

            <TradeDocumentTotals
              totals={readTotalsSnapshot(purchaseOrderTotals(order))}
              currencyCode={order.currencyCode}
              title={t.tradeDocuments.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={order.totalsSnapshot !== null}
              onRender={screen.renderPdf}
              unavailableReason={t.tradeDocuments.purchaseOrders.createBlockedDescription}
            />

            <TradeDraftReferenceDrawer
              state={editReference}
              title={t.tradeDocuments.purchaseOrders.editTitle}
              description={t.tradeDocuments.purchaseOrders.editDescription}
            />

            <ReasonDialog
              open={screen.openReason !== null}
              onOpenChange={(open) => (open ? undefined : screen.closeReason())}
              title={
                screen.openReason === "reject"
                  ? t.tradeDocuments.purchaseOrders.rejectTitle
                  : t.tradeDocuments.purchaseOrders.cancelTitle
              }
              reasonRequired
              destructive
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={write.isWriting}
              onConfirm={(reason) =>
                void screen.run(screen.openReason ?? "cancel", reason.trim())
              }
              labels={{
                reason: t.tradeDocuments.reasonCode,
                reasonHint: t.tradeDocuments.reasonCodeHint,
                confirm:
                  screen.openReason === "reject"
                    ? t.tradeDocuments.purchaseOrders.reject
                    : t.tradeDocuments.purchaseOrders.cancel,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
