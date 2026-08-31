"use client";

import { use, useCallback, useState } from "react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  DetailHeader,
  DetailSection,
  ErrorState,
  Money,
  NotFoundState,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeIfMatch, tradePost } from "../../trade-api";
import {
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../../documents/components/TradeBoundaryStates";
import { TradeDocumentSkeleton } from "../../documents/components/TradeDocumentSkeleton";
import { TradeDocumentTotals } from "../../documents/components/TradeDocumentTotals";
import { TradeGate } from "../../documents/components/TradeGate";
import { TradePdfPanel } from "../../documents/components/TradePdfPanel";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import { useTradeDocumentDetail } from "../../documents/hooks/useTradeDocumentDetail";
import { useTradePdfJob } from "../../documents/hooks/useTradePdfJob";
import { useTradeTableLabels } from "../../documents/hooks/useTradeTableLabels";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  partyDisplayName,
  readTotalsSnapshot,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { PurchaseQuotationDrawer } from "../components/PurchaseQuotationDrawer";
import { usePurchaseQuotationForm } from "../hooks/usePurchaseQuotationForm";
import {
  PURCHASE_QUOTATIONS_PATH,
  PURCHASE_QUOTATION_PERMISSIONS,
  isPurchaseQuotationDraft,
  parsePurchaseQuotationDetail,
  type PurchaseQuotationDetail,
  type PurchaseQuotationLine,
} from "../purchase-quotation-contract";

export default function PurchaseQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const detail = useTradeDocumentDetail<PurchaseQuotationDetail>(
    PURCHASE_QUOTATIONS_PATH,
    id,
    parsePurchaseQuotationDetail,
  );
  const quotation = detail.document;
  const { headers, canWrite } = detail.scope;
  const write = useTradeWrite();
  const pdf = useTradePdfJob(PURCHASE_QUOTATIONS_PATH, id, headers);
  const [issueOpen, setIssueOpen] = useState(false);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const form = usePurchaseQuotationForm(
    headers,
    canWrite(PURCHASE_QUOTATION_PERMISSIONS.accounts),
    quotation,
    reload,
  );

  const lineLabels = useTradeTableLabels(
    t.tradeDocuments.purchaseQuotations.empty,
    t.tradeDocuments.purchaseQuotations.loadFailed,
  );

  const issue = useCallback(async () => {
    if (!quotation) return;
    setIssueOpen(false);
    await write.runWrite({
      operation: t.tradeDocuments.purchaseQuotations.issue,
      send: (idempotency) =>
        // `issue` declares no `@Body()`, so a body would be rejected by
        // `forbidUnknownValues`. `undefined`, never `{}`.
        tradePost(tradeDocumentActionPath(PURCHASE_QUOTATIONS_PATH, quotation.id, "issue"), undefined, {
          headers: { ...headers, ...idempotency, "if-match": tradeIfMatch(quotation.version) },
          maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        }),
    });
    await reload();
  }, [quotation, write, t, headers, reload]);

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={PURCHASE_QUOTATION_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={PURCHASE_QUOTATION_PERMISSIONS.read}>
        <NotFoundState
          title={t.tradeDocuments.purchaseQuotations.notFoundTitle}
          description={t.tradeDocuments.purchaseQuotations.notFoundDescription}
          backLabel={t.tradeDocuments.purchaseQuotations.back}
          backHref={TENANT_ROUTES.tradePurchaseQuotations}
        />
      </TradeGate>
    );
  }

  const isDraft = quotation !== null && isPurchaseQuotationDraft(quotation);
  const columns: ColumnDef<PurchaseQuotationLine>[] = [
    {
      id: "item",
      header: t.tradeDocuments.item,
      cell: (line) => line.descriptionSnapshot ?? line.clientLineId,
    },
    {
      id: "quantity",
      header: t.tradeDocuments.quantity,
      numeric: true,
      cell: (line) => (
        <Money value={line.quantity} minimumFractionDigits={0} maximumFractionDigits={8} />
      ),
    },
    {
      id: "unitPrice",
      header: t.tradeDocuments.unitPrice,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.unitPrice}
          currency={quotation?.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "lineTotal",
      header: t.tradeDocuments.lineTotal,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.lineTotal}
          currency={quotation?.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
  ];

  return (
    <TradeGate require={PURCHASE_QUOTATION_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !quotation ? (
          detail.loadError ? (
            <ErrorState
              title={t.tradeDocuments.purchaseQuotations.loadFailed}
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
              title={quotation.documentNumber}
              subtitle={partyDisplayName(quotation.partySnapshot) ?? quotation.partyId}
              status={
                <TradeStatusBadge
                  kind="TradePurchaseQuotationStatus"
                  value={quotation.lifecycleStatus}
                />
              }
              backLabel={t.tradeDocuments.purchaseQuotations.back}
              backHref={TENANT_ROUTES.tradePurchaseQuotations}
              primaryAction={
                isDraft && canWrite(PURCHASE_QUOTATION_PERMISSIONS.issue)
                  ? {
                      label: t.tradeDocuments.purchaseQuotations.issue,
                      onClick: () => setIssueOpen(true),
                      disabled: write.isWriting,
                    }
                  : undefined
              }
              secondaryActions={
                isDraft && canWrite(PURCHASE_QUOTATION_PERMISSIONS.update) ? (
                  <Button variant="outline" onClick={form.open}>
                    {t.tradeDocuments.purchaseQuotations.editTitle}
                  </Button>
                ) : null
              }
            />

            <TradeWriteOutcome write={write} />
            <TradeWriteOutcome write={form.write} />
            <TradeWriteOutcome write={pdf.write} />

            {isDraft ? null : (
              <p className="text-xs text-muted-foreground">
                {t.tradeDocuments.purchaseQuotations.issuedNote}
              </p>
            )}

            <DetailSection
              title={t.tradeDocuments.identity}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                { label: t.tradeDocuments.documentNumber, value: quotation.documentNumber },
                { label: t.tradeDocuments.reference, value: quotation.reference },
                { label: t.tradeDocuments.currency, value: quotation.currencyCode },
                { label: t.tradeDocuments.validUntil, value: quotation.validUntil },
                { label: t.tradeDocuments.businessDate, value: quotation.businessDate },
                { label: t.tradeDocuments.notes, value: quotation.notes, wide: true },
              ]}
            />

            <DetailSection
              title={t.tradeDocuments.lines}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              columns={1}
            >
              <DataTable
                columns={columns}
                rows={quotation.lines}
                rowKey={(line) => line.id}
                isLoading={false}
                labels={lineLabels}
              />
            </DetailSection>

            <TradeDocumentTotals
              totals={readTotalsSnapshot(quotation.totalsSnapshot)}
              currencyCode={quotation.currencyCode}
              title={t.tradeDocuments.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={!isDraft}
              onRender={() =>
                void pdf.render(
                  { sourceVersion: quotation.version, purpose: "SUPPLIER_QUOTATION" },
                  t.tradeDocuments.pdf.operation,
                )
              }
              unavailableReason={t.tradeDocuments.purchaseQuotations.issueDescription}
            />

            <PurchaseQuotationDrawer state={form} isEdit />

            <ConfirmActionModal
              open={issueOpen}
              onOpenChange={setIssueOpen}
              title={t.tradeDocuments.purchaseQuotations.issueTitle}
              description={t.tradeDocuments.purchaseQuotations.issueDescription}
              confirmLabel={t.tradeDocuments.purchaseQuotations.issue}
              cancelLabel={t.common.cancel}
              loading={write.isWriting}
              onConfirm={() => void issue()}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
