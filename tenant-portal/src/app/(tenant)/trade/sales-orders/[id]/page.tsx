"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Button,
  DegradedBanner,
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
import {
  TRADE_REASON_CODE_MAX_LENGTH,
  partyDisplayName,
  readTotalsSnapshot,
} from "../../documents/trade-document-contract";
import { SalesOrderAxes } from "../components/SalesOrderAxes";
import { SalesOrderConfirmationPanel } from "../components/SalesOrderConfirmationPanel";
import { useTradeDraftReference } from "../../documents/hooks/useTradeDraftReference";
import { useSalesOrderScreen } from "../hooks/useSalesOrderScreen";
import {
  SALES_ORDERS_PATH,
  SALES_ORDER_PERMISSIONS,
  salesOrderTotals,
} from "../sales-order-contract";

export default function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const screen = useSalesOrderScreen(id);
  const { detail, confirmation, write, pdf } = screen;
  const order = detail.document;
  const [attemptCancelOpen, setAttemptCancelOpen] = useState(false);
  const editReference = useTradeDraftReference(
    SALES_ORDERS_PATH,
    id,
    order?.version ?? null,
    order?.draftReference ?? null,
    t.tradeDocuments.salesOrders.editTitle,
    detail.scope.headers,
    async () => {
      await detail.reload();
    },
  );

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={SALES_ORDER_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={SALES_ORDER_PERMISSIONS.read}>
        <NotFoundState
          title={t.tradeDocuments.salesOrders.notFoundTitle}
          description={t.tradeDocuments.salesOrders.notFoundDescription}
          backLabel={t.tradeDocuments.salesOrders.back}
          backHref={TENANT_ROUTES.tradeSalesOrders}
        />
      </TradeGate>
    );
  }

  return (
    <TradeGate require={SALES_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !order ? (
          detail.loadError ? (
            <ErrorState
              title={t.tradeDocuments.salesOrders.loadFailed}
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
              backLabel={t.tradeDocuments.salesOrders.back}
              backHref={TENANT_ROUTES.tradeSalesOrders}
              // The advance action for a draft order is confirmation, and it
              // lives in its own panel because it collects a deadline and then
              // polls. Promoting it to the header would give the filled slot to
              // a control whose result appears somewhere else on the page.
              secondaryActions={
                <>
                  {detail.scope.canWrite(SALES_ORDER_PERMISSIONS.update) &&
                  order.lifecycleStatus === "DRAFT" ? (
                    <Button variant="outline" onClick={editReference.open}>
                      {t.tradeDocuments.salesOrders.editTitle}
                    </Button>
                  ) : null}
                  {screen.canHold || screen.canRelease || screen.canCancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost">{t.common.actions}</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {screen.canHold && !screen.isHoldBlocked ? (
                          <DropdownMenuItem onSelect={() => screen.requestReason("hold")}>
                            {t.tradeDocuments.salesOrders.hold}
                          </DropdownMenuItem>
                        ) : null}
                        {screen.canRelease ? (
                          <DropdownMenuItem onSelect={() => screen.requestReason("release-hold")}>
                            {t.tradeDocuments.salesOrders.releaseHold}
                          </DropdownMenuItem>
                        ) : null}
                        {screen.canCancel ? (
                          <DropdownMenuItem onSelect={() => screen.requestReason("cancel")}>
                            {t.tradeDocuments.salesOrders.cancel}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              }
            />

            <TradeWriteOutcome write={write} />
            <TradeWriteOutcome write={confirmation.write} />
            <TradeWriteOutcome write={pdf.write} />
            <TradeWriteOutcome write={editReference.write} />

            {screen.isHoldBlocked ? (
              <DegradedBanner message={t.tradeDocuments.salesOrders.holdBlocked} />
            ) : null}

            <SalesOrderAxes order={order} />

            <DetailSection
              title={t.tradeDocuments.identity}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                { label: t.tradeDocuments.documentNumber, value: order.documentNumber },
                { label: t.tradeDocuments.draftReference, value: order.draftReference },
                { label: t.tradeDocuments.currency, value: order.currencyCode },
                { label: t.tradeDocuments.businessDate, value: order.businessDate },
                { label: t.tradeDocuments.version, value: String(order.version) },
              ]}
            />

            {/* MASTER-PLAN 11.19. This is the only lineage edge Trade stores in
                a readable place: `sourceQuotationId` on the order. The
                `trade_document_lineage` table is written on conversion and read
                by nothing, and an invoice's `sourceSalesOrderId` is hard-coded
                to null at creation — so there is no order-to-invoice link to
                show, in either direction. Recorded as Q81. */}
            <DetailSection
              title={t.tradeDocuments.lineageTitle}
              description={order.sourceQuotationId ? undefined : t.tradeDocuments.lineageEmpty}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                {
                  label: t.tradeDocuments.sourceQuotation,
                  value: order.sourceQuotationId ? (
                    <Link
                      href={`${TENANT_ROUTES.tradeQuotations}/${order.sourceQuotationId}`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {t.tradeDocuments.openSource}
                    </Link>
                  ) : null,
                },
                {
                  label: t.tradeDocuments.sourceRevision,
                  value: order.sourceQuotationRevisionId,
                },
              ]}
            />

            <TradeDocumentTotals
              totals={readTotalsSnapshot(salesOrderTotals(order))}
              currencyCode={order.currencyCode}
              title={t.tradeDocuments.totals.grandTotal}
            />

            <SalesOrderConfirmationPanel
              state={confirmation}
              canConfirm={screen.canConfirm}
              onCancelAttempt={() => setAttemptCancelOpen(true)}
            />

            <TradePdfPanel
              state={pdf}
              canRender={order.totalsSnapshot !== null}
              onRender={screen.renderPdf}
              unavailableReason={t.tradeDocuments.salesOrders.createBlockedDescription}
            />

            <TradeDraftReferenceDrawer
              state={editReference}
              title={t.tradeDocuments.salesOrders.editTitle}
              description={t.tradeDocuments.salesOrders.editDescription}
            />

            <ReasonDialog
              open={screen.openReason !== null}
              onOpenChange={(open) => (open ? undefined : screen.closeReason())}
              title={
                screen.openReason === "hold"
                  ? t.tradeDocuments.salesOrders.holdTitle
                  : screen.openReason === "release-hold"
                    ? t.tradeDocuments.salesOrders.releaseHoldTitle
                    : t.tradeDocuments.salesOrders.cancelTitle
              }
              reasonRequired
              destructive={screen.openReason === "cancel"}
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={write.isWriting}
              onConfirm={(reason) => void screen.runReason(reason.trim())}
              labels={{
                reason: t.tradeDocuments.reasonCode,
                reasonHint: t.tradeDocuments.reasonCodeHint,
                confirm: t.common.save,
                cancel: t.common.cancel,
              }}
            />

            <ReasonDialog
              open={attemptCancelOpen}
              onOpenChange={setAttemptCancelOpen}
              title={t.tradeDocuments.salesOrders.attemptCancelTitle}
              reasonRequired
              destructive
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={confirmation.write.isWriting}
              onConfirm={(reason) => {
                setAttemptCancelOpen(false);
                void confirmation.cancelAttempt(reason.trim());
              }}
              labels={{
                reason: t.tradeDocuments.reasonCode,
                reasonHint: t.tradeDocuments.reasonCodeHint,
                confirm: t.tradeDocuments.salesOrders.attemptCancel,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
