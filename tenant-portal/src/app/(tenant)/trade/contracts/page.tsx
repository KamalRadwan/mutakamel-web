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
import { ContractFormDrawer } from "./components/ContractFormDrawer";
import {
  CONTRACTS_PATH,
  CONTRACT_PERMISSIONS,
  contractFinancialMode,
  parseContract,
  type Contract,
} from "./contract-contract";

export default function ContractsPage() {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const list = useTradeDocumentList<Contract>(CONTRACTS_PATH, parseContract);
  const canCreate = list.scope.canWrite(CONTRACT_PERMISSIONS.create);
  const labels = useTradeTableLabels(
    td.contracts.empty,
    td.contracts.loadFailed,
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
        const mode = contractFinancialMode(row) ?? "NON_FINANCIAL";
        return {
          id: row.id,
          documentNumber: row.documentNumber,
          counterpartyName: partyDisplayName(row.partySnapshot) ?? row.partyId,
          status: row.lifecycleStatus,
          statusKind: "TradeContractStatus",
          currencyCode: row.currencyCode,
          grandTotal,
          version: row.version,
          updatedAtFormatted: row.businessDate,
          dateWindowLabel: td.executive.validityWindow,
          dateWindowFormatted: `${row.effectiveFrom ?? "—"} → ${row.effectiveTo ?? "—"}`,
          axes: [
            {
              label: td.contracts.financialMode,
              value: mode,
            },
            {
              label: td.contracts.effectiveFrom,
              value: row.effectiveFrom ?? td.notRecorded,
            },
          ],
          tags: [
            {
              label: mode,
              tone: mode === "FINANCIAL" ? "emerald" : "indigo",
            },
          ],
          detailHref: `${TENANT_ROUTES.tradeContracts}/${row.id}`,
        };
      }),
    [list.items, td],
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
        id: "active",
        label: td.executive.kpiActive,
        count: countBy(["ACTIVE"]),
        tone: "emerald",
        statusFilterValue: "ACTIVE",
      },
      {
        id: "signed",
        label: td.executive.kpiConfirmed,
        count: countBy(["SIGNED"]),
        tone: "violet",
        statusFilterValue: "SIGNED",
      },
    ];
  }, [list.items, td.executive]);

  const funnelSteps: TradeFunnelStepItem[] = React.useMemo(() => {
    const countStatus = (s: string) =>
      list.items.filter((i) => i.lifecycleStatus === s).length;
    return [
      {
        status: "DRAFT",
        label: t.statusValues["TradeContractStatus.DRAFT"] ?? "DRAFT",
        count: countStatus("DRAFT"),
        tone: "amber",
      },
      {
        status: "ACTIVE",
        label: t.statusValues["TradeContractStatus.ACTIVE"] ?? "ACTIVE",
        count: countStatus("ACTIVE"),
        tone: "emerald",
      },
      {
        status: "SIGNED",
        label: t.statusValues["TradeContractStatus.SIGNED"] ?? "SIGNED",
        count: countStatus("SIGNED"),
        tone: "violet",
      },
    ];
  }, [list.items, t.statusValues]);

  const boardColumns: TradeBoardColumnSpec[] = React.useMemo(
    () => [
      {
        id: "draft",
        title: t.statusValues["TradeContractStatus.DRAFT"] ?? "DRAFT",
        tone: "amber",
        statuses: ["DRAFT"],
      },
      {
        id: "active",
        title: t.statusValues["TradeContractStatus.ACTIVE"] ?? "ACTIVE",
        tone: "emerald",
        statuses: ["ACTIVE"],
      },
      {
        id: "signed",
        title: t.statusValues["TradeContractStatus.SIGNED"] ?? "SIGNED",
        tone: "violet",
        statuses: ["SIGNED"],
      },
    ],
    [t.statusValues],
  );

  const columns: ColumnDef<Contract>[] = [
    {
      id: "number",
      header: td.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeContracts}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          <IdentifierText>{row.documentNumber}</IdentifierText>
        </Link>
      ),
    },
    {
      id: "party",
      header: td.party,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? row.partyId,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <TradeStatusBadge kind="TradeContractStatus" value={row.lifecycleStatus} />
      ),
    },
    {
      id: "mode",
      header: td.contracts.financialMode,
      cell: (row) => (
        <span className="dossier-tag dossier-tag-indigo">
          {contractFinancialMode(row) ?? "NON_FINANCIAL"}
        </span>
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
      id: "effectiveFrom",
      header: td.contracts.effectiveFrom,
      cell: (row) =>
        row.effectiveFrom ? (
          <IdentifierText>{row.effectiveFrom}</IdentifierText>
        ) : (
          "—"
        ),
    },
    {
      id: "effectiveTo",
      header: td.contracts.effectiveTo,
      cell: (row) =>
        row.effectiveTo ? (
          <IdentifierText>{row.effectiveTo}</IdentifierText>
        ) : (
          "—"
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
    <TradeGate require={CONTRACT_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          className="sr-only"
          title={td.contracts.title}
          description={td.contracts.subtitle}
          primaryAction={
            canCreate
              ? {
                  label: td.executive.newContract,
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
              kind="TradeContractStatus"
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

            <ContractFormDrawer
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
