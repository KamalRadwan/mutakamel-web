"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, DataTable, Money, PageHeader, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeRequired, TradeWriteOutcome } from "../documents/components/TradeBoundaryStates";
import { TradeDocumentFilters } from "../documents/components/TradeDocumentFilters";
import { TradeGate } from "../documents/components/TradeGate";
import { TradeStatusBadge } from "../documents/components/TradeStatusBadge";
import { useTradeDocumentList } from "../documents/hooks/useTradeDocumentList";
import { useTradeTableLabels } from "../documents/hooks/useTradeTableLabels";
import { partyDisplayName } from "../documents/trade-document-contract";
import { CreateQuotationDrawer } from "./components/CreateQuotationDrawer";
import { useQuotationCreate } from "./hooks/useQuotationCreate";
import {
  QUOTATIONS_PATH,
  QUOTATION_PERMISSIONS,
  parseQuotation,
  type Quotation,
} from "./quotation-contract";

export default function QuotationsPage() {
  const { t } = useI18n();
  const list = useTradeDocumentList<Quotation>(QUOTATIONS_PATH, parseQuotation);
  const canCreate = list.scope.canWrite(QUOTATION_PERMISSIONS.create);
  const create = useQuotationCreate(list.scope.headers, canCreate, list.reload);
  const labels = useTradeTableLabels(
    t.tradeDocuments.quotations.empty,
    t.tradeDocuments.quotations.loadFailed,
  );

  const columns: ColumnDef<Quotation>[] = [
    {
      id: "number",
      header: t.tradeDocuments.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeQuotations}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {/* A draft has no document number until it is sent — the sequence is
              reserved by `send`, not by `create`. */}
          {row.documentNumber ?? row.draftReference ?? row.id}
        </Link>
      ),
    },
    {
      id: "party",
      header: t.tradeDocuments.customer,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? "—",
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => <TradeStatusBadge kind="TradeQuotationStatus" value={row.lifecycleStatus} />,
    },
    {
      id: "total",
      header: t.tradeDocuments.grandTotal,
      numeric: true,
      cell: (row) => (
        <Money
          value={row.grandTotal}
          currency={row.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "businessDate",
      header: t.tradeDocuments.businessDate,
      cell: (row) => row.businessDate,
    },
  ];

  return (
    <TradeGate require={QUOTATION_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.tradeDocuments.quotations.title}
          description={t.tradeDocuments.quotations.subtitle}
          primaryAction={
            canCreate
              ? { label: t.tradeDocuments.quotations.create, onClick: create.open }
              : undefined
          }
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

        <TradeWriteOutcome write={create.write} />

        {list.scope.isResolved ? (
          <>
            <TradeDocumentFilters
              kind="TradeQuotationStatus"
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

        <CreateQuotationDrawer state={create} />
      </div>
    </TradeGate>
  );
}
