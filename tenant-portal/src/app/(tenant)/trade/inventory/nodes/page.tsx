"use client";

import Link from "next/link";
import { RefreshCw, Warehouse } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  PermissionGate,
  SubNav,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { TRADE_INVENTORY_NAV_ITEMS } from "../inventory-nav";
import { INVENTORY_READ_PERMISSION, type InventoryNode } from "../inventory-contract";
import { CreateNodeModal } from "./components/CreateNodeModal";
import { useInventoryNodes } from "./hooks/useInventoryNodes";

export default function InventoryNodesPage() {
  const {
    t,
    lang,
    canRead,
    canManage,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    isLoading,
    isRefreshing,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    openCreate,
    closeCreate,
    create,
    reload,
  } = useInventoryNodes();

  const columns: ColumnDef<InventoryNode>[] = [
    {
      id: "code",
      header: t.tradeInventory.nodeCode,
      cell: (node) => (
        <Link href={`${TENANT_ROUTES.tradeInventoryNodes}/${node.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
          {node.code}
        </Link>
      ),
    },
    { id: "name", header: t.tradeInventory.nodeName, cell: (node) => node.name },
    {
      id: "type",
      header: t.tradeInventory.nodeType,
      cell: (node) => <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, node.nodeType)}</Badge>,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (node) => (
        <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, node.status)}
        </Badge>
      ),
    },
    { id: "timezone", header: t.tradeInventory.nodeTimezone, cell: (node) => node.timezone },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (node) => formatDateTime(node.updatedAt, lang),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.nodesTitle}
        description={t.tradeInventory.nodesSubtitle}
        primaryAction={
          canManage ? { label: t.tradeInventory.nodeCreate, onClick: openCreate } : undefined
        }
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isRefreshing}
            />
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      <SubNav items={TRADE_INVENTORY_NAV_ITEMS} />

      {isScopeResolved ? (
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(node) => node.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.tradeInventory.nodesLoadFailed,
            emptyTitle: t.tradeInventory.nodesEmpty,
            selectAll: t.common.actions,
            selectRow: t.common.actions,
            sortAscending: t.common.actions,
            sortDescending: t.common.actions,
            notSorted: t.common.actions,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />
      ) : (
        <EmptyState
          icon={Warehouse}
          title={t.tradeInventory.selectBranchFirst}
          description={t.tradeInventory.selectBranchFirstDescription}
        />
      )}

      <CreateNodeModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
