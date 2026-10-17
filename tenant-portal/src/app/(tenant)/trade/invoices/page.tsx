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
import {
  partyDisplayName,
  readTotalsSnapshot,
} from "../documents/trade-document-contract";
import { InvoiceFormDrawer } from "./components/InvoiceFormDrawer";
import {
  INVOICES_PATH,
  INVOICE_PERMISSIONS,
  parseInvoice,
  type Invoice,
} from "./invoice-contract";

export default function InvoicesPage() {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const list = useTradeDocumentList<Invoice>(INVOICES_PATH, parseInvoice);
  const canCreate = list.scope.canWrite(INVOICE_PERMISSIONS.create);
  const labels = useTradeTableLabels(
    td.invoices.empty,
    td.invoices.loadFailed,
  );

  const [viewMode, setViewMode] = React.useState<TradeExecutiveViewMode>("table");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [inspectId, setInspectId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const executiveRecords: TradeExecutiveRecordItem[] = React.useMemo(
    () =>
      list.items.map((row) => {
        const totals = readTotalsSnapshot(row.totalsSnapshot);
        const grandTotal = totals.grandTotal ?? "0";
        const amountDue = totals.amountDue;
        return {
          id: row.id,
          documentNumber: row.documentNumber,
          counterpartyName: partyDisplayName(row.partySnapshot) ?? row.partyId,
          status: row.lifecycleStatus,
          statusKind: "TradeInvoiceStatus",
          currencyCode: row.currencyCode,
          grandTotal,
          secondaryAmountLabel: td.totals.amountDue,
          secondaryAmount: amountDue,
          version: row.version,
          updatedAtFormatted: row.businessDate,
          dateWindowLabel: td.invoices.dueDate,
          dateWindowFormatted: row.dueDate ?? td.notRecorded,
          axes: [
            {
              label: td.statusTitle,
              value:
                t.statusValues[`TradeInvoiceStatus.${row.lifecycleStatus}`] ??
                row.lifecycleStatus,
            },
            {
              label: td.invoices.dueDate,
              value: row.dueDate ?? td.notRecorded,
            },
          ],
          detailHref: `${TENANT_ROUTES.tradeInvoices}/${row.id}`,
        };
      }),
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
        id: "issued",
        label: td.executive.kpiIssued,
        count: countBy(["ISSUED"]),
        tone: "emerald",
        statusFilterValue: "ISSUED",
      },
    ];
  }, [list.items, td.executive]);

  const funnelSteps: TradeFunnelStepItem[] = React.useMemo(() => {
    const countStatus = (s: string) =>
      list.items.filter((i) => i.lifecycleStatus === s).length;
    return [
      {
        status: "DRAFT",
        label: t.statusValues["TradeInvoiceStatus.DRAFT"] ?? "DRAFT",
        count: countStatus("DRAFT"),
        tone: "amber",
      },
      {
        status: "ISSUED",
        label: t.statusValues["TradeInvoiceStatus.ISSUED"] ?? "ISSUED",
        count: countStatus("ISSUED"),
        tone: "emerald",
      },
    ];
  }, [list.items, t.statusValues]);

  const boardColumns: TradeBoardColumnSpec[] = React.useMemo(
    () => [
      {
        id: "draft",
        title: t.statusValues["TradeInvoiceStatus.DRAFT"] ?? "DRAFT",
        tone: "amber",
        statuses: ["DRAFT"],
      },
      {
        id: "issued",
        title: t.statusValues["TradeInvoiceStatus.ISSUED"] ?? "ISSUED",
        tone: "emerald",
        statuses: ["ISSUED"],
      },
    ],
    [t.statusValues],
  );

  const columns: ColumnDef<Invoice>[] = [
    {
      id: "number",
      header: td.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeInvoices}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          <IdentifierText>{row.documentNumber}</IdentifierText>
        </Link>
      ),
    },
    {
      id: "party",
      header: td.customer,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? row.partyId,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <TradeStatusBadge kind="TradeInvoiceStatus" value={row.lifecycleStatus} />
      ),
    },
    {
      id: "total",
      header: td.grandTotal,
      numeric: true,
      cell: (row) => {
        const totals = readTotalsSnapshot(row.totalsSnapshot);
        const grandTotal = totals.grandTotal ?? "0";
        return (
          <Money
            value={grandTotal}
            currency={row.currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
          />
        );
      },
    },
    {
      id: "dueDate",
      header: td.invoices.dueDate,
      cell: (row) =>
        row.dueDate ? <IdentifierText>{row.dueDate}</IdentifierText> : "—",
    },
    {
      id: "businessDate",
      header: td.businessDate,
      cell: (row) => <IdentifierText>{row.businessDate}</IdentifierText>,
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
    <TradeGate require={INVOICE_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={td.invoices.title}
          description={td.invoices.subtitle}
          primaryAction={
            canCreate
              ? {
                  label: td.executive.newInvoice,
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
              kind="TradeInvoiceStatus"
              value={list.status}
              onChange={list.setStatus}
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

            <InvoiceFormDrawer
              open={createOpen}
              onOpenChange={setCreateOpen}
              headers={list.scope.headers}
              onSaved={list.reload}
            />
          </>
        ) : (
          <TradeScopeRequired />
        )}
      </div>
    </TradeGate>
  );
}
