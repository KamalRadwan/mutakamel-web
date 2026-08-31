"use client";

import Link from "next/link";
import { Pencil, RefreshCw } from "lucide-react";
import {
  Badge,
  BoardView,
  Button,
  CardView,
  DegradedBanner,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  TableView,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ViewSwitcher,
  useWorkspaceView,
  TRADE_FOUNDATION_NAV_ITEMS,
  type BoardColumnDef,
  type ColumnDef,
  type FilterValues,
  type WorkspaceViewLabels,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { tradeLocalizedName } from "../../trade-validation";
import { useItems } from "../hooks/useItems";
import { CreateItemDrawer, EditItemDrawer } from "./ItemDrawers";
import {
  ITEM_KINDS,
  ITEM_STATUSES,
  isItemKind,
  isItemStatus,
  type Item,
  type ItemKind,
  type ItemStatus,
} from "../item-contract";

export function ItemsWorkspace() {
  const { t, lang } = useI18n();
  const items = useItems();
  const [view, setView] = useWorkspaceView("trade-items", "table");

  const viewLabels: WorkspaceViewLabels = {
    retry: t.common.retry,
    errorTitle: t.trade.itemLoadFailed,
    emptyTitle: t.trade.itemEmpty,
    selectAll: t.views.selectAll,
    selectRow: t.views.selectItem,
    sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending,
    notSorted: t.views.notSorted,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };

  // Item status is not a pipeline outcome, so no column carries a hue —
  // docs/design/views.md#the-grouping-axis.
  const boardColumns: BoardColumnDef[] = ITEM_STATUSES.map((status) => ({
    id: status,
    label: t.trade[`itemStatus_${status}`],
    count: items.items.filter((item) => item.status === status).length,
  }));

  const filterValues: FilterValues = {
    ...(items.kindFilter ? { itemKind: { kind: "select" as const, value: items.kindFilter } } : {}),
    ...(items.statusFilter ? { status: { kind: "select" as const, value: items.statusFilter } } : {}),
  };

  const renderName = (item: Item) => (
    <Link
      href={`${TENANT_ROUTES.tradeItems}/${item.id}`}
      className="font-medium text-foreground hover:underline"
    >
      {tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode}
    </Link>
  );

  const statusBadge = (item: Item) => (
    <Badge tone={item.status === "ACTIVE" ? "positive" : "neutral"}>
      {isItemStatus(item.status) ? t.trade[`itemStatus_${item.status}`] : item.status}
    </Badge>
  );

  const columns: ColumnDef<Item>[] = [
    { id: "name", header: t.trade.itemDetailTitle, cell: renderName },
    {
      id: "canonicalCode",
      header: t.trade.itemCode,
      cell: (item) => <span className="font-mono">{item.canonicalCode}</span>,
    },
    {
      id: "itemKind",
      header: t.trade.itemKind,
      cell: (item) =>
        isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind,
    },
    { id: "status", header: t.common.status, cell: statusBadge },
    {
      id: "eligibility",
      header: t.trade.companyProfileTitle,
      cell: (item) =>
        item.eligibility ? (
          <span className="flex flex-wrap gap-1">
            {item.eligibility.canSell ? <Badge tone="brand">{t.trade.canSell}</Badge> : null}
            {item.eligibility.canPurchase ? (
              <Badge tone="brand">{t.trade.canPurchase}</Badge>
            ) : null}
          </span>
        ) : (
          "—"
        ),
    },
    { id: "updatedAt", header: t.trade.updatedAt, cell: (item) => formatDate(item.updatedAt, lang) },
    ...(items.canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (item: Item) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.trade.itemEditTitle}
                    disabled={items.isSubmitting}
                    onClick={() => items.openEdit(item)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.trade.itemEditTitle}</TooltipContent>
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  const renderCard = (item: Item) => (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">
        {tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode}
      </span>
      <span className="font-mono text-xs text-muted-foreground">{item.canonicalCode}</span>
      {statusBadge(item)}
    </div>
  );

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PageHeader
          title={t.trade.itemsTitle}
          description={t.trade.itemsSubtitle}
          primaryAction={
            items.canManage ? { label: t.trade.itemCreate, onClick: items.openCreate } : undefined
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() => void items.reload()}
              disabled={items.isRefreshing}
            >
              <RefreshCw
                className={items.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <TradeScopeBar />
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
        </div>

        <DegradedBanner message={t.trade.itemSearchNote} />

        <FilterBar
          filters={[
            {
              id: "itemKind",
              kind: "select",
              label: t.trade.itemKind,
              placeholder: t.trade.statusAny,
              options: ITEM_KINDS.map((kind) => ({
                value: kind,
                label: t.trade[`itemKind_${kind}`],
              })),
            },
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.trade.statusAny,
              options: ITEM_STATUSES.map((status) => ({
                value: status,
                label: t.trade[`itemStatus_${status}`],
              })),
            },
          ]}
          values={filterValues}
          onChange={(next) => {
            const kind = next.itemKind;
            const status = next.status;
            items.setKindFilter(
              kind?.kind === "select" && kind.value ? (kind.value as ItemKind) : undefined,
            );
            items.setStatusFilter(
              status?.kind === "select" && status.value ? (status.value as ItemStatus) : undefined,
            );
          }}
          onReset={() => {
            items.setKindFilter(undefined);
            items.setStatusFilter(undefined);
          }}
          searchValue={items.search}
          onSearchChange={items.setSearch}
          searchPlaceholder={t.trade.itemSearchPlaceholder}
          clearAllLabel={t.trade.clearFilters}
          filtersLabel={t.common.filter}
        />

        <div className="min-h-0 flex-1">
          {view === "board" && (
            <BoardView
              columns={boardColumns}
              columnOf={(item) => item.status}
              items={items.items}
              itemKey={(item) => item.id}
              renderCard={renderCard}
              canDrag={() => items.canManage && items.movingId === null}
              onCardMove={(move) => {
                if (!isItemStatus(move.toColumnId)) return;
                void items.moveToStatus(move.itemId, move.toColumnId);
              }}
              isLoading={items.isLoading}
              error={items.queryError}
              onRetry={() => void items.reload()}
              page={items.pageInfo}
              onPageChange={items.setPage}
              labels={{ ...viewLabels, emptyColumn: t.trade.itemEmpty, moveTo: t.views.moveTo }}
            />
          )}
          {view === "card" && (
            <CardView
              items={items.items}
              itemKey={(item) => item.id}
              renderCard={renderCard}
              isLoading={items.isLoading}
              error={items.queryError}
              onRetry={() => void items.reload()}
              page={items.pageInfo}
              onPageChange={items.setPage}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
          )}
          {view === "table" && (
            <TableView
              columns={columns}
              items={items.items}
              itemKey={(item) => item.id}
              isLoading={items.isLoading}
              error={items.queryError}
              onRetry={() => void items.reload()}
              page={items.pageInfo}
              onPageChange={items.setPage}
              labels={viewLabels}
            />
          )}
        </div>

        <CreateItemDrawer
          key={items.createOpen ? "create-open" : "create-closed"}
          isOpen={items.createOpen}
          isSubmitting={items.isSubmitting}
          error={items.formError}
          onClose={items.closeCreate}
          onSubmit={items.create}
        />

        {items.editing ? (
          <EditItemDrawer
            key={items.editing.id}
            item={items.editing}
            isSubmitting={items.isSubmitting}
            error={items.formError}
            onClose={items.closeEdit}
            onSubmit={items.update}
          />
        ) : null}
      </div>
    </PermissionGate>
  );
}
