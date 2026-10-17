"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe,
  LayoutGrid,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  ShieldAlert,
  Table2,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  cn,
  ConfirmActionModal,
  ConflictDialog,
  DataTable,
  EmptyState,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  StatCard,
  StatGrid,
  SWATCH_SURFACE_PALETTES,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import { tradeLocalizedName } from "../trade-validation";
import { CreateUomDrawer, EditUomDrawer } from "./components/UomDrawers";
import { useUoms } from "./hooks/useUoms";
import {
  getUomCatalogueMetadata,
  UOM_CATEGORIES,
  UOM_CATEGORY_HUES,
  type UomCategory,
} from "./uom-catalogue-metadata";
import {
  UOM_STATUSES,
  type CatalogUomPurpose,
  type Uom,
  type UomStatus,
} from "./uom-contract";

type UomViewMode = "table" | "cards" | "operating";
type UomSourceFilter = "ALL" | "STANDARD" | "CUSTOM";

const OPERATING_PURPOSES: readonly CatalogUomPurpose[] = [
  "ANY",
  "SALES",
  "PURCHASE",
];

export default function TradeUomsPage() {
  const { t, lang } = useI18n();
  const uoms = useUoms();

  const [viewMode, setViewMode] = useState<UomViewMode>("table");
  const [categoryFilter, setCategoryFilter] = useState<UomCategory | "ALL">("ALL");
  const [sourceFilter, setSourceFilter] = useState<UomSourceFilter>("ALL");

  const existingCodes = useMemo(
    () => new Set(uoms.items.map((item) => item.code.toUpperCase())),
    [uoms.items],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<UomCategory, number> = {
      COUNT: 0,
      PACKAGING: 0,
      MASS: 0,
      VOLUME: 0,
      LENGTH: 0,
      AREA: 0,
      TIME_SERVICE: 0,
      ENERGY: 0,
      PHARMA: 0,
    };
    for (const item of uoms.items) {
      const meta = getUomCatalogueMetadata(
        item.code,
        item.displayName,
        item.localizedNames,
      );
      counts[meta.category] += 1;
    }
    return counts;
  }, [uoms.items]);

  const filteredItems = useMemo(() => {
    return uoms.items.filter((item) => {
      const meta = getUomCatalogueMetadata(
        item.code,
        item.displayName,
        item.localizedNames,
      );
      if (categoryFilter !== "ALL" && meta.category !== categoryFilter) {
        return false;
      }
      if (sourceFilter === "STANDARD" && !meta.isStandard) return false;
      if (sourceFilter === "CUSTOM" && meta.isStandard) return false;
      return true;
    });
  }, [uoms.items, categoryFilter, sourceFilter]);

  const kpiMetrics = useMemo(() => {
    let activeCount = 0;
    let bilingualCount = 0;
    const families = new Set<UomCategory>();
    for (const item of uoms.items) {
      if (item.status === "ACTIVE") activeCount += 1;
      if (item.localizedNames.ar?.trim() && item.localizedNames.en?.trim()) {
        bilingualCount += 1;
      }
      const meta = getUomCatalogueMetadata(
        item.code,
        item.displayName,
        item.localizedNames,
      );
      families.add(meta.category);
    }
    return {
      totalCount: uoms.pageInfo.total || uoms.items.length,
      activeCount,
      bilingualCount,
      familyCount: families.size,
    };
  }, [uoms.items, uoms.pageInfo.total]);

  const handleSwitchViewMode = (nextMode: UomViewMode) => {
    setViewMode(nextMode);
    if (nextMode === "operating" && uoms.operatingItems.length === 0) {
      void uoms.loadOperating(uoms.operatingPurpose);
    }
  };

  const filterValues: FilterValues = uoms.statusFilter
    ? { status: { kind: "select", value: uoms.statusFilter } }
    : {};

  const columns: ColumnDef<Uom>[] = [
    {
      id: "code",
      header: t.trade.uomCode,
      cell: (uom) => {
        const meta = getUomCatalogueMetadata(
          uom.code,
          uom.displayName,
          uom.localizedNames,
        );
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`${TENANT_ROUTES.tradeUoms}/${uom.id}`}
              className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
            >
              <IdentifierText className="font-semibold text-foreground">
                {uom.code}
              </IdentifierText>
            </Link>
            {meta.unEceCode ? (
              <IdentifierText className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                UN:{meta.unEceCode}
              </IdentifierText>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "category",
      header: t.trade.uomCategory,
      cell: (uom) => {
        const meta = getUomCatalogueMetadata(
          uom.code,
          uom.displayName,
          uom.localizedNames,
        );
        const palette = SWATCH_SURFACE_PALETTES[meta.hue];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              palette.badge,
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", palette.dot)}
              aria-hidden="true"
            />
            {t.trade[`uomCategory_${meta.category}`]}
          </span>
        );
      },
    },
    {
      id: "displayName",
      header: t.trade.uomDisplayName,
      cell: (uom) => {
        const meta = getUomCatalogueMetadata(
          uom.code,
          uom.displayName,
          uom.localizedNames,
        );
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">{uom.displayName}</span>
            <Badge tone="neutral" className="rounded-full px-2 py-0.5 text-2xs">
              {meta.isStandard
                ? t.trade.uomSourceStandard
                : t.trade.uomSourceCustom}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "localized",
      header: t.trade.localizedName,
      cell: (uom) => {
        const localeKeys = Object.keys(uom.localizedNames).filter((k) =>
          uom.localizedNames[k]?.trim(),
        );
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground">
              {tradeLocalizedName(uom.localizedNames, lang) || "—"}
            </span>
            <div className="flex items-center gap-1">
              {localeKeys.slice(0, 3).map((loc) => (
                <IdentifierText
                  key={loc}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground"
                >
                  {loc.toUpperCase()}
                </IdentifierText>
              ))}
              {localeKeys.length > 3 ? (
                <IdentifierText className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                  +{localeKeys.length - 3}
                </IdentifierText>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t.common.status,
      cell: (uom) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={uom.status === "ACTIVE" ? "positive" : "neutral"}>
            {t.trade[`uomStatus_${uom.status}`]}
          </Badge>
          <IdentifierText className="text-2xs text-muted-foreground">
            v{uom.version}
          </IdentifierText>
        </div>
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
            width: "5.5rem",
            cell: (uom: Uom) => (
              <span className="flex items-center justify-end gap-1">
                <RowAction
                  label={t.trade.uomEditTitle}
                  disabled={uoms.isSubmitting}
                  onClick={() => uoms.openEdit(uom)}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </RowAction>
                {uom.status === "ACTIVE" ? (
                  <RowAction
                    label={t.trade.uomRetire}
                    disabled={uoms.isSubmitting}
                    onClick={() => uoms.openRetire(uom)}
                  >
                    <XCircle className="size-3.5 text-destructive" aria-hidden="true" />
                  </RowAction>
                ) : (
                  <RowAction
                    label={t.trade.uomReactivate}
                    disabled={uoms.isSubmitting}
                    onClick={() => uoms.openReactivate(uom)}
                  >
                    <RotateCcw
                      className="size-3.5 text-success-subtle-foreground"
                      aria-hidden="true"
                    />
                  </RowAction>
                )}
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
          className="sr-only"
          title={t.trade.uomsTitle}
          description={t.trade.uomsSubtitle}
          primaryAction={
            uoms.canManage
              ? { label: t.trade.uomCreate, onClick: () => uoms.openCreate("custom") }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void uoms.reload()}
              disabled={uoms.isRefreshing}
            >
              <RefreshCw
                className={uoms.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <TradeScopeBar hideWhenSingleScope />

        {/* Retire Blocked Reference Protection Banner (`409 TRADE.CATALOG.UOM_RETIRE_REFERENCED`) */}
        {uoms.retireBlocked ? (
          <div
            role="alert"
            className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle/50 p-4 shadow-2xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {t.trade.uomRetireBlockedTitle}
                    </span>
                    <IdentifierText className="rounded-sm border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
                      {uoms.retireBlocked.code}
                    </IdentifierText>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.trade.uomRetireBlockedExplanation}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={uoms.dismissRetireBlocked}
                className="bg-card"
              >
                {t.common.close}
              </Button>
            </div>

            <ul className="grid gap-1.5 ps-7 text-xs text-foreground sm:grid-cols-3">
              <li className="rounded-md border border-border bg-card p-2.5">
                {t.trade.uomRetireBlockedItemMaster}
              </li>
              <li className="rounded-md border border-border bg-card p-2.5">
                {t.trade.uomRetireBlockedPriceLists}
              </li>
              <li className="rounded-md border border-border bg-card p-2.5">
                {t.trade.uomRetireBlockedQuotations}
              </li>
            </ul>

            <p className="ps-7 text-xs font-medium text-muted-foreground">
              {t.trade.uomRetireBlockedActionHint}
            </p>
          </div>
        ) : null}

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
            {/* 1. 4-Card KPI Summary Strip */}
            <StatGrid>
              <StatCard
                label={t.trade.uomKpiTotalTitle}
                value={kpiMetrics.totalCount}
                description={t.trade.uomKpiTotalHint}
                icon={Ruler}
                tone="neutral"
              />
              <StatCard
                label={t.trade.uomKpiActiveTitle}
                value={kpiMetrics.activeCount}
                description={t.trade.uomKpiActiveHint}
                icon={CheckCircle2}
                tone="brand"
              />
              <StatCard
                label={t.trade.uomKpiBilingualTitle}
                value={kpiMetrics.bilingualCount}
                description={t.trade.uomKpiBilingualHint}
                icon={Globe}
                tone="brand"
              />
              <StatCard
                label={t.trade.uomKpiCategoriesTitle}
                value={kpiMetrics.familyCount}
                description={t.trade.uomKpiCategoriesHint}
                icon={Layers}
                tone="warn"
              />
            </StatGrid>

            {/* 2. View Switcher & Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "table" ? "primary" : "ghost"}
                  onClick={() => handleSwitchViewMode("table")}
                  className="gap-1.5"
                >
                  <Table2 className="size-4" aria-hidden="true" />
                  {t.trade.uomViewTable}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "cards" ? "primary" : "ghost"}
                  onClick={() => handleSwitchViewMode("cards")}
                  className="gap-1.5"
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                  {t.trade.uomViewCards}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "operating" ? "primary" : "ghost"}
                  onClick={() => handleSwitchViewMode("operating")}
                  className="gap-1.5"
                >
                  <Layers className="size-4" aria-hidden="true" />
                  {t.trade.uomViewOperating}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={TENANT_ROUTES.tradeInventoryUomConversions}>
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                    {t.trade.uomOpenConversions}
                  </Link>
                </Button>
                {uoms.canManage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => uoms.openCreate("library")}
                    >
                      <BookOpen className="size-4" aria-hidden="true" />
                      {t.trade.uomBrowseLibrary}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => uoms.openCreate("custom")}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t.trade.uomCreate}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {viewMode === "operating" ? (
              /* Operating Catalogue Projection View (`GET /api/tenant/trade/v1/catalog/uoms`) */
              <div className="grid gap-3.5 rounded-lg border border-border bg-card p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="me-1 text-xs font-semibold text-muted-foreground">
                      {t.trade.uomOperatingPurpose}:
                    </span>
                    {OPERATING_PURPOSES.map((purpose) => (
                      <Button
                        key={purpose}
                        type="button"
                        size="xs"
                        variant={
                          uoms.operatingPurpose === purpose ? "primary" : "outline"
                        }
                        onClick={() => uoms.setOperatingPurpose(purpose)}
                        className="rounded-full"
                      >
                        {t.trade[`uomOperatingPurpose_${purpose}`]}
                      </Button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => void uoms.loadOperating(uoms.operatingPurpose)}
                    disabled={uoms.isOperatingLoading}
                  >
                    <RefreshCw
                      className={
                        uoms.isOperatingLoading ? "size-3.5 animate-spin" : "size-3.5"
                      }
                      aria-hidden="true"
                    />
                    {t.trade.reload}
                  </Button>
                </div>

                {uoms.operatingItems.length === 0 && !uoms.isOperatingLoading ? (
                  <EmptyState
                    icon={Ruler}
                    title={t.trade.uomEmpty}
                    description={t.trade.uomOperatingEmpty}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {uoms.operatingItems.map((option) => {
                      const meta = getUomCatalogueMetadata(
                        option.code,
                        option.displayName,
                        option.localizedNames,
                      );
                      const palette = SWATCH_SURFACE_PALETTES[meta.hue];
                      return (
                        <div
                          key={option.id}
                          className={cn(
                            "flex flex-col justify-between gap-3 rounded-lg border border-s-4 p-3.5 shadow-2xs",
                            palette.sectionCard,
                            palette.accentBorder,
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <IdentifierText className="rounded-sm bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
                                  {option.code}
                                </IdentifierText>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
                                    palette.badge,
                                  )}
                                >
                                  {t.trade[`uomCategory_${meta.category}`]}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                {option.displayName}
                              </span>
                            </div>

                            {typeof option.sourceItemCount === "number" ? (
                              <Badge
                                tone="brand"
                                className="shrink-0 rounded-full px-2 py-0.5 text-2xs"
                              >
                                {formatTemplate(t.trade.uomOperatingItemsCount, {
                                  count: option.sourceItemCount,
                                })}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {option.isBaseUom ? (
                              <Badge
                                tone="positive"
                                className="rounded-full px-2 py-0.5 text-2xs"
                              >
                                {t.trade.uomOperatingBaseBadge}
                              </Badge>
                            ) : null}
                            {option.isDefaultSalesUom ? (
                              <Badge
                                tone="brand"
                                className="rounded-full px-2 py-0.5 text-2xs"
                              >
                                {t.trade.uomOperatingSalesBadge}
                              </Badge>
                            ) : null}
                            {option.isDefaultPurchaseUom ? (
                              <Badge
                                tone="caution"
                                className="rounded-full px-2 py-0.5 text-2xs"
                              >
                                {t.trade.uomOperatingPurchaseBadge}
                              </Badge>
                            ) : null}
                            {option.canSell ? (
                              <Badge
                                tone="neutral"
                                className="rounded-full px-2 py-0.5 text-2xs"
                              >
                                {t.trade.uomOperatingSellableBadge}
                              </Badge>
                            ) : null}
                            {option.canPurchase ? (
                              <Badge
                                tone="neutral"
                                className="rounded-full px-2 py-0.5 text-2xs"
                              >
                                {t.trade.uomOperatingPurchasableBadge}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 3. Colorful 9-Category Filter Pill Strip + Source Filter */}
                <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant={categoryFilter === "ALL" ? "primary" : "outline"}
                        onClick={() => setCategoryFilter("ALL")}
                        className="rounded-full"
                      >
                        {t.trade.uomCategoriesAll}
                      </Button>
                      {UOM_CATEGORIES.map((category) => {
                        const hue = UOM_CATEGORY_HUES[category];
                        const palette = SWATCH_SURFACE_PALETTES[hue];
                        const isSelected = categoryFilter === category;
                        const count = categoryCounts[category];
                        return (
                          <Button
                            key={category}
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setCategoryFilter(category)}
                            className={cn(
                              "gap-1.5 rounded-full",
                              isSelected
                                ? palette.pillActive
                                : "bg-card text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn("size-1.5 rounded-full", palette.dot)}
                              aria-hidden="true"
                            />
                            <span>{t.trade[`uomCategory_${category}`]}</span>
                            <span
                              dir="ltr"
                              className="rounded-full bg-muted px-1.5 py-0.5 text-2xs tabular-nums text-foreground"
                            >
                              {count}
                            </span>
                          </Button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant={sourceFilter === "ALL" ? "secondary" : "ghost"}
                        onClick={() => setSourceFilter("ALL")}
                        className="rounded-full"
                      >
                        {t.trade.uomSourceAll}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant={sourceFilter === "STANDARD" ? "secondary" : "ghost"}
                        onClick={() => setSourceFilter("STANDARD")}
                        className="rounded-full"
                      >
                        {t.trade.uomSourceStandard}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant={sourceFilter === "CUSTOM" ? "secondary" : "ghost"}
                        onClick={() => setSourceFilter("CUSTOM")}
                        className="rounded-full"
                      >
                        {t.trade.uomSourceCustom}
                      </Button>
                    </div>
                  </div>

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
                        value?.kind === "select" && value.value
                          ? (value.value as UomStatus)
                          : undefined,
                      );
                    }}
                    onReset={() => {
                      uoms.setStatusFilter(undefined);
                      setCategoryFilter("ALL");
                      setSourceFilter("ALL");
                    }}
                    searchValue={uoms.search}
                    onSearchChange={uoms.setSearch}
                    searchPlaceholder={t.trade.uomSearchPlaceholder}
                    clearAllLabel={t.trade.clearFilters}
                    filtersLabel={t.common.filter}
                  />
                </div>

                {viewMode === "cards" ? (
                  /* Colorful Category Cards Grid View */
                  filteredItems.length === 0 && !uoms.isLoading ? (
                    <EmptyState
                      icon={Ruler}
                      title={t.trade.uomEmpty}
                      description={t.trade.uomsSubtitle}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredItems.map((uom) => {
                        const meta = getUomCatalogueMetadata(
                          uom.code,
                          uom.displayName,
                          uom.localizedNames,
                        );
                        const palette = SWATCH_SURFACE_PALETTES[meta.hue];
                        const locales = Object.entries(uom.localizedNames).filter(
                          ([, val]) => val.trim().length > 0,
                        );
                        return (
                          <div
                            key={uom.id}
                            className={cn(
                              "flex flex-col justify-between gap-3 rounded-lg border border-s-4 bg-card p-4 shadow-2xs transition-colors",
                              palette.accentBorder,
                            )}
                          >
                            <div className="grid gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    href={`${TENANT_ROUTES.tradeUoms}/${uom.id}`}
                                    className="rounded-md border border-border bg-muted px-2 py-0.5 hover:border-primary"
                                  >
                                    <IdentifierText className="text-xs font-semibold text-foreground">
                                      {uom.code}
                                    </IdentifierText>
                                  </Link>
                                  {meta.unEceCode ? (
                                    <IdentifierText className="text-2xs text-muted-foreground">
                                      UN:{meta.unEceCode}
                                    </IdentifierText>
                                  ) : null}
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
                                      palette.badge,
                                    )}
                                  >
                                    <span
                                      className={cn("size-1.5 rounded-full", palette.dot)}
                                      aria-hidden="true"
                                    />
                                    {t.trade[`uomCategory_${meta.category}`]}
                                  </span>
                                </div>

                                <Badge
                                  tone={uom.status === "ACTIVE" ? "positive" : "neutral"}
                                >
                                  {t.trade[`uomStatus_${uom.status}`]}
                                </Badge>
                              </div>

                              <div>
                                <div className="text-sm font-semibold text-foreground">
                                  {uom.displayName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {tradeLocalizedName(uom.localizedNames, lang) || "—"}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1">
                                {locales.map(([loc, text]) => (
                                  <span
                                    key={loc}
                                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/50 px-1.5 py-0.5 text-2xs text-foreground"
                                  >
                                    <IdentifierText className="text-muted-foreground">
                                      {loc.toUpperCase()}
                                    </IdentifierText>
                                    <span className="max-w-28 truncate">{text}</span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <IdentifierText>v{uom.version}</IdentifierText>
                                <span aria-hidden="true">·</span>
                                <span>{formatDate(uom.updatedAt, lang)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="xs" variant="ghost" asChild>
                                  <Link href={`${TENANT_ROUTES.tradeUoms}/${uom.id}`}>
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                  </Link>
                                </Button>
                                {uoms.canManage ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="ghost"
                                      onClick={() => uoms.openEdit(uom)}
                                      aria-label={t.trade.uomEditTitle}
                                    >
                                      <Pencil className="size-3.5" aria-hidden="true" />
                                    </Button>
                                    {uom.status === "ACTIVE" ? (
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => uoms.openRetire(uom)}
                                        aria-label={t.trade.uomRetire}
                                      >
                                        <XCircle
                                          className="size-3.5 text-destructive"
                                          aria-hidden="true"
                                        />
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => uoms.openReactivate(uom)}
                                        aria-label={t.trade.uomReactivate}
                                      >
                                        <RotateCcw
                                          className="size-3.5 text-success-subtle-foreground"
                                          aria-hidden="true"
                                        />
                                      </Button>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* Master Directory Table */
                  <DataTable
                    density="compact"
                    columns={columns}
                    rows={filteredItems}
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
                )}
              </>
            )}
          </>
        )}

        <CreateUomDrawer
          key={uoms.createOpen ? `create-open-${uoms.createInitialMode}` : "create-closed"}
          isOpen={uoms.createOpen}
          initialEntryMode={uoms.createInitialMode}
          existingCodes={existingCodes}
          isCodeTaken={uoms.isCodeTaken}
          onInspectExistingCode={(code) => {
            const match = uoms.items.find(
              (item) => item.code.toUpperCase() === code.toUpperCase(),
            );
            uoms.closeCreate();
            if (match) {
              uoms.openEdit(match);
            } else {
              uoms.setSearch(code);
            }
          }}
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

        <ConfirmActionModal
          open={uoms.reactivating !== null}
          onOpenChange={(open) => {
            if (!open) uoms.closeReactivate();
          }}
          title={t.trade.uomReactivateTitle}
          description={t.trade.uomReactivateDescription}
          confirmLabel={t.trade.uomReactivate}
          cancelLabel={t.common.cancel}
          onConfirm={() => void uoms.reactivate()}
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
        <Button
          variant="ghost"
          size="xs"
          className="w-7 px-0"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
