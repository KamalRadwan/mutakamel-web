"use client";

import { Filter, Pencil, RefreshCw, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  ConflictDialog,
  DataTable,
  EmptyState,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TRADE_FOUNDATION_NAV_ITEMS,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TradeScopeBar } from "../TradeScopeBar";
import { tradeLocalizedName } from "../trade-validation";
import { TRADE_PERMISSIONS } from "../trade-scope";
import { CreateUomDrawer, EditUomDrawer } from "./components/UomDrawers";
import { useUoms } from "./hooks/useUoms";
import { UOM_STATUSES, type Uom, type UomStatus } from "./uom-contract";

export default function TradeUomsPage() {
  const { t, lang } = useI18n();
  const uoms = useUoms();

  const filterValues: FilterValues = uoms.statusFilter
    ? { status: { kind: "select", value: uoms.statusFilter } }
    : {};

  const columns: ColumnDef<Uom>[] = [
    {
      id: "code",
      header: t.trade.uomCode,
      cell: (uom) => <IdentifierText className="font-medium text-foreground">{uom.code}</IdentifierText>,
    },
    { id: "displayName", header: t.trade.uomDisplayName, cell: (uom) => uom.displayName },
    {
      id: "localized",
      header: t.trade.localizedName,
      cell: (uom) => tradeLocalizedName(uom.localizedNames, lang) || "—",
    },
    {
      id: "sourceKind",
      header: t.trade.uomSourceKind,
      cell: (uom) => uom.sourceEvidence.sourceKind,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (uom) => (
        <Badge tone={uom.status === "ACTIVE" ? "positive" : "neutral"}>
          {t.trade[`uomStatus_${uom.status}`]}
        </Badge>
      ),
    },
    {
      id: "updatedAt",
      header: t.trade.updatedAt,
      cell: (uom) => formatDate(uom.updatedAt, lang),
    },
    ...(uoms.canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (uom: Uom) => (
              <span className="flex items-center justify-end gap-1">
                <RowAction
                  label={t.trade.uomEditTitle}
                  disabled={uoms.isSubmitting}
                  onClick={() => uoms.openEdit(uom)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </RowAction>
                {uom.status === "ACTIVE" ? (
                  <RowAction
                    label={t.trade.uomRetire}
                    disabled={uoms.isSubmitting}
                    onClick={() => uoms.openRetire(uom)}
                  >
                    <XCircle className="size-4 text-destructive" aria-hidden="true" />
                  </RowAction>
                ) : null}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.trade.uomsTitle}
          description={t.trade.uomsSubtitle}
          primaryAction={
            uoms.canManage ? { label: t.trade.uomCreate, onClick: uoms.openCreate } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={() => void uoms.reload()} disabled={uoms.isRefreshing}>
              <RefreshCw
                className={uoms.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />

        <TradeScopeBar />

        {uoms.scopeGap ? (
          // Not an error: `GET /uoms` is Gateway BRANCH_REQUIRED, so the list
          // cannot legally be asked for until both are chosen.
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.uomScopeRequiredDescription}
          />
        ) : (
          <>
            <FilterBar
              filters={[
                {
                  id: "status",
                  kind: "select",
                  label: t.common.status,
                  placeholder: t.trade.statusAny,
                  options: UOM_STATUSES.map((status) => ({
                    value: status,
                    label: t.trade[`uomStatus_${status}`],
                  })),
                },
              ]}
              values={filterValues}
              onChange={(next) => {
                const value = next.status;
                uoms.setStatusFilter(
                  value?.kind === "select" && value.value ? (value.value as UomStatus) : undefined,
                );
              }}
              onReset={() => uoms.setStatusFilter(undefined)}
              searchValue={uoms.search}
              onSearchChange={uoms.setSearch}
              searchPlaceholder={t.trade.uomSearchPlaceholder}
              clearAllLabel={t.trade.clearFilters}
              filtersLabel={t.common.filter}
            />

            <DataTable
              columns={columns}
              rows={uoms.items}
              isLoading={uoms.isLoading}
              error={uoms.queryError}
              onRetry={() => void uoms.reload()}
              page={uoms.pageInfo}
              onPageChange={uoms.setPage}
              rowKey={(uom) => uom.id}
              labels={{
                retry: t.common.retry,
                errorTitle: t.trade.uomLoadFailed,
                emptyTitle: t.trade.uomEmpty,
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
          </>
        )}

        <CreateUomDrawer
          key={uoms.createOpen ? "create-open" : "create-closed"}
          isOpen={uoms.createOpen}
          isSubmitting={uoms.isSubmitting}
          error={uoms.formError}
          onClose={uoms.closeCreate}
          onSubmit={uoms.create}
        />

        {uoms.editing ? (
          <EditUomDrawer
            key={uoms.editing.id}
            uom={uoms.editing}
            isSubmitting={uoms.isSubmitting}
            error={uoms.formError}
            onClose={uoms.closeEdit}
            onSubmit={uoms.update}
          />
        ) : null}

        <ConfirmActionModal
          open={uoms.retiring !== null}
          onOpenChange={(open) => {
            if (!open) uoms.closeRetire();
          }}
          title={t.trade.uomRetireTitle}
          description={t.trade.uomRetireDescription}
          confirmLabel={t.trade.uomRetire}
          cancelLabel={t.common.cancel}
          onConfirm={() => void uoms.retire()}
          loading={uoms.isSubmitting}
        />

        {/* 409 `TRADE.CONCURRENCY.STALE_VERSION`. No overwrite action: Trade
            has no force path — the only way forward is to reload and redo. */}
        <ConflictDialog
          open={uoms.conflict !== null}
          onOpenChange={(open) => {
            if (!open) uoms.dismissConflict();
          }}
          title={t.trade.conflictTitle}
          description={t.trade.conflictDescription}
          theirChanges={
            uoms.conflict ? (
              <span className="block text-xs">
                {uoms.conflict.displayName}
                <IdentifierText className="ms-2 text-muted-foreground">
                  v{uoms.conflict.version}
                </IdentifierText>
              </span>
            ) : null
          }
          onReload={uoms.resolveConflict}
          onCancel={uoms.dismissConflict}
          labels={{
            yourChanges: t.trade.conflictYours,
            theirChanges: t.trade.conflictTheirs,
            reload: t.trade.conflictReload,
            overwrite: t.trade.conflictReload,
            cancel: t.common.cancel,
          }}
        />
      </div>
    </PermissionGate>
  );
}

function RowAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
