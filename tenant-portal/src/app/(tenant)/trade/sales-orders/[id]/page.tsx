"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Building2, CreditCard } from "lucide-react";
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

export default function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const screen = useSalesOrderScreen(id);
  const { detail, confirmation, write, pdf } = screen;
  const order = detail.document;
  const [attemptCancelOpen, setAttemptCancelOpen] = useState(false);
  const editReference = useTradeDraftReference(
    SALES_ORDERS_PATH,
    id,
    order?.version ?? null,
    order?.draftReference ?? null,
    td.salesOrders.editTitle,
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
          title={td.salesOrders.notFoundTitle}
          description={td.salesOrders.notFoundDescription}
          backLabel={td.salesOrders.back}
          backHref={TENANT_ROUTES.tradeSalesOrders}
        />
      </TradeGate>
    );
  }

  const stageSteps = [
    {
      status: "DRAFT",
      label: t.statusValues["TradeSalesOrderStatus.DRAFT"] ?? "DRAFT",
    },
    {
      status: "CONFIRMED",
      label: t.statusValues["TradeSalesOrderStatus.CONFIRMED"] ?? "CONFIRMED",
    },
    {
      status: "CANCELLED",
      label: t.statusValues["TradeSalesOrderStatus.CANCELLED"] ?? "CANCELLED",
    },
  ];

  return (
    <TradeGate require={SALES_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !order ? (
          detail.loadError ? (
            <ErrorState
              title={td.salesOrders.loadFailed}
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
              backLabel={td.salesOrders.back}
              backHref={TENANT_ROUTES.tradeSalesOrders}
              secondaryActions={
                <>
                  {detail.scope.canWrite(SALES_ORDER_PERMISSIONS.update) &&
                  order.lifecycleStatus === "DRAFT" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={editReference.open}
                    >
                      {td.salesOrders.editTitle}
                    </Button>
                  ) : null}
                  {screen.canHold || screen.canRelease || screen.canCancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {t.common.actions}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {screen.canHold && !screen.isHoldBlocked ? (
                          <DropdownMenuItem
                            onSelect={() => screen.requestReason("hold")}
                          >
                            {td.salesOrders.hold}
                          </DropdownMenuItem>
                        ) : null}
                        {screen.canRelease ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              screen.requestReason("release-hold")
                            }
                          >
                            {td.salesOrders.releaseHold}
                          </DropdownMenuItem>
                        ) : null}
                        {screen.canCancel ? (
                          <DropdownMenuItem
                            onSelect={() => screen.requestReason("cancel")}
                          >
                            {td.salesOrders.cancel}
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
            <TradeWriteOutcome write={confirmation.write} />
            <TradeWriteOutcome write={pdf.write} />
            <TradeWriteOutcome write={editReference.write} />

            {screen.isHoldBlocked ? (
              <DegradedBanner message={td.salesOrders.holdBlocked} />
            ) : null}

            <SalesOrderAxes order={order} />

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
                      <span className="dossier-lbl">{td.draftReference}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {order.draftReference ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.customer}</span>
                      <span className="dossier-val">
                        {partyDisplayName(order.partySnapshot) ?? td.notRecorded}
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.businessDate}</span>
                      <span className="dossier-val">
                        <IdentifierText>{order.businessDate}</IdentifierText>
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
                        {td.salesOrders.holdAxis}
                      </span>
                      <span className="dossier-val">
                        <IdentifierText>{order.holdStatus}</IdentifierText>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DetailSection
              title={td.identity}
              emptyValueLabel={td.notRecorded}
              fields={[
                { label: td.documentNumber, value: order.documentNumber },
                { label: td.draftReference, value: order.draftReference },
                { label: td.currency, value: order.currencyCode },
                { label: td.businessDate, value: order.businessDate },
                { label: td.version, value: String(order.version) },
              ]}
            />

            <DetailSection
              title={td.lineageTitle}
              description={order.sourceQuotationId ? undefined : td.lineageEmpty}
              emptyValueLabel={td.notRecorded}
              fields={[
                {
                  label: td.sourceQuotation,
                  value: order.sourceQuotationId ? (
                    <Link
                      href={`${TENANT_ROUTES.tradeQuotations}/${order.sourceQuotationId}`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {td.openSource}
                    </Link>
                  ) : null,
                },
                {
                  label: td.sourceRevision,
                  value: order.sourceQuotationRevisionId,
                },
              ]}
            />

            <TradeOrderLinesPanel
              lines={order.lines}
              currencyCode={order.currencyCode}
              secondaryDescriptionLabel={td.deliveryDescription}
              secondaryDescription={(line) => line.deliveryDescriptionSnapshot}
              emptyTitle={td.orderLinesEmpty}
              errorTitle={td.salesOrders.loadFailed}
            />

            <TradeDocumentTotals
              totals={readTotalsSnapshot(salesOrderTotals(order))}
              currencyCode={order.currencyCode}
              title={td.totals.grandTotal}
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
              unavailableReason={td.salesOrders.createBlockedDescription}
            />

            <TradeDraftReferenceDrawer
              state={editReference}
              title={td.salesOrders.editTitle}
              description={td.salesOrders.editDescription}
            />

            <ReasonDialog
              open={screen.openReason !== null}
              onOpenChange={(open) => (open ? undefined : screen.closeReason())}
              title={
                screen.openReason === "hold"
                  ? td.salesOrders.holdTitle
                  : screen.openReason === "release-hold"
                    ? td.salesOrders.releaseHoldTitle
                    : td.salesOrders.cancelTitle
              }
              reasonRequired
              destructive={screen.openReason === "cancel"}
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={write.isWriting}
              onConfirm={(reason) => void screen.runReason(reason.trim())}
              labels={{
                reason: td.reasonCode,
                reasonHint: td.reasonCodeHint,
                confirm: t.common.save,
                cancel: t.common.cancel,
              }}
            />

            <ReasonDialog
              open={attemptCancelOpen}
              onOpenChange={setAttemptCancelOpen}
              title={td.salesOrders.attemptCancelTitle}
              reasonRequired
              destructive
              maxLength={TRADE_REASON_CODE_MAX_LENGTH}
              loading={confirmation.write.isWriting}
              onConfirm={(reason) => {
                setAttemptCancelOpen(false);
                void confirmation.cancelAttempt(reason.trim());
              }}
              labels={{
                reason: td.reasonCode,
                reasonHint: td.reasonCodeHint,
                confirm: td.salesOrders.attemptCancel,
                cancel: t.common.cancel,
              }}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
