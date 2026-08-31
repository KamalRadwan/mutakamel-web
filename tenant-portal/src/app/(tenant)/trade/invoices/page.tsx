"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, DataTable, PageHeader, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  TradeEvidenceBlocked,
  TradeScopeRequired,
} from "../documents/components/TradeBoundaryStates";
import { TradeDocumentFilters } from "../documents/components/TradeDocumentFilters";
import { TradeGate } from "../documents/components/TradeGate";
import { TradeStatusBadge } from "../documents/components/TradeStatusBadge";
import { useTradeDocumentList } from "../documents/hooks/useTradeDocumentList";
import { useTradeTableLabels } from "../documents/hooks/useTradeTableLabels";
import { partyDisplayName } from "../documents/trade-document-contract";
import { INVOICES_PATH, INVOICE_PERMISSIONS, parseInvoice, type Invoice } from "./invoice-contract";

export default function InvoicesPage() {
  const { t } = useI18n();
  const list = useTradeDocumentList<Invoice>(INVOICES_PATH, parseInvoice);
  const labels = useTradeTableLabels(
    t.tradeDocuments.invoices.empty,
    t.tradeDocuments.invoices.loadFailed,
  );

  const columns: ColumnDef<Invoice>[] = [
    {
      id: "number",
      header: t.tradeDocuments.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeInvoices}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {row.documentNumber}
        </Link>
      ),
    },
    {
      id: "party",
      header: t.tradeDocuments.customer,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? row.partyId,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => <TradeStatusBadge kind="TradeInvoiceStatus" value={row.lifecycleStatus} />,
    },
    { id: "dueDate", header: t.tradeDocuments.invoices.dueDate, cell: (row) => row.dueDate },
    { id: "businessDate", header: t.tradeDocuments.businessDate, cell: (row) => row.businessDate },
  ];

  return (
    <TradeGate require={INVOICE_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.tradeDocuments.invoices.title}
          description={t.tradeDocuments.invoices.subtitle}
          secondaryActions={
            <Button variant="outline" onClick={() => void list.reload()} disabled={list.isRefreshing}>
              <RefreshCw
                className={list.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeDocuments.reload}
            </Button>
          }
        />

        {/* No create action: every invoice line requires a non-empty
            `priceSnapshot` whose contents nothing in the Trade service
            describes (Q32). A disabled button would imply the capability exists
            and is merely withheld. */}
        {list.scope.canWrite(INVOICE_PERMISSIONS.create) ? (
          <TradeEvidenceBlocked
            title={t.tradeDocuments.invoices.createBlockedTitle}
            description={t.tradeDocuments.invoices.createBlockedDescription}
          />
        ) : null}

        {list.scope.isResolved ? (
          <>
            <TradeDocumentFilters
              kind="TradeInvoiceStatus"
              value={list.status}
              onChange={list.setStatus}
            />
            <DataTable
              columns={columns}
              rows={list.items}
              isLoading={list.isLoading}
              error={list.queryError}
              onRetry={() => void list.reload()}
              page={list.pageInfo}
              onPageChange={list.setPage}
              rowKey={(row) => row.id}
              labels={labels}
            />
          </>
        ) : (
          <TradeScopeRequired />
        )}
      </div>
    </TradeGate>
  );
}
