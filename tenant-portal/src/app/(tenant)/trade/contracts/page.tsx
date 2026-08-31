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
import {
  CONTRACTS_PATH,
  CONTRACT_PERMISSIONS,
  parseContract,
  type Contract,
} from "./contract-contract";

/**
 * Contracts carry **no entitlement gate**.
 *
 * `TradeContractsController` has no `@RequireTradeFeature`, and
 * `trade.contracts_recurring` — the key MASTER-PLAN 11.18 named — is referenced
 * nowhere in `trade-app/src`. Building a gate for it would hide the screen from
 * tenants the server would have admitted.
 */
export default function ContractsPage() {
  const { t } = useI18n();
  const list = useTradeDocumentList<Contract>(CONTRACTS_PATH, parseContract);
  const labels = useTradeTableLabels(
    t.tradeDocuments.contracts.empty,
    t.tradeDocuments.contracts.loadFailed,
  );

  const columns: ColumnDef<Contract>[] = [
    {
      id: "number",
      header: t.tradeDocuments.documentNumber,
      cell: (row) => (
        <Link
          href={`${TENANT_ROUTES.tradeContracts}/${row.id}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {row.documentNumber}
        </Link>
      ),
    },
    {
      id: "party",
      header: t.tradeDocuments.party,
      cell: (row) => partyDisplayName(row.partySnapshot) ?? row.partyId,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => <TradeStatusBadge kind="TradeContractStatus" value={row.lifecycleStatus} />,
    },
    {
      id: "effectiveFrom",
      header: t.tradeDocuments.contracts.effectiveFrom,
      cell: (row) => row.effectiveFrom,
    },
    {
      id: "effectiveTo",
      header: t.tradeDocuments.contracts.effectiveTo,
      cell: (row) => row.effectiveTo,
    },
  ];

  return (
    <TradeGate require={CONTRACT_PERMISSIONS.read}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.tradeDocuments.contracts.title}
          description={t.tradeDocuments.contracts.subtitle}
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

        {list.scope.canWrite(CONTRACT_PERMISSIONS.create) ? (
          <TradeEvidenceBlocked
            title={t.tradeDocuments.contracts.createBlockedTitle}
            description={t.tradeDocuments.contracts.createBlockedDescription}
          />
        ) : null}

        {list.scope.isResolved ? (
          <>
            <TradeDocumentFilters
              kind="TradeContractStatus"
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
