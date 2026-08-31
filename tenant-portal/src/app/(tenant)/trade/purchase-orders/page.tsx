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
  PURCHASE_ORDERS_PATH,
  PURCHASE_ORDER_PERMISSIONS,
  parsePurchaseOrder,
  type PurchaseOrder,
} from "./purchase-order-contract";

export default function PurchaseOrdersPage() {
  const { t } = useI18n();
  const list = useTradeDocumentList<PurchaseOrder>(PURCHASE_ORDERS_PATH, parsePurchaseOrder);
  const labels = useTradeTableLabels(
    t.tradeDocuments.purchaseOrders.empty,
    t.tradeDocuments.purchaseOrders.loadFailed,
  );

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      id: "number",
      header: t.tradeDocuments.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradePurchaseOrders}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {row.documentNumber ?? row.draftReference ?? row.id}
        </Link>
      ),
    },
    {
      id: "party",
      header: t.tradeDocuments.supplier,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? "—",
    },
    {
      id: "lifecycle",
      header: t.tradeDocuments.purchaseOrders.lifecycleAxis,
      cell: (row) => (
        <TradeStatusBadge kind="TradePurchaseOrderStatus" value={row.lifecycleStatus} />
      ),
    },
    {
      id: "approval",
      header: t.tradeDocuments.purchaseOrders.approvalAxis,
      cell: (row) => <TradeStatusBadge kind="TradeApprovalStatus" value={row.approvalStatus} />,
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
    <TradeGate require={PURCHASE_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.tradeDocuments.purchaseOrders.title}
          description={t.tradeDocuments.purchaseOrders.subtitle}
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
              kind="TradePurchaseOrderStatus"
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
