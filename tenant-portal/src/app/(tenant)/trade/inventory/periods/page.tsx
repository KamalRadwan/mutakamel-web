"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  Clock,
  Eye,
  LayoutGrid,
  List,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
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
  FilterBar,
  IdentifierText,
  Input,
  PageHeader,
  PermissionGate,
  ReasonDialog,
  SWATCH_SURFACE_PALETTES,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../components/InventoryListPagination";
import {
  INVENTORY_GOVERNANCE_PERMISSION,
  INVENTORY_READ_PERMISSION,
} from "../inventory-contract";
import {
  computePeriodDays,
  INVENTORY_LIST_LIMIT,
  isPeriodStatus,
  PERIOD_REASON_PRESETS,
  PERIOD_STATUSES,
  type InventoryPeriod,
} from "../inventory-governance-contract";
import { CreatePeriodModal } from "./components/CreatePeriodModal";
import { useInventoryPeriods } from "./hooks/useInventoryPeriods";

export default function InventoryPeriodsPage() {
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
    pagination,
    setPage,
    statusFilter,
    effectiveAtFilter,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    pending,
    transition,
    setStatusFilter,
    setEffectiveAtFilter,
    openCreate,
    closeCreate,
    openTransition,
    closeTransition,
    create,
    runTransition,
    reload,
  } = useInventoryPeriods();

  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [inspectedPeriod, setInspectedPeriod] =
    useState<InventoryPeriod | null>(null);

  const inv = t.tradeInventory;

  const stats = useMemo(() => {
    const openCount = items.filter((p) => p.status === "OPEN").length;
    const closedCount = items.filter((p) => p.status === "CLOSED").length;
    const maxBackdate =
      items.length > 0
        ? Math.max(...items.map((p) => p.maxBackdateDays))
        : 0;
    return { total: items.length, openCount, closedCount, maxBackdate };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        (p.closeReason ?? "").toLowerCase().includes(q) ||
        p.startsOn.includes(q) ||
        p.endsOn.includes(q),
    );
  }, [items, search]);

  const filterValues: FilterValues = statusFilter
    ? { status: { kind: "select", value: statusFilter } }
    : {};

  const columns: ColumnDef<InventoryPeriod>[] = [
    {
      id: "code",
      header: inv.periodCode,
      cell: (period) => (
        <IdentifierText className="font-semibold">{period.code}</IdentifierText>
      ),
    },
    {
      id: "startsOn",
      header: inv.periodStartsOn,
      cell: (period) => <IdentifierText>{period.startsOn}</IdentifierText>,
    },
    {
      id: "endsOn",
      header: inv.periodEndsOn,
      cell: (period) => <IdentifierText>{period.endsOn}</IdentifierText>,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (period) => (
        <Badge tone={period.status === "OPEN" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, period.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "backdate",
      header: inv.periodMaxBackdateDays,
      numeric: true,
      cell: (period) => String(period.maxBackdateDays),
    },
    {
      id: "closedAt",
      header: inv.periodClosedAt,
      cell: (period) =>
        period.closedAt ? formatDateTime(period.closedAt, lang) : "—",
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      cell: (period: InventoryPeriod) => (
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setInspectedPeriod(period)}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            360°
          </Button>
          {canManage ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={pending !== null}
              loading={pending?.id === period.id}
              onClick={() =>
                openTransition(
                  period,
                  period.status === "OPEN" ? "close" : "reopen",
                )
              }
            >
              {period.status === "OPEN" ? inv.periodClose : inv.periodReopen}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const content = (
    <div className="flex flex-col gap-3">
      <PageHeader
        className="sr-only"
        title={inv.periodsTitle}
        description={inv.periodsSubtitle}
        primaryAction={
          canManage
            ? { label: inv.periodCreate, onClick: openCreate }
            : undefined
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
        active="periods"
        scopeBadge={`COMPANY • ${INVENTORY_GOVERNANCE_PERMISSION}`}
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
              <CalendarRange className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.periodsTitle}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {`limit=${INVENTORY_LIST_LIMIT}`}
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
              <LockOpen className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {t.tradeStatus.OPEN}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                OPEN
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatNumber(stats.openCount, lang)}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.amber.sectionCard,
            SWATCH_SURFACE_PALETTES.amber.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
              )}
            >
              <Lock className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {t.tradeStatus.CLOSED}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                CLOSED
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatNumber(stats.closedCount, lang)}
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
              <Clock className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.periodMaxBackdateDays}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                0..366
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {`${formatNumber(stats.maxBackdate, lang)}d`}
          </span>
        </div>
      </div>

      {isScopeResolved ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <FilterBar
                filters={[
                  {
                    id: "status",
                    kind: "select",
                    label: t.common.status,
                    placeholder: t.tradeCommon.anyStatus,
                    options: PERIOD_STATUSES.map((value) => ({
                      value,
                      label: tradeStatusLabel(
                        t.tradeStatus,
                        value,
                        t.common.unknownCode,
                      ),
                    })),
                  },
                ]}
                values={filterValues}
                onChange={(next) => {
                  const value = next.status;
                  setStatusFilter(
                    value?.kind === "select" && isPeriodStatus(value.value)
                      ? value.value
                      : undefined,
                  );
                }}
                onReset={() => {
                  setStatusFilter(undefined);
                  setEffectiveAtFilter("");
                  setSearch("");
                }}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={inv.periodCode}
                filtersLabel={t.common.filter}
                clearAllLabel={t.filters.clearAll}
              />
              <Input
                size="sm"
                type="date"
                value={effectiveAtFilter}
                onChange={(e) => setEffectiveAtFilter(e.target.value)}
                aria-label={inv.businessEffectiveAt}
                className="w-40"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
                disabled={isRefreshing}
              />
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
                variant={viewMode === "table" ? "secondary" : "outline"}
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
              >
                <List className="size-3.5" aria-hidden="true" />
                {t.trade.categories.list}
              </Button>
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
                  {inv.periodCreate}
                </Button>
              ) : null}
            </div>
          </div>

          <InventoryListPagination page={pagination} onPageChange={setPage} isRefreshing={isRefreshing} />

          {viewMode === "cards" ? (
            filteredItems.length === 0 && !isLoading ? (
              <EmptyState icon={CalendarRange} title={inv.periodsEmpty} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((period) => {
                  const isOpen = period.status === "OPEN";
                  const palette = isOpen
                    ? SWATCH_SURFACE_PALETTES.green
                    : SWATCH_SURFACE_PALETTES.amber;
                  const days = computePeriodDays(period.startsOn, period.endsOn);
                  return (
                    <Card
                      key={period.id}
                      className={cn(
                        "flex flex-col gap-3 border border-s-4 p-4 shadow-2xs",
                        palette.sectionCard,
                        palette.accentBorder,
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <IdentifierText className="text-sm font-semibold text-foreground">
                            {period.code}
                          </IdentifierText>
                          <p dir="ltr" className="font-mono text-xs text-muted-foreground">
                            {period.startsOn} → {period.endsOn}
                            {days !== null ? ` (${formatNumber(days, lang)}d)` : ""}
                          </p>
                        </div>
                        <Badge tone={isOpen ? "positive" : "neutral"}>
                          {tradeStatusLabel(
                            t.tradeStatus,
                            period.status,
                            t.common.unknownCode,
                          )}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2.5 text-xs">
                        <div>
                          <span className="block text-2xs text-muted-foreground">
                            {inv.periodMaxBackdateDays}
                          </span>
                          <span dir="ltr" className="font-mono font-semibold tabular-nums text-foreground">
                            {formatNumber(period.maxBackdateDays, lang)}d
                          </span>
                        </div>
                        <div>
                          <span className="block text-2xs text-muted-foreground">
                            {inv.periodClosedAt}
                          </span>
                          <span className="text-foreground">
                            {period.closedAt
                              ? formatDateTime(period.closedAt, lang)
                              : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 text-2xs text-muted-foreground">
                        <span>
                          v{formatNumber(period.version, lang)}
                          {period.closeReason ? ` • ${period.closeReason}` : ""}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setInspectedPeriod(period)}
                          >
                            <Eye className="size-3" aria-hidden="true" />
                            360°
                          </Button>
                          {canManage ? (
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={pending !== null}
                              loading={pending?.id === period.id}
                              onClick={() =>
                                openTransition(
                                  period,
                                  isOpen ? "close" : "reopen",
                                )
                              }
                            >
                              {isOpen ? inv.periodClose : inv.periodReopen}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            <DataTable
              density="compact"
              columns={columns}
              rows={filteredItems}
              isLoading={isLoading}
              error={queryError}
              onRetry={() => void reload()}
              rowKey={(period) => period.id}
              labels={{
                retry: t.common.retry,
                errorTitle: inv.periodsLoadFailed,
                emptyTitle: statusFilter
                  ? t.tradeCommon.emptyForFilter
                  : inv.periodsEmpty,
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
        </>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title={inv.selectCompanyFirst}
          description={inv.selectCompanyFirstDescription}
        />
      )}

      {/* 360° Period Governance Inspector Modal (View One) */}
      <Dialog
        open={Boolean(inspectedPeriod)}
        onOpenChange={(open) => {
          if (!open) setInspectedPeriod(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogTitle>
            {inspectedPeriod?.code} — {inv.periodsTitle} (360°)
          </DialogTitle>
          <DialogDescription>{inv.periodsSubtitle}</DialogDescription>
          {inspectedPeriod ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-muted/30 p-3.5 text-xs">
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.periodCode}
                  </span>
                  <IdentifierText className="font-semibold">
                    {inspectedPeriod.code}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {t.common.status}
                  </span>
                  <Badge
                    tone={
                      inspectedPeriod.status === "OPEN" ? "positive" : "neutral"
                    }
                  >
                    {tradeStatusLabel(
                      t.tradeStatus,
                      inspectedPeriod.status,
                      t.common.unknownCode,
                    )}
                  </Badge>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.periodStartsOn} → {inv.periodEndsOn}
                  </span>
                  <IdentifierText className="font-semibold">
                    {inspectedPeriod.startsOn} → {inspectedPeriod.endsOn}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.periodMaxBackdateDays}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold tabular-nums">
                    {formatNumber(inspectedPeriod.maxBackdateDays, lang)}d
                  </span>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.periodClosedAt}
                  </span>
                  <span>
                    {inspectedPeriod.closedAt
                      ? formatDateTime(inspectedPeriod.closedAt, lang)
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.reasonCode} / {t.tradeCommon.version}
                  </span>
                  <IdentifierText className="font-semibold">
                    {inspectedPeriod.closeReason ?? "—"} (v
                    {formatNumber(inspectedPeriod.version, lang)})
                  </IdentifierText>
                </div>
              </div>

              {canManage ? (
                <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {inv.reasonCodeHint}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIOD_REASON_PRESETS.map((preset) => (
                      <Badge key={preset} tone="brand" dir="ltr" className="font-mono">
                        {preset}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInspectedPeriod(null)}
                >
                  {t.common.close}
                </Button>
                {canManage ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      const target = inspectedPeriod;
                      setInspectedPeriod(null);
                      openTransition(
                        target,
                        target.status === "OPEN" ? "close" : "reopen",
                      );
                    }}
                  >
                    {inspectedPeriod.status === "OPEN"
                      ? inv.periodClose
                      : inv.periodReopen}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <CreatePeriodModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />

      <ReasonDialog
        open={transition !== null}
        onOpenChange={(open) => {
          if (!open) closeTransition();
        }}
        title={
          transition?.action === "reopen"
            ? inv.periodReopenTitle
            : inv.periodCloseTitle
        }
        description={inv.periodTransitionDescription}
        reasonRequired
        maxLength={80}
        onConfirm={(reason) => void runTransition(reason)}
        loading={pending !== null}
        labels={{
          reason: inv.reasonCode,
          reasonHint: inv.reasonCodeHint,
          confirm: t.tradeCommon.confirm,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
