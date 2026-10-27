"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Calculator,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  Kanban,
  LayoutGrid,
  Plus,
  RefreshCw,
  Ruler,
  Sparkles,
  Table2,
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
  ReasonDialog,
  SWATCH_SURFACE_PALETTES,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../components/InventoryListPagination";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import {
  CONVERSION_REASON_PRESETS,
  UOM_CONVERSION_STATUSES,
  convertQuantityPreview,
  type InventoryUomConversion,
} from "../inventory-governance-contract";
import { CreateUomConversionModal } from "./components/CreateUomConversionModal";
import { useUomConversions } from "./hooks/useUomConversions";

type ViewMode = "bento" | "board" | "table";

function statusTone(status: string): "positive" | "caution" | "neutral" {
  if (status === "PUBLISHED") return "positive";
  if (status === "DRAFT") return "caution";
  return "neutral";
}

function statusPalette(status: string) {
  if (status === "PUBLISHED") return SWATCH_SURFACE_PALETTES.green;
  if (status === "DRAFT") return SWATCH_SURFACE_PALETTES.amber;
  return SWATCH_SURFACE_PALETTES.teal;
}

export default function UomConversionsPage() {
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
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    pending,
    transition,
    setStatusFilter,
    openCreate,
    closeCreate,
    openTransition,
    closeTransition,
    create,
    runTransition,
    reload,
  } = useUomConversions();

  const isAr = lang === "ar";
  const [viewMode, setViewMode] = useState<ViewMode>("bento");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversion, setSelectedConversion] = useState<InventoryUomConversion | null>(null);
  const [simulatorQty, setSimulatorQty] = useState("10");

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((item) => item.status === "PUBLISHED").length;
    const draft = items.filter((item) => item.status === "DRAFT").length;
    const retired = items.filter((item) => item.status === "RETIRED").length;
    return { total, published, draft, retired };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (row) =>
        row.itemCompanyProfileId.toLowerCase().includes(q) ||
        row.fromUomId.toLowerCase().includes(q) ||
        row.toUomId.toLowerCase().includes(q) ||
        `${row.factorNumerator}:${row.factorDenominator}`.includes(q) ||
        `rev ${row.revisionNumber}`.includes(q),
    );
  }, [items, searchQuery]);

  const simulatedOutput = useMemo(() => {
    if (!selectedConversion) return null;
    return convertQuantityPreview(
      Number(simulatorQty) || 0,
      selectedConversion.factorNumerator,
      selectedConversion.factorDenominator,
    );
  }, [selectedConversion, simulatorQty]);

  const columns: ColumnDef<InventoryUomConversion>[] = [
    {
      id: "profile",
      header: t.tradeInventory.itemCompanyProfileId,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <IdentifierText className="text-xs font-semibold">
            {row.itemCompanyProfileId}
          </IdentifierText>
          <span dir="ltr" className="font-mono text-2xs text-muted-foreground">
            {row.fromUomId.slice(0, 8)} → {row.toUomId.slice(0, 8)}
          </span>
        </div>
      ),
    },
    {
      id: "factor",
      header: t.tradeInventory.factor,
      numeric: true,
      // Both halves are `bigint` columns and stay exact strings — a ratio
      // rendered through Number() would round at 2^53.
      cell: (row) => (
        <span dir="ltr" className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info-subtle/40 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-info-subtle-foreground">
          {row.factorNumerator} : {row.factorDenominator}
        </span>
      ),
    },
    {
      id: "revision",
      header: t.tradeInventory.revisionNumber,
      numeric: true,
      cell: (row) => (
        <Badge tone="brand">
          Rev #{row.revisionNumber}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <Badge tone={statusTone(row.status)}>
          {tradeStatusLabel(t.tradeStatus, row.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "effectiveFrom",
      header: t.tradeInventory.effectiveFrom,
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <span>{formatDateTime(row.effectiveFrom, lang)}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      cell: (row: InventoryUomConversion) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSelectedConversion(row)}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {isAr ? "معاينة 360°" : "Inspect 360°"}
          </Button>
          {canManage && row.status === "DRAFT" ? (
            <Button
              variant="outline"
              size="xs"
              disabled={pending !== null}
              loading={pending?.id === row.id && pending.action === "publish"}
              onClick={() => openTransition(row, "publish")}
            >
              {t.tradeCommon.publish}
            </Button>
          ) : null}
          {canManage && row.status === "PUBLISHED" ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={pending !== null}
              loading={pending?.id === row.id && pending.action === "retire"}
              onClick={() => openTransition(row, "retire")}
            >
              {t.tradeCommon.retire}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const kpiCards = [
    {
      key: "total",
      label: isAr ? "إجمالي مراجعات التحويل" : "Total Conversion Revisions",
      value: String(stats.total),
      sub: isAr ? "نسب كسرية دقيقة (bigint)" : "Exact rational bigint ratios",
      icon: Ruler,
      palette: SWATCH_SURFACE_PALETTES.purple,
    },
    {
      key: "published",
      label: isAr ? "منشورة ونشطة (PUBLISHED)" : "Published & Active (PUBLISHED)",
      value: String(stats.published),
      sub: isAr ? "معتمدة في حركات المخزون" : "Active for stock movements",
      icon: CheckCircle2,
      palette: SWATCH_SURFACE_PALETTES.green,
    },
    {
      key: "draft",
      label: isAr ? "مسودات قيد المراجعة (DRAFT)" : "Pending Drafts (DRAFT)",
      value: String(stats.draft),
      sub: isAr ? "جاهزة للنشر والاعتماد" : "Ready for governance publish",
      icon: FileEdit,
      palette: SWATCH_SURFACE_PALETTES.amber,
    },
    {
      key: "retired",
      label: isAr ? "مراجعات متقاعدة (RETIRED)" : "Retired Revisions (RETIRED)",
      value: String(stats.retired),
      sub: isAr ? "محفوظة للتدقيق التاريخي" : "Preserved for historical audit",
      icon: Archive,
      palette: SWATCH_SURFACE_PALETTES.teal,
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <InventoryModuleSubnav active="uomConversions" />

      <PageHeader
        className="sr-only"
        title={t.tradeInventory.conversionsTitle}
        description={t.tradeInventory.conversionsSubtitle}
        primaryAction={
          canManage
            ? {
                label: t.tradeInventory.conversionCreate,
                icon: <Plus className="size-4" aria-hidden="true" />,
                onClick: openCreate,
              }
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

      {isScopeResolved ? (
        <>
          {/* 4-Card KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.key}
                  className={cn(
                    "flex flex-col justify-between gap-2.5 rounded-lg border border-s-4 p-3.5 transition-all hover:shadow-sm",
                    kpi.palette.sectionCard,
                    kpi.palette.accentBorder,
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {kpi.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg",
                        kpi.palette.iconBoxIdle,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
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
                <div className="w-full sm:w-72">
                  <Input
                    size="sm"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={
                      isAr
                        ? "بحث بمعرّف الصنف أو وحدة القياس أو النسبة..."
                        : "Search item profile, UOM UUID, or ratio..."
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                  <Button
                    type="button"
                    size="xs"
                    variant={statusFilter === undefined ? "secondary" : "ghost"}
                    onClick={() => setStatusFilter(undefined)}
                  >
                    {isAr ? "الكل" : "All"} ({items.length})
                  </Button>
                  {UOM_CONVERSION_STATUSES.map((status) => {
                    const active = statusFilter === status;
                    return (
                      <Button
                        key={status}
                        type="button"
                        size="xs"
                        variant={active ? "secondary" : "ghost"}
                        onClick={() =>
                          setStatusFilter(active ? undefined : status)
                        }
                      >
                        {tradeStatusLabel(
                          t.tradeStatus,
                          status,
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
                  <span>{isAr ? "بطاقات المعادلات" : "Formula Bento"}</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("board")}
                >
                  <Kanban className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "لوحة دورة الحياة" : "Lifecycle Board"}</span>
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

          <InventoryListPagination page={pagination} onPageChange={setPage} isRefreshing={isRefreshing} />

          {viewMode === "bento" ? (
            filteredItems.length === 0 && !isLoading ? (
              <EmptyState
                icon={Ruler}
                title={
                  statusFilter || searchQuery
                    ? t.tradeCommon.emptyForFilter
                    : t.tradeInventory.conversionsEmpty
                }
                description={t.tradeInventory.conversionsSubtitle}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((row) => {
                  const palette = statusPalette(row.status);
                  return (
                    <Card
                      key={row.id}
                      className="flex flex-col justify-between gap-3 border border-border/80 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-2xs font-medium text-muted-foreground">
                              {t.tradeInventory.itemCompanyProfileId}
                            </span>
                            <IdentifierText className="text-xs font-semibold text-foreground">
                              {row.itemCompanyProfileId}
                            </IdentifierText>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge tone="brand">
                              Rev #{row.revisionNumber}
                            </Badge>
                            <Badge tone={statusTone(row.status)}>
                              {tradeStatusLabel(
                                t.tradeStatus,
                                row.status,
                                t.common.unknownCode,
                              )}
                            </Badge>
                          </div>
                        </div>

                        {/* Visual Rational Formula Equation */}
                        <div
                          dir="ltr"
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-s-4 p-3",
                            palette.sectionCard,
                            palette.accentBorder,
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <span dir="ltr" className="rounded-md bg-card/80 px-2 py-1 font-mono">
                              1 {row.fromUomId.slice(0, 8)}
                            </span>
                            <span className="text-muted-foreground">=</span>
                            <span
                              dir="ltr"
                              className={cn(
                                "rounded-md px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
                                palette.badge,
                              )}
                            >
                              {row.factorNumerator} / {row.factorDenominator}
                            </span>
                            <span dir="ltr" className="rounded-md bg-card/80 px-2 py-1 font-mono">
                              {row.toUomId.slice(0, 8)}
                            </span>
                          </div>
                          <span dir="ltr" className="font-mono text-2xs text-muted-foreground">
                            v{row.version}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs text-muted-foreground">
                              {t.tradeInventory.effectiveFrom}
                            </span>
                            <span className="font-medium text-foreground">
                              {formatDateTime(row.effectiveFrom, lang)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs text-muted-foreground">
                              {isAr ? "نسخة التزامن" : "If-Match Version"}
                            </span>
                            <span dir="ltr" className="font-mono font-medium text-foreground">
                              v{row.version}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSelectedConversion(row)}
                        >
                          <Calculator className="size-3.5" aria-hidden="true" />
                          {isAr ? "محاكي الكميات 360°" : "360° Math Simulator"}
                        </Button>
                        <div className="flex items-center gap-1.5">
                          {canManage && row.status === "DRAFT" ? (
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={pending !== null}
                              loading={
                                pending?.id === row.id &&
                                pending.action === "publish"
                              }
                              onClick={() => openTransition(row, "publish")}
                            >
                              {t.tradeCommon.publish}
                            </Button>
                          ) : null}
                          {canManage && row.status === "PUBLISHED" ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              disabled={pending !== null}
                              loading={
                                pending?.id === row.id &&
                                pending.action === "retire"
                              }
                              onClick={() => openTransition(row, "retire")}
                            >
                              {t.tradeCommon.retire}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : viewMode === "board" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {UOM_CONVERSION_STATUSES.map((stage) => {
                const stageRows = filteredItems.filter((r) => r.status === stage);
                const palette = statusPalette(stage);
                return (
                  <Card
                    key={stage}
                    className="flex flex-col gap-3 border border-border/80 bg-muted/20 p-3.5"
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
                      <Badge tone={statusTone(stage)}>
                        {stageRows.length}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {stageRows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                          {isAr ? "لا توجد قواعد في هذه المرحلة" : "No conversions in this stage"}
                        </div>
                      ) : (
                        stageRows.map((row) => (
                          <Card
                            key={row.id}
                            className="flex flex-col gap-2.5 border border-border/80 p-3 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <IdentifierText className="text-xs font-semibold">
                                {row.itemCompanyProfileId.slice(0, 13)}…
                              </IdentifierText>
                              <Badge tone="brand">
                                Rev #{row.revisionNumber}
                              </Badge>
                            </div>
                            <div
                              dir="ltr"
                              className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-xs font-semibold"
                            >
                              <span>1 {row.fromUomId.slice(0, 6)}</span>
                              <span>=</span>
                              <span className="text-primary">
                                {row.factorNumerator} : {row.factorDenominator}
                              </span>
                              <span>{row.toUomId.slice(0, 6)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setSelectedConversion(row)}
                              >
                                <Eye className="size-3.5" aria-hidden="true" />
                                {isAr ? "معاينة" : "Inspect"}
                              </Button>
                              {canManage && row.status === "DRAFT" ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => openTransition(row, "publish")}
                                >
                                  {t.tradeCommon.publish}
                                </Button>
                              ) : null}
                              {canManage && row.status === "PUBLISHED" ? (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => openTransition(row, "retire")}
                                >
                                  {t.tradeCommon.retire}
                                </Button>
                              ) : null}
                            </div>
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
              rows={filteredItems}
              isLoading={isLoading}
              error={queryError}
              onRetry={() => void reload()}
              rowKey={(row) => row.id}
              labels={{
                retry: t.common.retry,
                errorTitle: t.tradeInventory.conversionsLoadFailed,
                emptyTitle:
                  statusFilter || searchQuery
                    ? t.tradeCommon.emptyForFilter
                    : t.tradeInventory.conversionsEmpty,
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
          icon={Ruler}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}

      {/* View One: 360° UOM Conversion Math & Quantity Simulator Modal */}
      <Dialog
        open={selectedConversion !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedConversion(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogTitle>
            {selectedConversion
              ? `${t.tradeInventory.conversionsTitle} — Rev #${selectedConversion.revisionNumber}`
              : t.tradeInventory.conversionsTitle}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "ملف 360° للمعادلة الكسرية ومحاكي تحويل الكميات الدقيق (bigint)"
              : "360° Rational Conversion Dossier & Exact bigint Quantity Simulator"}
          </DialogDescription>
          {selectedConversion ? (
            <div className="mt-3 flex flex-col gap-4">
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-s-4 p-4",
                  statusPalette(selectedConversion.status).sectionCard,
                  statusPalette(selectedConversion.status).accentBorder,
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-2xs font-medium text-muted-foreground">
                    {t.tradeInventory.itemCompanyProfileId}
                  </span>
                  <IdentifierText className="text-sm font-semibold text-foreground">
                    {selectedConversion.itemCompanyProfileId}
                  </IdentifierText>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="brand">
                    Rev #{selectedConversion.revisionNumber} · If-Match v{selectedConversion.version}
                  </Badge>
                  <Badge
                    tone={statusTone(selectedConversion.status)}
                  >
                    {tradeStatusLabel(
                      t.tradeStatus,
                      selectedConversion.status,
                      t.common.unknownCode,
                    )}
                  </Badge>
                </div>
              </div>

              {/* Interactive Quantity Simulator */}
              <div className="flex flex-col gap-3 rounded-lg border border-info/30 bg-info-subtle/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Calculator className="size-4 text-info-subtle-foreground" aria-hidden="true" />
                    {isAr
                      ? "محاكي تحويل الكميات الدقيق (Exact Rational Simulator)"
                      : "Interactive Exact Rational Quantity Simulator"}
                  </span>
                  <span dir="ltr" className="font-mono text-xs font-semibold tabular-nums text-info-subtle-foreground">
                    {selectedConversion.factorNumerator} : {selectedConversion.factorDenominator}
                  </span>
                </div>

                <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-2xs font-medium text-muted-foreground">
                      {isAr ? "كمية وحدة المصدر (From UOM)" : "Input Quantity (From UOM)"}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        size="sm"
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={simulatorQty}
                        onChange={(e) => setSimulatorQty(e.target.value)}
                        placeholder="1"
                        className="font-mono font-semibold tabular-nums"
                      />
                      <IdentifierText className="shrink-0 rounded-md bg-muted px-2 py-1 text-2xs">
                        {selectedConversion.fromUomId.slice(0, 8)}
                      </IdentifierText>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-2xs font-medium text-muted-foreground">
                      {isAr ? "الكمية المحولة (To UOM)" : "Converted Output (To UOM)"}
                    </label>
                    <div dir="ltr" className="flex h-8 items-center justify-between rounded-lg border border-info/40 bg-card px-3 font-mono text-sm font-semibold tabular-nums text-info-subtle-foreground">
                      <span>{simulatedOutput ?? "—"}</span>
                      <IdentifierText className="rounded-md bg-muted px-2 py-0.5 text-2xs text-foreground">
                        {selectedConversion.toUomId.slice(0, 8)}
                      </IdentifierText>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {["1", "5", "10", "25", "100"].map((sample) => (
                    <Button
                      key={sample}
                      type="button"
                      size="xs"
                      variant={simulatorQty === sample ? "secondary" : "outline"}
                      onClick={() => setSimulatorQty(sample)}
                    >
                      ×{sample}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Full Metadata Dossier */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.fromUom}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {selectedConversion.fromUomId}
                  </IdentifierText>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.toUom}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {selectedConversion.toUomId}
                  </IdentifierText>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    {t.tradeInventory.effectiveFrom}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-foreground">
                    {formatDateTime(selectedConversion.effectiveFrom, lang)}
                  </span>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    {isAr ? "رقم المراجعة" : "Revision Number"}
                  </span>
                  <span dir="ltr" className="mt-1 block font-mono text-xs font-semibold text-foreground">
                    Rev #{selectedConversion.revisionNumber} · v{selectedConversion.version}
                  </span>
                </div>
              </div>

              {/* Governance Reason Presets & Actions */}
              <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                  {isAr
                    ? "رموز أسباب الحوكمة الموصى بها (Publish / Retire)"
                    : "Recommended Governance Reason Codes (Publish / Retire)"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CONVERSION_REASON_PRESETS.map((code) => (
                    <IdentifierText
                      key={code}
                      className="rounded-md border border-border bg-card px-2 py-0.5 text-2xs"
                    >
                      {code}
                    </IdentifierText>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                {canManage && selectedConversion.status === "DRAFT" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      const row = selectedConversion;
                      setSelectedConversion(null);
                      openTransition(row, "publish");
                    }}
                  >
                    {t.tradeCommon.publish}
                  </Button>
                ) : null}
                {canManage && selectedConversion.status === "PUBLISHED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const row = selectedConversion;
                      setSelectedConversion(null);
                      openTransition(row, "retire");
                    }}
                  >
                    {t.tradeCommon.retire}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedConversion(null)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <CreateUomConversionModal
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
          transition?.action === "retire"
            ? t.tradeInventory.conversionRetireTitle
            : t.tradeInventory.conversionPublishTitle
        }
        description={t.tradeInventory.conversionTransitionDescription}
        reasonRequired
        maxLength={80}
        onConfirm={(reason) => void runTransition(reason)}
        loading={pending !== null}
        labels={{
          reason: t.tradeInventory.reasonCode,
          reasonHint: t.tradeInventory.reasonCodeHint,
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
