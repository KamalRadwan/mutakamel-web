"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, DataTable, Money, PageHeader, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeRequired } from "../documents/components/TradeBoundaryStates";
import { TradeDocumentFilters } from "../documents/components/TradeDocumentFilters";
import { TradeGate } from "../documents/components/TradeGate";
import { TradeStatusBadge } from "../documents/components/TradeStatusBadge";
import { useTradeDocumentList } from "../documents/hooks/useTradeDocumentList";
import { useTradeTableLabels } from "../documents/hooks/useTradeTableLabels";
import { partyDisplayName } from "../documents/trade-document-contract";
import {
  SALES_ORDERS_PATH,
  SALES_ORDER_PERMISSIONS,
  parseSalesOrder,
  type SalesOrder,
} from "./sales-order-contract";

/**
 * The list carries two of the four axes, not one.
 *
 * Lifecycle alone would call a `DRAFT` order with a failed confirmation and a
 * `DRAFT` order nobody has touched the same thing. Fulfilment and billing stay
 * on the detail screen — five badges in a row is a table nobody can scan.
 */
export default function SalesOrdersPage() {
  const { t } = useI18n();
  const list = useTradeDocumentList<SalesOrder>(SALES_ORDERS_PATH, parseSalesOrder);
  const labels = useTradeTableLabels(
    t.tradeDocuments.salesOrders.empty,
    t.tradeDocuments.salesOrders.loadFailed,
  );

  const columns: ColumnDef<SalesOrder>[] = [
    {
      id: "number",
      header: t.tradeDocuments.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeSalesOrders}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
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
      id: "lifecycle",
      header: t.tradeDocuments.salesOrders.lifecycleAxis,
      cell: (row) => <TradeStatusBadge kind="TradeSalesOrderStatus" value={row.lifecycleStatus} />,
    },
    {
      id: "confirmation",
      header: t.tradeDocuments.salesOrders.confirmationAxis,
      cell: (row) => (
        <TradeStatusBadge kind="TradeConfirmationStatus" value={row.confirmationStatus} />
      ),
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
  ];

  return (
    <TradeGate require={SALES_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.tradeDocuments.salesOrders.title}
          description={t.tradeDocuments.salesOrders.subtitle}
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

        {list.scope.isResolved ? (
          <>
            <TradeDocumentFilters
              kind="TradeSalesOrderStatus"
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
