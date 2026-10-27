"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, RefreshCw } from "lucide-react";
import {
  Button,
  DataTable,
  IdentifierText,
  Money,
  PageHeader,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeRequired } from "../documents/components/TradeBoundaryStates";
import { TradeDocumentFilters } from "../documents/components/TradeDocumentFilters";
import {
  TradeDocumentExecutiveBoard,
  type TradeBoardColumnSpec,
  type TradeExecutiveRecordItem,
} from "../documents/components/TradeDocumentExecutiveBoard";
import { TradeDocumentExecutiveCards } from "../documents/components/TradeDocumentExecutiveCards";
import {
  TradeDocumentFunnelBar,
  type TradeFunnelStepItem,
} from "../documents/components/TradeDocumentFunnelBar";
import {
  TradeDocumentKpiStrip,
  type TradeExecutiveViewMode,
  type TradeKpiPillItem,
} from "../documents/components/TradeDocumentKpiStrip";
import { TradeGate } from "../documents/components/TradeGate";
import { TradeQuickInspectModal } from "../documents/components/TradeQuickInspectModal";
import { TradeStatusBadge } from "../documents/components/TradeStatusBadge";
import { useTradeDocumentList } from "../documents/hooks/useTradeDocumentList";
import { useTradeTableLabels } from "../documents/hooks/useTradeTableLabels";
import { partyDisplayName } from "../documents/trade-document-contract";
import { CreateSalesOrderDrawer } from "./components/CreateSalesOrderDrawer";
import {
  SALES_ORDERS_PATH,
  SALES_ORDER_PERMISSIONS,
  parseSalesOrder,
  type SalesOrder,
} from "./sales-order-contract";

