"use client";

import { use } from "react";
import { Building2, CreditCard, ShieldCheck } from "lucide-react";
import {
  Button,
  DetailHeader,
  DetailSection,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  IdentifierText,
  Money,
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
import { TradeOrderLinesPanel } from "../../documents/components/TradeOrderLinesPanel";
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

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const screen = usePurchaseOrderScreen(id);
  const { detail, write, pdf, allowed } = screen;
  const order = detail.document;
  const editReference = useTradeDraftReference(
    PURCHASE_ORDERS_PATH,
    id,
    order?.version ?? null,
    order?.draftReference ?? null,
    td.purchaseOrders.editTitle,
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
          title={td.purchaseOrders.notFoundTitle}
          description={td.purchaseOrders.notFoundDescription}
          backLabel={td.purchaseOrders.back}
          backHref={TENANT_ROUTES.tradePurchaseOrders}
        />
      </TradeGate>
    );
  }

  const advance = allowed.submit
    ? { label: td.purchaseOrders.submit, action: "submit" as const }
    : allowed.approve
      ? { label: td.purchaseOrders.approve, action: "approve" as const }
      : allowed.confirm
        ? { label: td.purchaseOrders.confirm, action: "confirm" as const }
        : null;

  const stageSteps = [
    {
      status: "DRAFT",
      label: t.statusValues["TradePurchaseOrderStatus.DRAFT"] ?? "DRAFT",
    },
    {
      status: "CONFIRMED",
      label:
        t.statusValues["TradePurchaseOrderStatus.CONFIRMED"] ?? "CONFIRMED",
    },
    {
      status: "CANCELLED",
      label:
        t.statusValues["TradePurchaseOrderStatus.CANCELLED"] ?? "CANCELLED",
    },
  ];

  return (
    <TradeGate require={PURCHASE_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !order ? (
          detail.loadError ? (
            <ErrorState
              title={td.purchaseOrders.loadFailed}
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
                <TradeStatusBadge
                  kind="TradeApprovalStatus"
                  value={order.approvalStatus}
                />
              }
              backLabel={td.purchaseOrders.back}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={editReference.open}
                    >
                      {td.purchaseOrders.editTitle}
                    </Button>
                  ) : null}
                  {allowed.withdraw || allowed.reject || allowed.cancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {t.common.actions}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {allowed.withdraw ? (
                          <DropdownMenuItem
                            onSelect={() => screen.requestAction("withdraw")}
                          >
                            {td.purchaseOrders.withdraw}
                          </DropdownMenuItem>
                        ) : null}
                        {allowed.reject ? (
                          <DropdownMenuItem
                            onSelect={() => screen.requestAction("reject")}
                          >
                            {td.purchaseOrders.reject}
                          </DropdownMenuItem>
                        ) : null}
                        {allowed.cancel ? (
                          <DropdownMenuItem
                            onSelect={() => screen.requestAction("cancel")}
                          >
                            {td.purchaseOrders.cancel}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </>
              }
            />

            <div className="dossier-stage-bar">
              <span className="dossier-stage-label">
                {td.executive.lifecycleTrack}
              </span>
              <div className="dossier-stage-track">
                {stageSteps.map((step, idx) => {
                  const activeIdx = stageSteps.findIndex(
                    (s) => s.status === order.lifecycleStatus,
                  );
                  const stateClass =
                    step.status === order.lifecycleStatus
                      ? "active"
                      : activeIdx > idx
                        ? "done"
                        : "";
                  return (
                    <div
                      key={step.status}
                      className={`dossier-stage-cell ${stateClass}`}
                    >
                      <span className="dossier-stage-dot" aria-hidden />
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <TradeWriteOutcome write={write} />
            <TradeWriteOutcome write={pdf.write} />
            <TradeWriteOutcome write={editReference.write} />

            <PurchaseOrderLadder order={order} />

            <div className="dossier-grid">
              <div className="dossier-col">
                <div className="dossier-card dossier-card-indigo">
                  <div className="dossier-card-header">
                    <div className="dossier-card-title">
                      <span
                        className="dossier-icon-pill dossier-ip-indigo"
                        aria-hidden
                      >
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span>{td.executive.dossierOverview}</span>
                    </div>
                    <span className="dossier-tag dossier-tag-indigo">
                      <IdentifierText>{`v${order.version}`}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.documentNumber}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {order.documentNumber ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.supplier}</span>
                      <span className="dossier-val">
                        {partyDisplayName(order.partySnapshot) ?? td.notRecorded}
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.purchaseOrders.supplierAccount}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {order.supplierAccountId ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.purchaseOrders.receivingNode}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {order.receivingNodeId ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dossier-col">
                <div className="dossier-card dossier-card-emerald">
                  <div className="dossier-card-header">
                    <div className="dossier-card-title">
                      <span
                        className="dossier-icon-pill dossier-ip-emerald"
                        aria-hidden
                      >
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <span>{td.executive.financialSummary}</span>
                    </div>
                    <span className="dossier-tag dossier-tag-emerald">
                      <IdentifierText>{order.currencyCode}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box dossier-span-all">
                      <span className="dossier-lbl">{td.grandTotal}</span>
                      <span className="dossier-val text-base">
                        <Money
                          value={order.grandTotal}
                          currency={order.currencyCode}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.executive.linesCount}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {String(order.lines.length)}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">
                        {td.purchaseOrders.dispatchAxis}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>{order.dispatchStatus}</IdentifierText>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="dossier-card dossier-card-violet">
                  <div className="dossier-card-header">
                    <div className="dossier-card-title">
                      <span
                        className="dossier-icon-pill dossier-ip-violet"
                        aria-hidden
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>{td.executive.makerCheckerTitle}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.approvalStatus === "PENDING"
                      ? screen.isMaker
                        ? td.purchaseOrders.checkerOnly
                        : td.purchaseOrders.makerOnly
                      : td.executive.makerCheckerDescription}
                  </p>
                </div>
              </div>
            </div>

            <DetailSection
              title={td.identity}
              description={
                order.approvalStatus === "PENDING"
                  ? screen.isMaker
                    ? td.purchaseOrders.checkerOnly
                    : td.purchaseOrders.makerOnly
                  : undefined
              }
              emptyValueLabel={td.notRecorded}
              fields={[
                { label: td.documentNumber, value: order.documentNumber },
                { label: td.draftReference, value: order.draftReference },
                { label: td.currency, value: order.currencyCode },
                { label: td.businessDate, value: order.businessDate },
                {
                  label: td.purchaseOrders.supplierAccount,
                  value: order.supplierAccountId,
                },
                {
                  label: td.purchaseOrders.receivingNode,
                  value: order.receivingNodeId,
                },
                {
                  label: td.purchaseOrders.dispatchAxis,
                  value: order.dispatchStatus,
                },
                {
                  label: td.purchaseOrders.lifecycleAxis,
                  value: (
                    <TradeStatusBadge
                      kind="TradePurchaseOrderStatus"
                      value={order.lifecycleStatus}
                    />
                  ),
                },
              ]}
            />

            <TradeOrderLinesPanel
              lines={order.lines}
              currencyCode={order.currencyCode}
              secondaryDescriptionLabel={td.receiptDescription}
              secondaryDescription={(line) => line.receiptDescriptionSnapshot}
              emptyTitle={td.orderLinesEmpty}
              errorTitle={td.purchaseOrders.loadFailed}
            />

            <TradeDocumentTotals
              totals={readTotalsSnapshot(purchaseOrderTotals(order))}
              currencyCode={order.currencyCode}
              title={td.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={order.totalsSnapshot !== null}
              onRender={screen.renderPdf}
              unavailableReason={td.purchaseOrders.createBlockedDescription}
            />

            <TradeDraftReferenceDrawer
              state={editReference}
              title={td.purchaseOrders.editTitle}
              description={td.purchaseOrders.editDescription}
            />

            <ReasonDialog
              open={screen.openReason !== null}
              onOpenChange={(open) => (open ? undefined : screen.closeReason())}
              title={
                screen.openReason === "reject"
                  ? td.purchaseOrders.rejectTitle
                  : td.purchaseOrders.cancelTitle
              }
              reasonRequired
              destructive
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={write.isWriting}
              onConfirm={(reason) =>
                void screen.run(screen.openReason ?? "cancel", reason.trim())
              }
              labels={{
                reason: td.reasonCode,
                reasonHint: td.reasonCodeHint,
                confirm:
                  screen.openReason === "reject"
                    ? td.purchaseOrders.reject
                    : td.purchaseOrders.cancel,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
