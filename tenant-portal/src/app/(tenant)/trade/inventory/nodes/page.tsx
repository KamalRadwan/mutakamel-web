"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cloud,
  Eye,
  Kanban,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Store,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  IdentifierText,
  Input,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  type ColumnDef,
  type SwatchHue,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import {
  INVENTORY_NODES_MANAGE_PERMISSION,
  INVENTORY_READ_PERMISSION,
  NODE_TYPES,
  type InventoryNode,
} from "../inventory-contract";
import { CreateNodeModal } from "./components/CreateNodeModal";
import { useInventoryNodes } from "./hooks/useInventoryNodes";

const ARCHETYPE_HUE: Record<string, SwatchHue> = {
  WAREHOUSE: "indigo",
  STORE: "green",
  VIRTUAL: "purple",
};

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

  const [viewMode, setViewMode] = useState<"table" | "cards" | "board">("table");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [inspectedNode, setInspectedNode] = useState<InventoryNode | null>(null);

  const inv = t.tradeInventory;

  const stats = useMemo(() => {
    const warehouses = items.filter((n) => n.nodeType === "WAREHOUSE").length;
    const stores = items.filter((n) => n.nodeType === "STORE").length;
    const virtuals = items.filter((n) => n.nodeType === "VIRTUAL").length;
    const active = items.filter((n) => n.status === "ACTIVE").length;
    return { total: items.length, warehouses, stores, virtuals, active };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((node) => {
      if (typeFilter !== "ALL" && node.nodeType !== typeFilter) return false;
      if (statusFilter !== "ALL" && node.status !== statusFilter) return false;
      if (!q) return true;
      return (
        node.code.toLowerCase().includes(q) ||
        node.name.toLowerCase().includes(q) ||
        node.timezone.toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter, statusFilter]);

  const columns: ColumnDef<InventoryNode>[] = [
    {
      id: "code",
      header: inv.nodeCode,
      cell: (node) => (
        <Link
          href={`${TENANT_ROUTES.tradeInventoryNodes}/${node.id}`}
          className="font-mono font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {node.code}
        </Link>
      ),
    },
    {
      id: "name",
      header: inv.nodeName,
      cell: (node) => <span className="font-medium">{node.name}</span>,
    },
    {
      id: "type",
      header: inv.nodeType,
      cell: (node) => (
        <Badge
          tone={
            node.nodeType === "WAREHOUSE"
              ? "brand"
              : node.nodeType === "STORE"
                ? "positive"
                : "neutral"
          }
        >
          {tradeStatusLabel(t.tradeStatus, node.nodeType, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (node) => (
        <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, node.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "timezone",
      header: inv.nodeTimezone,
      cell: (node) => <IdentifierText>{node.timezone}</IdentifierText>,
    },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (node) => formatDateTime(node.updatedAt, lang),
    },
    {
      id: "actions",
      header: "",
      cell: (node) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setInspectedNode(node)}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            360°
          </Button>
          <Button size="xs" variant="outline" asChild>
            <Link href={`${TENANT_ROUTES.tradeInventoryNodes}/${node.id}`}>
              {inv.nodeDetailTitle}
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  const content = (
    <div className="flex flex-col gap-3">
      <PageHeader
        className="sr-only"
        title={inv.nodesTitle}
        description={inv.nodesSubtitle}
        primaryAction={
          canManage ? { label: inv.nodeCreate, onClick: openCreate } : undefined
        }
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isRefreshing}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reload()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      <InventoryModuleSubnav
        active="nodes"
        scopeBadge={`READ: BRANCH • WRITE: COMPANY (${INVENTORY_NODES_MANAGE_PERMISSION})`}
      />

      {/* 4-Card KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.indigo.sectionCard,
            SWATCH_SURFACE_PALETTES.indigo.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
              )}
            >
              <Warehouse className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.nodesTitle}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {`${formatNumber(stats.active, lang)} ${t.tradeStatus.ACTIVE}`}
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatNumber(stats.total, lang)}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.teal.sectionCard,
            SWATCH_SURFACE_PALETTES.teal.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
              )}
            >
              <Warehouse className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {t.tradeStatus.WAREHOUSE}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                WAREHOUSE
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatNumber(stats.warehouses, lang)}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.green.sectionCard,
            SWATCH_SURFACE_PALETTES.green.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
              )}
            >
              <Store className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {t.tradeStatus.STORE}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                STORE
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatNumber(stats.stores, lang)}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.purple.sectionCard,
            SWATCH_SURFACE_PALETTES.purple.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
              )}
            >
              <Cloud className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {t.tradeStatus.VIRTUAL}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                VIRTUAL
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatNumber(stats.virtuals, lang)}
          </span>
        </div>
      </div>

      {/* Toolbar: Search, Archetype/Status Filters, Branch Selector & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${inv.nodeCode} / ${inv.nodeName} / ${inv.nodeTimezone}`}
            className="w-60"
          />
          <div className="flex flex-wrap items-center gap-1">
            {(["ALL", ...NODE_TYPES] as const).map((typeKey) => (
              <Button
                key={typeKey}
                size="xs"
                variant={typeFilter === typeKey ? "secondary" : "outline"}
                onClick={() => setTypeFilter(typeKey)}
              >
                {typeKey === "ALL" ? t.trade.statusAny : t.tradeStatus[typeKey]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((stKey) => (
              <Button
                key={stKey}
                size="xs"
                variant={statusFilter === stKey ? "secondary" : "ghost"}
                onClick={() => setStatusFilter(stKey)}
              >
                {stKey === "ALL" ? t.common.status : t.tradeStatus[stKey]}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={selectBranch}
            disabled={isRefreshing}
          />
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant={viewMode === "cards" ? "secondary" : "outline"}
              aria-pressed={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" />
              {t.trade.categories.cards}
            </Button>
            <Button
              size="xs"
              variant={viewMode === "board" ? "secondary" : "outline"}
              aria-pressed={viewMode === "board"}
              onClick={() => setViewMode("board")}
            >
              <Kanban className="size-3.5" aria-hidden="true" />
              {inv.nodeType}
            </Button>
            <Button
              size="xs"
              variant={viewMode === "table" ? "secondary" : "outline"}
              aria-pressed={viewMode === "table"}
              onClick={() => setViewMode("table")}
            >
              <List className="size-3.5" aria-hidden="true" />
              {t.trade.categories.list}
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void reload()}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={isRefreshing ? "size-3.5 animate-spin" : "size-3.5"}
              aria-hidden="true"
            />
            {t.tradeCommon.reload}
          </Button>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              {inv.nodeCreate}
            </Button>
          ) : null}
        </div>
      </div>

      {!isScopeResolved ? (
        <EmptyState
          icon={Warehouse}
          title={inv.selectBranchFirst}
          description={inv.selectBranchFirstDescription}
        />
      ) : viewMode === "cards" ? (
        filteredItems.length === 0 && !isLoading ? (
          <EmptyState icon={Warehouse} title={inv.nodesEmpty} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((node) => {
              const hue = ARCHETYPE_HUE[node.nodeType] ?? "indigo";
              const palette = SWATCH_SURFACE_PALETTES[hue];
              return (
                <Card
                  key={node.id}
                  className={cn(
                    "flex flex-col gap-3 border border-s-4 p-4 shadow-2xs",
                    palette.sectionCard,
                    palette.accentBorder,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`${TENANT_ROUTES.tradeInventoryNodes}/${node.id}`}
                        className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {node.code}
                      </Link>
                      <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">
                        {node.name}
                      </h3>
                    </div>
                    <Badge
                      tone={node.status === "ACTIVE" ? "positive" : "neutral"}
                    >
                      {tradeStatusLabel(
                        t.tradeStatus,
                        node.status,
                        t.common.unknownCode,
                      )}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2.5 text-xs">
                    <div>
                      <span className="block text-2xs text-muted-foreground">
                        {inv.nodeType}
                      </span>
                      <span className="font-semibold text-foreground">
                        {tradeStatusLabel(
                          t.tradeStatus,
                          node.nodeType,
                          t.common.unknownCode,
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="block text-2xs text-muted-foreground">
                        {inv.nodeTimezone}
                      </span>
                      <IdentifierText className="font-semibold">
                        {node.timezone}
                      </IdentifierText>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 text-2xs text-muted-foreground">
                    <span>
                      v{formatNumber(node.version, lang)} •{" "}
                      {formatDateTime(node.updatedAt, lang)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setInspectedNode(node)}
                      >
                        <Eye className="size-3" aria-hidden="true" />
                        360°
                      </Button>
                      <Button size="xs" variant="outline" asChild>
                        <Link
                          href={`${TENANT_ROUTES.tradeInventoryNodes}/${node.id}`}
                        >
                          {inv.nodeDetailTitle}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : viewMode === "board" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {NODE_TYPES.map((archetype) => {
            const hue = ARCHETYPE_HUE[archetype] ?? "indigo";
            const palette = SWATCH_SURFACE_PALETTES[hue];
            const colNodes = filteredItems.filter(
              (n) => n.nodeType === archetype,
            );
            return (
              <div
                key={archetype}
                className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/25 p-3"
              >
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-s-4 bg-card px-3 py-2",
                    palette.accentBorder,
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">
                    {t.tradeStatus[archetype]}
                  </span>
                  <Badge tone="brand">
                    {formatNumber(colNodes.length, lang)}
                  </Badge>
                </div>
                {colNodes.map((node) => (
                  <Card
                    key={node.id}
                    className={cn(
                      "flex flex-col gap-2 border border-s-4 p-3 shadow-2xs",
                      palette.sectionCard,
                      palette.accentBorder,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`${TENANT_ROUTES.tradeInventoryNodes}/${node.id}`}
                          className="font-mono text-xs font-semibold text-foreground hover:underline"
                        >
                          {node.code}
                        </Link>
                        <p className="text-xs font-medium text-muted-foreground">
                          {node.name}
                        </p>
                      </div>
                      <Badge
                        tone={node.status === "ACTIVE" ? "positive" : "neutral"}
                      >
                        {tradeStatusLabel(
                          t.tradeStatus,
                          node.status,
                          t.common.unknownCode,
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-2xs text-muted-foreground">
                      <IdentifierText>{node.timezone}</IdentifierText>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setInspectedNode(node)}
                      >
                        360°
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          density="compact"
          columns={columns}
          rows={filteredItems}
          isLoading={isLoading}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(node) => node.id}
          labels={{
            retry: t.common.retry,
            errorTitle: inv.nodesLoadFailed,
            emptyTitle: inv.nodesEmpty,
            selectAll: t.common.actions,
            selectRow: t.common.actions,
            sortAscending: t.common.actions,
            sortDescending: t.common.actions,
            notSorted: t.common.actions,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) =>
                formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />
      )}

      {/* 360° Quick-View Node Inspector Modal */}
      <Dialog
        open={Boolean(inspectedNode)}
        onOpenChange={(open) => {
          if (!open) setInspectedNode(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogTitle>
            {inspectedNode?.code} — {inspectedNode?.name}
          </DialogTitle>
          <DialogDescription>{inv.nodesSubtitle}</DialogDescription>
          {inspectedNode ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-muted/30 p-3.5 text-xs">
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.nodeCode}
                  </span>
                  <IdentifierText className="font-semibold">
                    {inspectedNode.code}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.nodeType}
                  </span>
                  <span className="font-semibold">
                    {tradeStatusLabel(
                      t.tradeStatus,
                      inspectedNode.nodeType,
                      t.common.unknownCode,
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {t.common.status}
                  </span>
                  <Badge
                    tone={
                      inspectedNode.status === "ACTIVE" ? "positive" : "neutral"
                    }
                  >
                    {tradeStatusLabel(
                      t.tradeStatus,
                      inspectedNode.status,
                      t.common.unknownCode,
                    )}
                  </Badge>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.nodeTimezone}
                  </span>
                  <IdentifierText className="font-semibold">
                    {inspectedNode.timezone}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {t.tradeCommon.version}
                  </span>
                  <span className="font-mono font-semibold">
                    v{formatNumber(inspectedNode.version, lang)}
                  </span>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {t.tradeCommon.updatedAt}
                  </span>
                  <span>{formatDateTime(inspectedNode.updatedAt, lang)}</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInspectedNode(null)}
                >
                  {t.common.close}
                </Button>
                <Button size="sm" asChild>
                  <Link
                    href={`${TENANT_ROUTES.tradeInventoryNodes}/${inspectedNode.id}`}
                  >
                    {inv.nodeDetailTitle} →
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
