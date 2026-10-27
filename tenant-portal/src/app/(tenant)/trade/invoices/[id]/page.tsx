"use client";

import * as React from "react";
import { use, useCallback } from "react";
import { Building2, CreditCard, Pencil } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  Money,
  NotFoundState,
  PermissionGate,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
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
import { useTradeFinalizeAction } from "../../documents/hooks/useTradeFinalizeAction";
import { useTradePdfJob } from "../../documents/hooks/useTradePdfJob";
import { useTradeTableLabels } from "../../documents/hooks/useTradeTableLabels";
import {
  partyDisplayName,
  readTotalsSnapshot,
} from "../../documents/trade-document-contract";
import { InvoiceFormDrawer } from "../components/InvoiceFormDrawer";
import {
  INVOICES_PATH,
  INVOICE_PERMISSIONS,
  parseInvoiceDetail,
  type InvoiceDetail,
  type InvoiceLine,
} from "../invoice-contract";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const detail = useTradeDocumentDetail<InvoiceDetail>(
    INVOICES_PATH,
    id,
    parseInvoiceDetail,
  );
  const invoice = detail.document;
  const { headers, canWrite } = detail.scope;
  const pdf = useTradePdfJob(INVOICES_PATH, id, headers);
  const [editOpen, setEditOpen] = React.useState(false);

  const reload = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const issue = useTradeFinalizeAction(
    INVOICES_PATH,
    id,
    invoice?.version ?? null,
    "issue",
    td.invoices.issue,
    headers,
    reload,
  );

  const lineLabels = useTradeTableLabels(
    td.invoices.empty,
    td.invoices.loadFailed,
  );

  if (!detail.scope.isResolved) {
    return (
      <TradeGate require={INVOICE_PERMISSIONS.read}>
        <TradeScopeRequired />
      </TradeGate>
    );
  }

  if (detail.loadError?.status === 403) {
    return <PermissionGate require={INVOICE_PERMISSIONS.read} denied>{null}</PermissionGate>;
  }

  if (detail.isMissing) {
    return (
      <TradeGate require={INVOICE_PERMISSIONS.read}>
        <NotFoundState
          title={td.invoices.notFoundTitle}
          description={td.invoices.notFoundDescription}
          backLabel={td.invoices.back}
          backHref={TENANT_ROUTES.tradeInvoices}
        />
      </TradeGate>
    );
  }

  const isDraft = invoice?.lifecycleStatus === "DRAFT";
  const stageSteps = [
    {
      status: "DRAFT",
      label: t.statusValues["TradeInvoiceStatus.DRAFT"] ?? "DRAFT",
    },
    {
      status: "ISSUED",
      label: t.statusValues["TradeInvoiceStatus.ISSUED"] ?? "ISSUED",
    },
  ];

  const columns: ColumnDef<InvoiceLine>[] = [
    {
      id: "item",
      header: td.item,
      cell: (line) => line.descriptionSnapshot ?? line.clientLineId,
    },
    {
      id: "quantity",
      header: td.quantity,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.quantity}
          minimumFractionDigits={0}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "unitPrice",
      header: td.unitPrice,
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
      header: td.lineTotal,
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

  const totalsEntries: Record<string, string> = invoice
    ? readTotalsSnapshot(invoice.totalsSnapshot)
    : {};
  const grandTotalValue = totalsEntries.grandTotal ?? "0";
  const amountDueValue = totalsEntries.amountDue ?? grandTotalValue;

  return (
    <TradeGate require={INVOICE_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        {detail.isLoading || !invoice ? (
          detail.loadError ? (
            <ErrorState
              title={td.invoices.loadFailed}
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
                <TradeStatusBadge
                  kind="TradeInvoiceStatus"
                  value={invoice.lifecycleStatus}
                />
              }
              backLabel={td.invoices.back}
              backHref={TENANT_ROUTES.tradeInvoices}
              primaryAction={
                isDraft && canWrite(INVOICE_PERMISSIONS.issue)
                  ? {
                      label: td.invoices.issue,
                      onClick: issue.request,
                      disabled: issue.write.isWriting,
                    }
                  : undefined
              }
              secondaryActions={
                isDraft && canWrite(INVOICE_PERMISSIONS.update) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden />
                    {td.executive.editInvoice}
                  </Button>
                ) : undefined
              }
            />

            <div className="dossier-stage-bar">
              <span className="dossier-stage-label">
                {td.executive.lifecycleTrack}
              </span>
              <div className="dossier-stage-track">
                {stageSteps.map((step, idx) => {
                  const activeIdx = stageSteps.findIndex(
                    (s) => s.status === invoice.lifecycleStatus,
                  );
                  const stateClass =
                    step.status === invoice.lifecycleStatus
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

            <TradeWriteOutcome write={issue.write} />
            <TradeWriteOutcome write={pdf.write} />

            {!isDraft ? (
              <p className="text-xs text-muted-foreground">
                {td.invoices.issuedNote}
              </p>
            ) : null}

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
                      <IdentifierText>{`v${invoice.version}`}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.documentNumber}</span>
                      <span className="dossier-val">
                        <IdentifierText>{invoice.documentNumber}</IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.customer}</span>
                      <span className="dossier-val">
                        {partyDisplayName(invoice.partySnapshot) ??
                          invoice.partyId}
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.invoices.dueDate}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {invoice.dueDate ?? td.notRecorded}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.businessDate}</span>
                      <span className="dossier-val">
                        <IdentifierText>{invoice.businessDate}</IdentifierText>
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
                      <IdentifierText>{invoice.currencyCode}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-fields-grid">
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.grandTotal}</span>
                      <span className="dossier-val text-base">
                        <Money
                          value={grandTotalValue}
                          currency={invoice.currencyCode}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.totals.amountDue}</span>
                      <span className="dossier-val text-base">
                        <Money
                          value={amountDueValue}
                          currency={invoice.currencyCode}
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
                          {String(invoice.lines.length)}
                        </IdentifierText>
                      </span>
                    </div>
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.reference}</span>
                      <span className="dossier-val">
                        <IdentifierText>
                          {invoice.reference ?? td.notRecorded}
                        </IdentifierText>
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
                { label: td.documentNumber, value: invoice.documentNumber },
                { label: td.reference, value: invoice.reference },
                { label: td.currency, value: invoice.currencyCode },
                { label: td.invoices.dueDate, value: invoice.dueDate },
                { label: td.businessDate, value: invoice.businessDate },
                { label: td.notes, value: invoice.notes, wide: true },
              ]}
            />

            <DetailSection
              title={td.lines}
              emptyValueLabel={td.notRecorded}
              columns={1}
            >
              <DataTable
                density="compact"
                columns={columns}
                rows={invoice.lines}
                rowKey={(line) => line.id}
                isLoading={false}
                labels={lineLabels}
              />
            </DetailSection>

            <TradeDocumentTotals
              totals={totalsEntries}
              currencyCode={invoice.currencyCode}
              title={td.totals.grandTotal}
            />

            <TradePdfPanel
              state={pdf}
              canRender={!isDraft}
              onRender={() =>
                void pdf.render(
                  { sourceVersion: invoice.version, purpose: "INVOICE" },
                  td.pdf.operation,
                )
              }
              unavailableReason={td.invoices.issueDescription}
            />

            <InvoiceFormDrawer
              key={`${invoice.id}-v${invoice.version}`}
              open={editOpen}
              onOpenChange={setEditOpen}
              headers={headers}
              invoice={invoice}
              onSaved={reload}
            />

            <ConfirmActionModal
              open={issue.isOpen}
              onOpenChange={(open) => (open ? issue.request() : issue.dismiss())}
              title={td.invoices.issueTitle}
              description={td.invoices.issueDescription}
              confirmLabel={td.invoices.issue}
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
