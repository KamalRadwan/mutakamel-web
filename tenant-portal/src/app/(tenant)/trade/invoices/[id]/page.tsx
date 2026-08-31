"use client";

import { use, useCallback } from "react";
import {
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
import {
  TradeEvidenceBlocked,
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../../documents/components/TradeBoundaryStates";
import { TradeDocumentSkeleton } from "../../documents/components/TradeDocumentSkeleton";
import { TradeDocumentTotals } from "../../documents/components/TradeDocumentTotals";
import { TradeGate } from "../../documents/components/TradeGate";
import { TradePdfPanel } from "../../documents/components/TradePdfPanel";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import { useTradeDocumentDetail } from "../../documents/hooks/useTradeDocumentDetail";
import { useTradeFinalizeAction } from "../../documents/hooks/useTradeFinalizeAction";
import { useTradePdfJob } from "../../documents/hooks/useTradePdfJob";
import { useTradeTableLabels } from "../../documents/hooks/useTradeTableLabels";
import { partyDisplayName, readTotalsSnapshot } from "../../documents/trade-document-contract";
import {
  INVOICES_PATH,
  INVOICE_PERMISSIONS,
  parseInvoiceDetail,
  type InvoiceDetail,
  type InvoiceLine,
} from "../invoice-contract";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const detail = useTradeDocumentDetail<InvoiceDetail>(INVOICES_PATH, id, parseInvoiceDetail);
  const invoice = detail.document;
  const { headers, canWrite } = detail.scope;
  const pdf = useTradePdfJob(INVOICES_PATH, id, headers);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const issue = useTradeFinalizeAction(
    INVOICES_PATH,
    id,
    invoice?.version ?? null,
    "issue",
    t.tradeDocuments.invoices.issue,
    headers,
    reload,
  );

  const lineLabels = useTradeTableLabels(
    t.tradeDocuments.invoices.empty,
    t.tradeDocuments.invoices.loadFailed,
  );

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={INVOICE_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={INVOICE_PERMISSIONS.read}>
        <NotFoundState
          title={t.tradeDocuments.invoices.notFoundTitle}
          description={t.tradeDocuments.invoices.notFoundDescription}
          backLabel={t.tradeDocuments.invoices.back}
          backHref={TENANT_ROUTES.tradeInvoices}
        />
      </TradeGate>
    );
  }

  const isDraft = invoice?.lifecycleStatus === "DRAFT";
  const columns: ColumnDef<InvoiceLine>[] = [
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
          currency={invoice?.currencyCode}
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
          currency={invoice?.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
  ];

  return (
    <TradeGate require={INVOICE_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !invoice ? (
          detail.loadError ? (
            <ErrorState
              title={t.tradeDocuments.invoices.loadFailed}
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
              title={invoice.documentNumber}
              subtitle={partyDisplayName(invoice.partySnapshot) ?? invoice.partyId}
              status={
                <TradeStatusBadge kind="TradeInvoiceStatus" value={invoice.lifecycleStatus} />
              }
              backLabel={t.tradeDocuments.invoices.back}
              backHref={TENANT_ROUTES.tradeInvoices}
              primaryAction={
                isDraft && canWrite(INVOICE_PERMISSIONS.issue)
                  ? {
                      label: t.tradeDocuments.invoices.issue,
                      onClick: issue.request,
                      disabled: issue.write.isWriting,
                    }
                  : undefined
              }
            />

            <TradeWriteOutcome write={issue.write} />
            <TradeWriteOutcome write={pdf.write} />

            {isDraft ? (
              // `UpdateInvoiceDto` extends `InvoiceDraftContentDto` with no
              // optionality relaxation, so a PATCH must carry the entire draft —
              // both snapshots and every line. There is no per-line edit and no
              // schema for either snapshot, so editing is blocked for the same
              // reason creating is.
              <TradeEvidenceBlocked
                title={t.tradeDocuments.invoices.createBlockedTitle}
                description={t.tradeDocuments.invoices.createBlockedDescription}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                {t.tradeDocuments.invoices.issuedNote}
              </p>
            )}

            <DetailSection
              title={t.tradeDocuments.identity}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              fields={[
                { label: t.tradeDocuments.documentNumber, value: invoice.documentNumber },
                { label: t.tradeDocuments.reference, value: invoice.reference },
                { label: t.tradeDocuments.currency, value: invoice.currencyCode },
                { label: t.tradeDocuments.invoices.dueDate, value: invoice.dueDate },
                { label: t.tradeDocuments.businessDate, value: invoice.businessDate },
                { label: t.tradeDocuments.notes, value: invoice.notes, wide: true },
              ]}
            />

            <DetailSection
              title={t.tradeDocuments.lines}
              emptyValueLabel={t.tradeDocuments.notRecorded}
              columns={1}
            >
              <DataTable
                columns={columns}
                rows={invoice.lines}
                rowKey={(line) => line.id}
                isLoading={false}
                labels={lineLabels}
              />
            </DetailSection>

            <TradeDocumentTotals
              totals={readTotalsSnapshot(invoice.totalsSnapshot)}
              currencyCode={invoice.currencyCode}
              title={t.tradeDocuments.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={!isDraft}
              onRender={() =>
                void pdf.render(
                  { sourceVersion: invoice.version, purpose: "INVOICE" },
                  t.tradeDocuments.pdf.operation,
                )
              }
              unavailableReason={t.tradeDocuments.invoices.issueDescription}
            />

            <ConfirmActionModal
              open={issue.isOpen}
              onOpenChange={(open) => (open ? issue.request() : issue.dismiss())}
              title={t.tradeDocuments.invoices.issueTitle}
              description={t.tradeDocuments.invoices.issueDescription}
              confirmLabel={t.tradeDocuments.invoices.issue}
              cancelLabel={t.common.cancel}
              loading={issue.write.isWriting}
              onConfirm={() => void issue.run()}
            />
          </>
        )}
      </div>
    </TradeGate>
  );
}
