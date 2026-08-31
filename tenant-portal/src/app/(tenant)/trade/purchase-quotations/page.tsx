"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, DataTable, PageHeader, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../documents/components/TradeBoundaryStates";
import { TradeDocumentFilters } from "../documents/components/TradeDocumentFilters";
import { TradeGate } from "../documents/components/TradeGate";
import { TradeStatusBadge } from "../documents/components/TradeStatusBadge";
import { useTradeDocumentList } from "../documents/hooks/useTradeDocumentList";
import { useTradeTableLabels } from "../documents/hooks/useTradeTableLabels";
import { partyDisplayName } from "../documents/trade-document-contract";
import { PurchaseQuotationDrawer } from "./components/PurchaseQuotationDrawer";
import { usePurchaseQuotationForm } from "./hooks/usePurchaseQuotationForm";
import {
  PURCHASE_QUOTATIONS_PATH,
  PURCHASE_QUOTATION_PERMISSIONS,
  parsePurchaseQuotation,
  type PurchaseQuotation,
} from "./purchase-quotation-contract";

export default function PurchaseQuotationsPage() {
  const { t } = useI18n();
  const list = useTradeDocumentList<PurchaseQuotation>(
    PURCHASE_QUOTATIONS_PATH,
    parsePurchaseQuotation,
  );
  const canCreate = list.scope.canWrite(PURCHASE_QUOTATION_PERMISSIONS.create);
  const form = usePurchaseQuotationForm(
    list.scope.headers,
    list.scope.canWrite(PURCHASE_QUOTATION_PERMISSIONS.accounts),
    null,
    list.reload,
  );
  const labels = useTradeTableLabels(
    t.tradeDocuments.purchaseQuotations.empty,
    t.tradeDocuments.purchaseQuotations.loadFailed,
  );

  const columns: ColumnDef<PurchaseQuotation>[] = [
    {
      id: "number",
      header: t.tradeDocuments.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradePurchaseQuotations}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {row.documentNumber}
        </Link>
      ),
    },
    {
      id: "party",
      header: t.tradeDocuments.supplier,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? row.partyId,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <TradeStatusBadge kind="TradePurchaseQuotationStatus" value={row.lifecycleStatus} />
      ),
    },
    {
      id: "validUntil",
      header: t.tradeDocuments.validUntil,
      cell: (row) => row.validUntil,
    },
    { id: "reference", header: t.tradeDocuments.reference, cell: (row) => row.reference },
  ];

  return (
    <TradeGate require={PURCHASE_QUOTATION_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.tradeDocuments.purchaseQuotations.title}
          description={t.tradeDocuments.purchaseQuotations.subtitle}
          primaryAction={
            canCreate
              ? { label: t.tradeDocuments.purchaseQuotations.create, onClick: form.open }
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

        <TradeWriteOutcome write={form.write} />

        {list.scope.isResolved ? (
          <>
            <TradeDocumentFilters
              kind="TradePurchaseQuotationStatus"
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

        <PurchaseQuotationDrawer state={form} isEdit={false} />
      </div>
    </TradeGate>
  );
}
