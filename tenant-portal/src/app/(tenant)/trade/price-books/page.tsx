"use client";

import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Coins,
  ExternalLink,
  LayoutGrid,
  PanelRightOpen,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Star,
  Table2,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  cn,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import {
  PRICE_BOOK_PURPOSES,
  PRICING_READ_PERMISSION,
  isPriceBookPurpose,
  type PriceBook,
} from "./pricing-contract";
import { CreatePriceBookModal } from "./components/CreatePriceBookModal";
import { CreateVersionDrawer } from "./components/CreateVersionDrawer";
import { usePriceBooks } from "./hooks/usePriceBooks";

export default function PriceBooksPage() {
  const {
    t,
    lang,
    canRead,
    canManage,
    canManageDefaults,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    allItems,
    selectedBook,
    setSelectedId,
    viewMode,
    setViewMode,
    search,
    setSearch,
    defaultMappings,
    isDefaultBusy,
    setBookAsCompanyDefault,
    removeBookCompanyDefault,
    pageInfo,
    purpose,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    versionFor,
    isSubmitting,
    formError,
    setPage,
    setPurpose,
    openCreate,
    closeCreate,
    openVersion,
    closeVersion,
    create,
    createVersion,
    reload,
  } = usePriceBooks();

  const salesCount = allItems.filter((b) => b.purpose === "SALES").length;
  const purchaseCount = allItems.filter((b) => b.purpose === "PURCHASE").length;
  const distinctCurrencies = new Set(allItems.map((b) => b.currencyCode)).size;
  const mappedDefaultsCount = Object.keys(defaultMappings).length;

  const isBookDefault = (book: PriceBook): boolean => {
    const key = `${book.purpose}:${book.currencyCode}`;
    return defaultMappings[key]?.priceBookId === book.id;
  };

  const filterValues: FilterValues = purpose
    ? { purpose: { kind: "select", value: purpose } }
    : {};

  const columns: ColumnDef<PriceBook>[] = [
    {
      id: "code",
      header: t.tradePricing.bookCode,
      cell: (book) => (
        <div className="flex items-center gap-2">
          <IdentifierText className="font-semibold text-foreground">{book.code}</IdentifierText>
          {isBookDefault(book) && (
            <Badge tone="positive">
              <Star className="me-1 size-3" aria-hidden="true" />
              {t.tradePricing.isCompanyDefault}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "purpose",
      header: t.tradePricing.bookPurpose,
      cell: (book) => {
        const palette =
          book.purpose === "SALES"
            ? SWATCH_SURFACE_PALETTES.indigo
            : SWATCH_SURFACE_PALETTES.green;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
              palette.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", palette.dot)} />
            {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
          </span>
        );
      },
    },
    {
      id: "currency",
      header: t.tradePricing.currencyCode,
      cell: (book) => (
        <IdentifierText className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold">
          {book.currencyCode}
        </IdentifierText>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (book) => (
        <Badge tone={book.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, book.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "versions",
      header: t.tradePricing.versions,
      cell: (book) =>
        book.versions.length === 0 ? (
          <span className="text-muted-foreground">{t.tradePricing.noVersions}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {book.versions.slice(0, 4).map((version) => (
              <Link
                key={version.id}
                href={`${TENANT_ROUTES.trade}/price-book-versions/${version.id}`}
                className="underline-offset-2 hover:underline"
              >
                <Badge
                  tone={
                    version.status === "PUBLISHED"
                      ? "positive"
                      : version.status === "TESTED"
                        ? "brand"
                        : "neutral"
                  }
                >
                  {`v${version.versionNumber} · ${tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}`}
                </Badge>
              </Link>
            ))}
          </span>
        ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      cell: (book: PriceBook) => (
        <div className="flex items-center justify-end gap-1.5">
          {canManageDefaults && !isBookDefault(book) && (
            <Button
              variant="ghost"
              size="xs"
              disabled={isDefaultBusy}
              onClick={(event) => {
                event.stopPropagation();
                void setBookAsCompanyDefault(book);
              }}
            >
              <Star className="size-3.5" aria-hidden="true" />
              {t.tradePricing.setAsCompanyDefault}
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                openVersion(book);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t.tradePricing.newVersion}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const kpiCards = [
    {
      id: "total",
      label: t.tradePricing.kpiTotalBooks,
      value: String(pageInfo.total || allItems.length),
      sub: t.tradePricing.booksSubtitle,
      palette: SWATCH_SURFACE_PALETTES.indigo,
      Icon: BookOpen,
    },
    {
      id: "sales",
      label: t.tradePricing.kpiSalesBooks,
      value: String(salesCount),
      sub: t.tradePricing.purposeSalesDesc,
      palette: SWATCH_SURFACE_PALETTES.blue,
      Icon: ShoppingCart,
    },
    {
      id: "purchase",
      label: t.tradePricing.kpiPurchaseBooks,
      value: String(purchaseCount),
      sub: t.tradePricing.purposePurchaseDesc,
      palette: SWATCH_SURFACE_PALETTES.green,
      Icon: ShoppingBag,
    },
    {
      id: "currencies",
      label: t.tradePricing.kpiCurrenciesAndDefaults,
      value: `${distinctCurrencies} / ${mappedDefaultsCount}`,
      sub: t.tradePricing.companyDefaultsBannerTitle,
      palette: SWATCH_SURFACE_PALETTES.amber,
      Icon: Coins,
    },
  ];

  const renderInspector = (book: PriceBook | null) => {
    if (!book) {
      return (
        <div className="flex h-full min-h-60 items-center justify-center rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {t.tradePricing.selectBookPrompt}
        </div>
      );
    }
    const palette =
      book.purpose === "SALES" ? SWATCH_SURFACE_PALETTES.indigo : SWATCH_SURFACE_PALETTES.green;
    const isDefault = isBookDefault(book);

    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-s-4 bg-card p-4",
          palette.accentBorder,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <IdentifierText className="text-base font-semibold text-foreground">
                {book.code}
              </IdentifierText>
              <Badge tone="brand">{book.currencyCode}</Badge>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                  palette.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", palette.dot)} />
                {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t.tradePricing.inspectorTitle} · {`${t.tradeCommon.version} v${book.version}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {canManage && (
              <Button size="xs" variant="primary" onClick={() => openVersion(book)}>
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradePricing.newVersion}
              </Button>
            )}
          </div>
        </div>

        {/* Company Default Mapping Card */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
            isDefault
              ? SWATCH_SURFACE_PALETTES.green.sectionCard
              : SWATCH_SURFACE_PALETTES.amber.sectionCard,
          )}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className={cn(
                "size-4 shrink-0",
                isDefault
                  ? SWATCH_SURFACE_PALETTES.green.iconText
                  : SWATCH_SURFACE_PALETTES.amber.iconText,
              )}
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                {t.tradePricing.companyDefaultsBannerTitle}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.tradePricing.companyDefaultsBannerDesc}
              </span>
            </div>
          </div>
          {canManageDefaults && (
            <div className="flex items-center gap-1.5">
              {isDefault ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isDefaultBusy}
                  onClick={() => void removeBookCompanyDefault(book)}
                >
                  {t.tradePricing.removeCompanyDefault}
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isDefaultBusy}
                  onClick={() => void setBookAsCompanyDefault(book)}
                >
                  <Star className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.setAsCompanyDefault}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Governed Versions List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t.tradePricing.versions} ({book.versions.length})
            </span>
          </div>
          {book.versions.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              {t.tradePricing.noVersions}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {book.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <IdentifierText className="text-xs font-semibold text-foreground">
                        {`v${ver.versionNumber}`}
                      </IdentifierText>
                      <Badge
                        tone={
                          ver.status === "PUBLISHED"
                            ? "positive"
                            : ver.status === "TESTED"
                              ? "brand"
                              : "neutral"
                        }
                      >
                        {tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(ver.effectiveFrom, lang)}
                      {ver.effectiveTo ? ` → ${formatDateTime(ver.effectiveTo, lang)}` : ""}
                    </span>
                  </div>
                  <Link
                    href={`${TENANT_ROUTES.trade}/price-book-versions/${ver.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    {t.tradePricing.openVersionDossier}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="sr-only"
        title={t.tradePricing.booksTitle}
        description={t.tradePricing.booksSubtitle}
        primaryAction={
          canManage ? { label: t.tradePricing.bookCreate, onClick: openCreate } : undefined
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
          {/* Colorful 4-Card KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((card) => {
              const Icon = card.Icon;
              return (
                <div
                  key={card.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                    card.palette.accentBorder,
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                    <IdentifierText className="text-xl font-semibold tabular-nums text-foreground">
                      {card.value}
                    </IdentifierText>
                    <span className="truncate text-xs text-muted-foreground">{card.sub}</span>
                  </div>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                      card.palette.iconBoxIdle,
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                </div>
              );
            })}
          </div>

          {/* Purpose Quick Pills + View Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="xs"
                variant={purpose === undefined ? "primary" : "ghost"}
                onClick={() => setPurpose(undefined)}
              >
                {t.tradePricing.filterAllPurposes}
              </Button>
              {PRICE_BOOK_PURPOSES.map((p) => (
                <Button
                  key={p}
                  size="xs"
                  variant={purpose === p ? "primary" : "ghost"}
                  onClick={() => setPurpose(p)}
                >
                  {tradeStatusLabel(t.tradeStatus, p, t.common.unknownCode)}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="xs"
                variant={viewMode === "bento" ? "primary" : "outline"}
                onClick={() => setViewMode("bento")}
              >
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                {t.tradePricing.viewBento}
              </Button>
              <Button
                size="xs"
                variant={viewMode === "table" ? "primary" : "outline"}
                onClick={() => setViewMode("table")}
              >
                <Table2 className="size-3.5" aria-hidden="true" />
                {t.tradePricing.viewTable}
              </Button>
              <Button
                size="xs"
                variant={viewMode === "split" ? "primary" : "outline"}
                onClick={() => setViewMode("split")}
              >
                <PanelRightOpen className="size-3.5" aria-hidden="true" />
                {t.tradePricing.viewSplit}
              </Button>
              {canManage && (
                <Button size="xs" variant="primary" onClick={openCreate}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t.tradePricing.bookCreate}
                </Button>
              )}
            </div>
          </div>

          <FilterBar
            filters={[
              {
                id: "purpose",
                kind: "select",
                label: t.tradePricing.bookPurpose,
                placeholder: t.tradeCommon.anyStatus,
                options: PRICE_BOOK_PURPOSES.map((value) => ({
                  value,
                  label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
                })),
              },
            ]}
            values={filterValues}
            onChange={(next) => {
              const value = next.purpose;
              setPurpose(
                value?.kind === "select" && isPriceBookPurpose(value.value)
                  ? value.value
                  : undefined,
              );
            }}
            onReset={() => {
              setPurpose(undefined);
              setSearch("");
            }}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.tradePricing.searchPlaceholder}
            filtersLabel={t.common.filter}
            clearAllLabel={t.filters.clearAll}
          />

          {viewMode === "bento" && items.length > 0 ? (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((book) => {
                const palette =
                  book.purpose === "SALES"
                    ? SWATCH_SURFACE_PALETTES.indigo
                    : SWATCH_SURFACE_PALETTES.green;
                const isDefault = isBookDefault(book);
                return (
                  <div
                    key={book.id}
                    className={cn(
                      "flex flex-col justify-between gap-3 rounded-lg border border-s-4 bg-card p-4 shadow-2xs transition-colors hover:bg-muted/20",
                      palette.accentBorder,
                    )}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                              palette.iconBoxIdle,
                            )}
                          >
                            {book.purpose === "SALES" ? (
                              <ShoppingCart className="size-4" aria-hidden="true" />
                            ) : (
                              <ShoppingBag className="size-4" aria-hidden="true" />
                            )}
                          </span>
                          <div className="flex flex-col">
                            <IdentifierText className="text-sm font-semibold text-foreground">
                              {book.code}
                            </IdentifierText>
                            <span className="text-xs text-muted-foreground">
                              {`${t.tradeCommon.version} v${book.version}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <IdentifierText className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold">
                            {book.currencyCode}
                          </IdentifierText>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                              palette.badge,
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", palette.dot)} />
                            {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
                          </span>
                        </div>
                      </div>

                      {isDefault && (
                        <div
                          className={cn(
                            "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs",
                            SWATCH_SURFACE_PALETTES.green.sectionCard,
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-foreground">
                            <Star
                              className={cn("size-3.5", SWATCH_SURFACE_PALETTES.green.iconText)}
                              aria-hidden="true"
                            />
                            {t.tradePricing.isCompanyDefault}
                          </span>
                          <IdentifierText className="text-xs text-muted-foreground">
                            {`${book.purpose}/${book.currencyCode}`}
                          </IdentifierText>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t.tradePricing.versions} ({book.versions.length})
                        </span>
                        {book.versions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t.tradePricing.noVersions}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {book.versions.slice(0, 4).map((ver) => (
                              <Link
                                key={ver.id}
                                href={`${TENANT_ROUTES.trade}/price-book-versions/${ver.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                <Badge
                                  tone={
                                    ver.status === "PUBLISHED"
                                      ? "positive"
                                      : ver.status === "TESTED"
                                        ? "brand"
                                        : "neutral"
                                  }
                                >
                                  {`v${ver.versionNumber} · ${tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}`}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setSelectedId(book.id);
                          setViewMode("split");
                        }}
                      >
                        <PanelRightOpen className="size-3.5" aria-hidden="true" />
                        {t.tradePricing.viewSplit}
                      </Button>
                      <div className="flex items-center gap-1.5">
                        {canManageDefaults && !isDefault && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={isDefaultBusy}
                            onClick={() => void setBookAsCompanyDefault(book)}
                          >
                            <Star className="size-3.5" aria-hidden="true" />
                            {t.tradePricing.setAsCompanyDefault}
                          </Button>
                        )}
                        {canManage && (
                          <Button size="xs" variant="primary" onClick={() => openVersion(book)}>
                            <Plus className="size-3.5" aria-hidden="true" />
                            {t.tradePricing.newVersion}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "split" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <DataTable
                  density="compact"
                  columns={columns}
                  rows={items}
                  isLoading={isLoading}
                  error={queryError}
                  onRetry={() => void reload()}
                  page={pageInfo}
                  onPageChange={setPage}
                  rowKey={(book) => book.id}
                  onRowClick={(book) => setSelectedId(book.id)}
                  labels={{
                    retry: t.common.retry,
                    errorTitle: t.tradePricing.booksLoadFailed,
                    emptyTitle: purpose ? t.tradeCommon.emptyForFilter : t.tradePricing.booksEmpty,
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
              </div>
              <div className="lg:col-span-5">{renderInspector(selectedBook)}</div>
            </div>
          ) : (
            <DataTable
              density="compact"
              columns={columns}
              rows={items}
              isLoading={isLoading}
              error={queryError}
              onRetry={() => void reload()}
              page={pageInfo}
              onPageChange={setPage}
              rowKey={(book) => book.id}
              onRowClick={(book) => setSelectedId(book.id)}
              labels={{
                retry: t.common.retry,
                errorTitle: t.tradePricing.booksLoadFailed,
                emptyTitle: purpose ? t.tradeCommon.emptyForFilter : t.tradePricing.booksEmpty,
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
          icon={BookOpen}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}

      <CreatePriceBookModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {versionFor ? (
        <CreateVersionDrawer
          key={`version-${versionFor.id}`}
          bookCode={versionFor.code}
          defaultCurrencyCode={versionFor.currencyCode}
          onClose={closeVersion}
          onSubmit={createVersion}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={PRICING_READ_PERMISSION}>{content}</PermissionGate>
  );
}
