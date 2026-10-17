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
import {
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../documents/components/TradeBoundaryStates";
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
  const td = t.tradeDocuments;
  const list = useTradeDocumentList<Quotation>(QUOTATIONS_PATH, parseQuotation);
  const canCreate = list.scope.canWrite(QUOTATION_PERMISSIONS.create);
  const create = useQuotationCreate(list.scope.headers, canCreate, list.reload);
  const labels = useTradeTableLabels(
    td.quotations.empty,
    td.quotations.loadFailed,
  );

  const [viewMode, setViewMode] = React.useState<TradeExecutiveViewMode>("table");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [inspectId, setInspectId] = React.useState<string | null>(null);

  const executiveRecords: TradeExecutiveRecordItem[] = React.useMemo(
    () =>
      list.items.map((row) => ({
        id: row.id,
        documentNumber: row.documentNumber ?? row.draftReference ?? row.id,
        counterpartyName: partyDisplayName(row.partySnapshot) ?? td.notRecorded,
        status: row.lifecycleStatus,
        statusKind: "TradeQuotationStatus",
        currencyCode: row.currencyCode,
        grandTotal: row.grandTotal,
        version: row.version,
        updatedAtFormatted: row.businessDate,
        dateWindowLabel: td.businessDate,
        dateWindowFormatted: row.businessDate,
        axes: [
          {
            label: td.statusTitle,
            value:
              t.statusValues[`TradeQuotationStatus.${row.lifecycleStatus}`] ??
              row.lifecycleStatus,
          },
          {
            label: td.currency,
            value: row.currencyCode,
          },
        ],
        tags: [
          {
            label: row.customerEligibilitySource,
            tone: "indigo",
          },
        ],
        detailHref: `${TENANT_ROUTES.tradeQuotations}/${row.id}`,
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
        id: "sent",
        label: td.executive.kpiPending,
        count: countBy(["SENT"]),
        tone: "cyan",
        statusFilterValue: "SENT",
      },
      {
        id: "accepted",
        label: td.executive.kpiConfirmed,
        count: countBy(["ACCEPTED"]),
        tone: "emerald",
        statusFilterValue: "ACCEPTED",
      },
      {
        id: "converted",
        label: td.executive.kpiConverted,
        count: countBy(["CONVERTED"]),
        tone: "violet",
        statusFilterValue: "CONVERTED",
      },
      {
        id: "cancelled",
        label: td.executive.kpiCancelled,
        count: countBy(["REJECTED", "CANCELLED", "EXPIRED"]),
        tone: "rose",
        statusFilterValue: "REJECTED",
      },
    ];
  }, [list.items, td.executive]);

  const funnelSteps: TradeFunnelStepItem[] = React.useMemo(() => {
    const countStatus = (s: string) =>
      list.items.filter((i) => i.lifecycleStatus === s).length;
    return [
      {
        status: "DRAFT",
        label: t.statusValues["TradeQuotationStatus.DRAFT"] ?? "DRAFT",
        count: countStatus("DRAFT"),
        tone: "amber",
      },
      {
        status: "SENT",
        label: t.statusValues["TradeQuotationStatus.SENT"] ?? "SENT",
        count: countStatus("SENT"),
        tone: "blue",
      },
      {
        status: "ACCEPTED",
        label: t.statusValues["TradeQuotationStatus.ACCEPTED"] ?? "ACCEPTED",
        count: countStatus("ACCEPTED"),
        tone: "emerald",
      },
      {
        status: "CONVERTED",
        label: t.statusValues["TradeQuotationStatus.CONVERTED"] ?? "CONVERTED",
        count: countStatus("CONVERTED"),
        tone: "violet",
      },
      {
        status: "REJECTED",
        label: t.statusValues["TradeQuotationStatus.REJECTED"] ?? "REJECTED",
        count: countStatus("REJECTED"),
        tone: "rose",
      },
      {
        status: "CANCELLED",
        label: t.statusValues["TradeQuotationStatus.CANCELLED"] ?? "CANCELLED",
        count: countStatus("CANCELLED"),
        tone: "rose",
      },
    ];
  }, [list.items, t.statusValues]);

  const boardColumns: TradeBoardColumnSpec[] = React.useMemo(
    () => [
      {
        id: "draft",
        title: t.statusValues["TradeQuotationStatus.DRAFT"] ?? "DRAFT",
        tone: "amber",
        statuses: ["DRAFT"],
      },
      {
        id: "sent",
        title: t.statusValues["TradeQuotationStatus.SENT"] ?? "SENT",
        tone: "blue",
        statuses: ["SENT"],
      },
      {
        id: "accepted",
        title: t.statusValues["TradeQuotationStatus.ACCEPTED"] ?? "ACCEPTED",
        tone: "emerald",
        statuses: ["ACCEPTED"],
      },
      {
        id: "converted",
        title: t.statusValues["TradeQuotationStatus.CONVERTED"] ?? "CONVERTED",
        tone: "violet",
        statuses: ["CONVERTED"],
      },
      {
        id: "closed",
        title: td.executive.kpiCancelled,
        tone: "rose",
        statuses: ["REJECTED", "CANCELLED", "EXPIRED"],
      },
    ],
    [t.statusValues, td.executive.kpiCancelled],
  );

  const columns: ColumnDef<Quotation>[] = [
    {
      id: "number",
      header: td.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeQuotations}/${row.id}`}
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
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <TradeStatusBadge kind="TradeQuotationStatus" value={row.lifecycleStatus} />
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
    <TradeGate require={QUOTATION_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={td.quotations.title}
          description={td.quotations.subtitle}
          primaryAction={
            canCreate
              ? { label: td.quotations.create, onClick: create.open }
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

        <TradeWriteOutcome write={create.write} />

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
              kind="TradeQuotationStatus"
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
          </>
        ) : (
          <TradeScopeRequired />
        )}

        <CreateQuotationDrawer state={create} />
      </div>
    </TradeGate>
  );
}