export default function SalesOrdersPage() {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const list = useTradeDocumentList<SalesOrder>(SALES_ORDERS_PATH, parseSalesOrder);
  const canCreate = list.scope.canWrite(SALES_ORDER_PERMISSIONS.create);
  const labels = useTradeTableLabels(
    td.salesOrders.empty,
    td.salesOrders.loadFailed,
  );

  const [viewMode, setViewMode] = React.useState<TradeExecutiveViewMode>("table");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [inspectId, setInspectId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const executiveRecords: TradeExecutiveRecordItem[] = React.useMemo(
    () =>
      list.items.map((row) => ({
        id: row.id,
        documentNumber: row.documentNumber ?? row.draftReference ?? row.id,
        counterpartyName: partyDisplayName(row.partySnapshot) ?? td.notRecorded,
        status: row.lifecycleStatus,
        statusKind: "TradeSalesOrderStatus",
        currencyCode: row.currencyCode,
        grandTotal: row.grandTotal,
        version: row.version,
        updatedAtFormatted: row.businessDate,
        dateWindowLabel: td.businessDate,
        dateWindowFormatted: row.businessDate,
        axes: [
          {
            label: td.salesOrders.confirmationAxis,
            value:
              t.statusValues[`TradeConfirmationStatus.${row.confirmationStatus}`] ??
              row.confirmationStatus,
          },
          {
            label: td.salesOrders.holdAxis,
            value:
              t.statusValues[`TradeHoldStatus.${row.holdStatus}`] ?? row.holdStatus,
          },
        ],
        tags: [
          ...(row.holdStatus === "HELD"
            ? [{ label: row.holdStatus, tone: "rose" as const }]
            : []),
          ...(row.sourceQuotationId
            ? [{ label: td.sourceQuotation, tone: "purple" as const }]
            : []),
        ],
        detailHref: `${TENANT_ROUTES.tradeSalesOrders}/${row.id}`,
      })),
    [list.items, td, t.statusValues],
  );

  const kpiPills: TradeKpiPillItem[] = React.useMemo(() => {
    const countBy = (statuses: string[]) =>
      list.items.filter((i) => statuses.includes(i.lifecycleStatus)).length;
    return [
      {
        id: "all",
        label: td.executive.kpiAll,
        count: list.items.length,
        tone: "blue",
        statusFilterValue: "",
      },
      {
        id: "draft",
        label: td.executive.kpiDraft,
        count: countBy(["DRAFT"]),
        tone: "amber",
        statusFilterValue: "DRAFT",
      },
      {
        id: "confirmed",
        label: td.executive.kpiConfirmed,
        count: countBy(["CONFIRMED"]),
        tone: "emerald",
        statusFilterValue: "CONFIRMED",
      },
      {
        id: "cancelled",
        label: td.executive.kpiCancelled,
        count: countBy(["CANCELLED"]),
        tone: "rose",
        statusFilterValue: "CANCELLED",
      },
    ];
  }, [list.items, td.executive]);

  const funnelSteps: TradeFunnelStepItem[] = React.useMemo(() => {
    const countStatus = (s: string) =>
      list.items.filter((i) => i.lifecycleStatus === s).length;
    return [
      {
        status: "DRAFT",
        label: t.statusValues["TradeSalesOrderStatus.DRAFT"] ?? "DRAFT",
        count: countStatus("DRAFT"),
        tone: "amber",
      },
      {
        status: "CONFIRMED",
        label: t.statusValues["TradeSalesOrderStatus.CONFIRMED"] ?? "CONFIRMED",
        count: countStatus("CONFIRMED"),
        tone: "emerald",
      },
      {
        status: "CANCELLED",
        label: t.statusValues["TradeSalesOrderStatus.CANCELLED"] ?? "CANCELLED",
        count: countStatus("CANCELLED"),
        tone: "rose",
      },
    ];
  }, [list.items, t.statusValues]);

  const boardColumns: TradeBoardColumnSpec[] = React.useMemo(
    () => [
      {
        id: "draft",
        title: t.statusValues["TradeSalesOrderStatus.DRAFT"] ?? "DRAFT",
        tone: "amber",
        statuses: ["DRAFT"],
      },
      {
        id: "confirmed",
        title: t.statusValues["TradeSalesOrderStatus.CONFIRMED"] ?? "CONFIRMED",
        tone: "emerald",
        statuses: ["CONFIRMED"],
      },
      {
        id: "cancelled",
        title: t.statusValues["TradeSalesOrderStatus.CANCELLED"] ?? "CANCELLED",
        tone: "rose",
        statuses: ["CANCELLED"],
      },
    ],
    [t.statusValues],
  );

  const columns: ColumnDef<SalesOrder>[] = [
    {
      id: "number",
      header: td.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeSalesOrders}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          <IdentifierText>
            {row.documentNumber ?? row.draftReference ?? row.id}
          </IdentifierText>
        </Link>
      ),
    },
    {
      id: "party",
      header: td.customer,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? "—",
    },
    {
      id: "lifecycle",
      header: td.salesOrders.lifecycleAxis,
      cell: (row) => (
        <TradeStatusBadge kind="TradeSalesOrderStatus" value={row.lifecycleStatus} />
      ),
    },
    {
      id: "confirmation",
      header: td.salesOrders.confirmationAxis,
      cell: (row) => (
        <TradeStatusBadge
          kind="TradeConfirmationStatus"
          value={row.confirmationStatus}
        />
      ),
    },
    {
      id: "total",
      header: td.grandTotal,
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
      id: "inspect",
      header: td.executive.quickInspect,
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setInspectId(row.id)}
        >
          <Eye className="me-1 h-3.5 w-3.5" aria-hidden />
          {td.executive.quickInspect}
        </Button>
      ),
    },
  ];

  return (
    <TradeGate require={SALES_ORDER_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          className="sr-only"
          title={td.salesOrders.title}
          description={td.salesOrders.subtitle}
          primaryAction={
            canCreate
              ? {
                  label: td.executive.newSalesOrder,
                  onClick: () => setCreateOpen(true),
                }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void list.reload()}
              disabled={list.isRefreshing}
            >
              <RefreshCw
                className={list.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {td.reload}
            </Button>
          }
        />

        {list.scope.isResolved ? (
          <>
            <TradeDocumentKpiStrip
              pills={kpiPills}
              activeStatusFilter={list.status ?? ""}
              onSelectStatusFilter={list.setStatus}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
            />

            <TradeDocumentFunnelBar
              steps={funnelSteps}
              activeStatus={list.status ?? ""}
              onSelectStatus={list.setStatus}
            />

            <TradeDocumentFilters
              kind="TradeSalesOrderStatus"
              value={list.status}
              onChange={list.setStatus}
              partyId={list.partyId}
              onPartyIdChange={list.setPartyId}
            />

            {viewMode === "board" ? (
              <TradeDocumentExecutiveBoard
                columns={boardColumns}
                records={executiveRecords}
                selectedIds={selectedIds}
                onQuickInspect={(id) => setInspectId(id)}
              />
            ) : viewMode === "cards" ? (
              <TradeDocumentExecutiveCards
                records={executiveRecords}
                selectedIds={selectedIds}
                onToggleSelect={(id) =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAllVisible={() =>
                  setSelectedIds(new Set(executiveRecords.map((r) => r.id)))
                }
                onClearSelection={() => setSelectedIds(new Set())}
                onQuickInspect={(id) => setInspectId(id)}
              />
            ) : (
              <DataTable
                density="compact"
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
            )}

            <TradeQuickInspectModal
              open={inspectId !== null}
              onOpenChange={(open) => {
                if (!open) setInspectId(null);
              }}
              records={executiveRecords}
              activeRecordId={inspectId}
              onSelectRecordId={setInspectId}
              stageSteps={funnelSteps.map((s) => ({
                status: s.status,
                label: s.label,
              }))}
            />

            <CreateSalesOrderDrawer
              open={createOpen}
              onOpenChange={setCreateOpen}
              headers={list.scope.headers}
              onCreated={list.reload}
            />
          </>
        ) : (
          <TradeScopeRequired />
        )}
      </div>
    </TradeGate>
  );
}
