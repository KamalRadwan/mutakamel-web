"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Kanban,
  LayoutGrid,
  Lock,
  RefreshCw,
  ScanBarcode,
  Table2,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  DataTable,
  DegradedBanner,
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
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import {
  INVENTORY_LIST_LIMIT,
  SERIAL_STATES,
  type InventorySerial,
  type SerialState,
} from "../inventory-governance-contract";
import { useInventorySerials } from "./hooks/useInventorySerials";

type ViewMode = "bento" | "board" | "table";

function serialTone(state: string): "positive" | "caution" | "negative" | "neutral" {
  if (state === "ON_HAND") return "positive";
  if (state === "RESERVED") return "caution";
  if (state === "VOIDED") return "negative";
  return "neutral";
}

function serialPalette(state: string) {
  if (state === "ON_HAND") return SWATCH_SURFACE_PALETTES.green;
  if (state === "RESERVED") return SWATCH_SURFACE_PALETTES.amber;
  if (state === "DELIVERED") return SWATCH_SURFACE_PALETTES.teal;
  return SWATCH_SURFACE_PALETTES.red;
}

export default function InventorySerialsPage() {
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    stateFilter,
    search,
    itemIdFilter,
    isLoading,
    isRefreshing,
    queryError,
    setStateFilter,
    setSearch,
    setItemIdFilter,
    reload,
  } = useInventorySerials();

  const isAr = lang === "ar";
  const [viewMode, setViewMode] = useState<ViewMode>("bento");
  const [selectedSerial, setSelectedSerial] = useState<InventorySerial | null>(null);

  const stats = useMemo(() => {
    const onHand = items.filter((s) => s.state === "ON_HAND").length;
    const reserved = items.filter((s) => s.state === "RESERVED").length;
    const delivered = items.filter((s) => s.state === "DELIVERED").length;
    const voided = items.filter((s) => s.state === "VOIDED").length;
    return { onHand, reserved, delivered, voided };
  }, [items]);

  const columns: ColumnDef<InventorySerial>[] = [
    {
      id: "serialKey",
      header: t.tradeInventory.serialKey,
      cell: (serial) => (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`${TENANT_ROUTES.tradeInventorySerials}/${serial.id}`}
            className="font-mono text-xs font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {serial.serialKey}
          </Link>
          <span className="font-mono text-2xs text-muted-foreground">
            Item: {serial.itemId.slice(0, 8)}…
          </span>
        </div>
      ),
    },
    {
      id: "state",
      header: t.tradeInventory.serialState,
      cell: (serial) => (
        <Badge tone={serialTone(serial.state)}>
          {tradeStatusLabel(t.tradeStatus, serial.state, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "node",
      header: t.tradeInventory.currentNode,
      cell: (serial) =>
        serial.currentFulfillmentNodeId ? (
          <IdentifierText className="text-xs">
            {serial.currentFulfillmentNodeId}
          </IdentifierText>
        ) : (
          <span className="text-xs text-muted-foreground">
            {isAr ? "خارج العهدة / مُسلّم" : "Dispatched / None"}
          </span>
        ),
    },
    {
      id: "lastTransitionAt",
      header: t.tradeInventory.lastTransitionAt,
      cell: (serial) => formatDateTime(serial.lastTransitionAt, lang),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      cell: (serial: InventorySerial) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSelectedSerial(serial)}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {isAr ? "معاينة" : "Quick View"}
          </Button>
          <Link
            href={`${TENANT_ROUTES.tradeInventorySerials}/${serial.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span>{isAr ? "السجل الزمني" : "Timeline"}</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </span>
      ),
    },
  ];

  const kpiCards: ReadonlyArray<{
    state: SerialState;
    label: string;
    value: number;
    sub: string;
    icon: typeof CheckCircle2;
    palette: (typeof SWATCH_SURFACE_PALETTES)[keyof typeof SWATCH_SURFACE_PALETTES];
  }> = [
    {
      state: "ON_HAND",
      label: isAr ? "متوفر في العهدة (ON_HAND)" : "In Custody (ON_HAND)",
      value: stats.onHand,
      sub: isAr ? "متاح للحجز أو التسليم" : "Available in fulfillment node",
      icon: CheckCircle2,
      palette: SWATCH_SURFACE_PALETTES.green,
    },
    {
      state: "RESERVED",
      label: isAr ? "محجوز لأمر (RESERVED)" : "Allocated Hold (RESERVED)",
      value: stats.reserved,
      sub: isAr ? "مرتبط بحجز مخزني نشط" : "Committed to active reservation",
      icon: Lock,
      palette: SWATCH_SURFACE_PALETTES.amber,
    },
    {
      state: "DELIVERED",
      label: isAr ? "تم تسليمه (DELIVERED)" : "Dispatched (DELIVERED)",
      value: stats.delivered,
      sub: isAr ? "خرج بموجب إذن تسليم" : "Shipped via outbound delivery",
      icon: Truck,
      palette: SWATCH_SURFACE_PALETTES.teal,
    },
    {
      state: "VOIDED",
      label: isAr ? "ملغى / معكوس (VOIDED)" : "Voided / Reversed (VOIDED)",
      value: stats.voided,
      sub: isAr ? "خرج من الخدمة أو عُكس" : "Reversed or decommissioned",
      icon: Ban,
      palette: SWATCH_SURFACE_PALETTES.red,
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <InventoryModuleSubnav active="serials" />

      <PageHeader
        className="sr-only"
        title={t.tradeInventory.serialsTitle}
        description={t.tradeInventory.serialsSubtitle}
      />

      {/* Colorful Header Banner */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border border-border/70 bg-gradient-to-r from-card via-card to-positive/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-positive/30 bg-positive-subtle text-positive-subtle-foreground">
            <ScanBarcode className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                {t.tradeInventory.serialsTitle}
              </h1>
              <Badge tone="positive">
                {isAr ? "تتبع فردي 360°" : "Unit-Level Custody Registry"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.tradeInventory.serialsSubtitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </Card>

      {isScopeResolved ? (
        <>
          {/* 4-State Interactive Custody KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              const isSelected = stateFilter === kpi.state;
              return (
                <div
                  key={kpi.state}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setStateFilter(isSelected ? undefined : kpi.state)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setStateFilter(isSelected ? undefined : kpi.state);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col justify-between gap-2.5 rounded-lg border border-s-4 p-3.5 text-start transition-all",
                    kpi.palette.sectionCard,
                    kpi.palette.accentBorder,
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "hover:shadow-sm",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {kpi.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg",
                        isSelected
                          ? kpi.palette.iconBoxActive
                          : kpi.palette.iconBoxIdle,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                      {kpi.value}
                    </span>
                    <span className="text-2xs text-muted-foreground">{kpi.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter & 3-Mode View Switcher Toolbar */}
          <Card className="flex flex-col gap-3 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="w-full sm:w-64">
                  <Input
                    size="sm"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.tradeInventory.serialExactSearch}
                  />
                </div>
                <div className="w-full sm:w-64">
                  <Input
                    size="sm"
                    value={itemIdFilter}
                    onChange={(e) => setItemIdFilter(e.target.value)}
                    placeholder={
                      isAr
                        ? "تصفية بمعرّف الصنف (Item UUID)..."
                        : "Filter by Item UUID (optional)..."
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                  <Button
                    type="button"
                    size="xs"
                    variant={stateFilter === undefined ? "secondary" : "ghost"}
                    onClick={() => setStateFilter(undefined)}
                  >
                    {isAr ? "الكل" : "All"} ({items.length})
                  </Button>
                  {SERIAL_STATES.map((state) => {
                    const active = stateFilter === state;
                    return (
                      <Button
                        key={state}
                        type="button"
                        size="xs"
                        variant={active ? "secondary" : "ghost"}
                        onClick={() =>
                          setStateFilter(active ? undefined : state)
                        }
                      >
                        {tradeStatusLabel(
                          t.tradeStatus,
                          state,
                          t.common.unknownCode,
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "bento" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("bento")}
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "بطاقات الهوية" : "Passport Cards"}</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("board")}
                >
                  <Kanban className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "لوحة العهدة" : "Custody Board"}</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("table")}
                >
                  <Table2 className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "الجدول" : "Table"}</span>
                </Button>
              </div>
            </div>
          </Card>

          {items.length === INVENTORY_LIST_LIMIT ? (
            <DegradedBanner
              message={formatTemplate(t.tradeCommon.limitOnlyCapped, {
                limit: INVENTORY_LIST_LIMIT,
              })}
            />
          ) : null}

          {viewMode === "bento" ? (
            items.length === 0 && !isLoading ? (
              <EmptyState
                icon={ScanBarcode}
                title={
                  stateFilter || search || itemIdFilter
                    ? t.tradeCommon.emptyForFilter
                    : t.tradeInventory.serialsEmpty
                }
                description={t.tradeInventory.serialsSubtitle}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((serial) => {
                  const palette = serialPalette(serial.state);
                  return (
                    <Card
                      key={serial.id}
                      className="flex flex-col justify-between gap-3 border border-border/80 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-3">
                        <div
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border border-s-4 p-3",
                            palette.sectionCard,
                            palette.accentBorder,
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex size-8 items-center justify-center rounded-lg",
                                palette.iconBoxIdle,
                              )}
                            >
                              <ScanBarcode className="size-4" aria-hidden="true" />
                            </span>
                            <div className="flex flex-col">
                              <span className="text-2xs text-muted-foreground">
                                {t.tradeInventory.serialKey}
                              </span>
                              <Link
                                href={`${TENANT_ROUTES.tradeInventorySerials}/${serial.id}`}
                                className="font-mono text-sm font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                {serial.serialKey}
                              </Link>
                            </div>
                          </div>
                          <Badge
                            tone={serialTone(serial.state)}
                          >
                            {tradeStatusLabel(
                              t.tradeStatus,
                              serial.state,
                              t.common.unknownCode,
                            )}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs text-muted-foreground">
                              {t.tradeInventory.itemId}
                            </span>
                            <IdentifierText className="text-xs font-semibold">
                              {serial.itemId.slice(0, 12)}…
                            </IdentifierText>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs text-muted-foreground">
                              {t.tradeInventory.currentNode}
                            </span>
                            {serial.currentFulfillmentNodeId ? (
                              <IdentifierText className="text-xs font-semibold">
                                {serial.currentFulfillmentNodeId.slice(0, 12)}…
                              </IdentifierText>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {isAr ? "خارج العهدة" : "Dispatched"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-2xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" aria-hidden="true" />
                            {t.tradeInventory.lastTransitionAt}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatDateTime(serial.lastTransitionAt, lang)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSelectedSerial(serial)}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          {isAr ? "معاينة سريعة" : "Quick View"}
                        </Button>
                        <Link
                          href={`${TENANT_ROUTES.tradeInventorySerials}/${serial.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                        >
                          <span>
                            {isAr ? "السجل الزمني 360°" : "360° Lifecycle Dossier"}
                          </span>
                          <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : viewMode === "board" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {SERIAL_STATES.map((stage) => {
                const stageSerials = items.filter((s) => s.state === stage);
                const palette = serialPalette(stage);
                return (
                  <Card
                    key={stage}
                    className="flex flex-col gap-3 border border-border/80 bg-muted/20 p-3"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-lg border border-s-4 px-3 py-2",
                        palette.sectionCard,
                        palette.accentBorder,
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {tradeStatusLabel(
                          t.tradeStatus,
                          stage,
                          t.common.unknownCode,
                        )}
                      </span>
                      <Badge tone={serialTone(stage)}>
                        {stageSerials.length}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-2">
                      {stageSerials.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                          {isAr ? "لا توجد أرقام تسلسلية" : "No serials in state"}
                        </div>
                      ) : (
                        stageSerials.map((serial) => (
                          <Card
                            key={serial.id}
                            className="flex flex-col gap-2 border border-border/80 p-3 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                href={`${TENANT_ROUTES.tradeInventorySerials}/${serial.id}`}
                                className="font-mono text-xs font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                {serial.serialKey}
                              </Link>
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={() => setSelectedSerial(serial)}
                              >
                                <Eye className="size-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                            <span className="font-mono text-2xs text-muted-foreground">
                              Node:{" "}
                              {serial.currentFulfillmentNodeId
                                ? `${serial.currentFulfillmentNodeId.slice(0, 8)}…`
                                : "—"}
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              {formatDateTime(serial.lastTransitionAt, lang)}
                            </span>
                          </Card>
                        ))
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <DataTable
              density="compact"
              columns={columns}
              rows={items}
              isLoading={isLoading}
              error={queryError}
              onRetry={() => void reload()}
              rowKey={(serial) => serial.id}
              labels={{
                retry: t.common.retry,
                errorTitle: t.tradeInventory.serialsLoadFailed,
                emptyTitle:
                  stateFilter || search || itemIdFilter
                    ? t.tradeCommon.emptyForFilter
                    : t.tradeInventory.serialsEmpty,
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
          icon={ScanBarcode}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}

      {/* View One: 360° Quick-View Serial Passport Modal */}
      <Dialog
        open={selectedSerial !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSerial(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>
            {selectedSerial
              ? `${t.tradeInventory.serialDetailTitle} — ${selectedSerial.serialKey}`
              : t.tradeInventory.serialDetailTitle}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "بطاقة الهوية والعهدة للرقم التسلسلي مع رابط مباشر للسجل الزمني الكامل"
              : "360° Unit-Level Serial Custody Passport & Lifecycle Timeline Launcher"}
          </DialogDescription>
          {selectedSerial ? (
            <div className="mt-3 flex flex-col gap-4">
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-s-4 p-4",
                  serialPalette(selectedSerial.state).sectionCard,
                  serialPalette(selectedSerial.state).accentBorder,
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.serialKey}
                  </span>
                  <span className="font-mono text-base font-semibold text-foreground">
                    {selectedSerial.serialKey}
                  </span>
                </div>
                <Badge
                  tone={serialTone(selectedSerial.state)}
                >
                  {tradeStatusLabel(
                    t.tradeStatus,
                    selectedSerial.state,
                    t.common.unknownCode,
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.itemId}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {selectedSerial.itemId}
                  </IdentifierText>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.itemCompanyProfileId}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {selectedSerial.itemCompanyProfileId}
                  </IdentifierText>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                    <Warehouse className="size-3" aria-hidden="true" />
                    {t.tradeInventory.currentNode}
                  </span>
                  {selectedSerial.currentFulfillmentNodeId ? (
                    <IdentifierText className="mt-1 block text-xs font-semibold">
                      {selectedSerial.currentFulfillmentNodeId}
                    </IdentifierText>
                  ) : (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {isAr ? "خارج العهدة / مُسلّم" : "Dispatched / External"}
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    {t.tradeInventory.lastTransitionAt}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-foreground">
                    {formatDateTime(selectedSerial.lastTransitionAt, lang)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Link
                  href={`${TENANT_ROUTES.tradeInventorySerials}/${selectedSerial.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90"
                >
                  <span>
                    {isAr
                      ? "فتح السجل الزمني الكامل 360°"
                      : "Open Full 360° Lifecycle Dossier"}
                  </span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSerial(null)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
