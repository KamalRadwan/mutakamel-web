"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calculator,
  Plus,
} from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGate,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  PRICING_READ_PERMISSION,
  type PriceBookPurpose,
} from "./pricing-contract";
import { CompanyDefaultsStrip } from "./components/CompanyDefaultsStrip";
import { CreatePriceBookModal } from "./components/CreatePriceBookModal";
import { PriceBookBoardView } from "./components/PriceBookBoardView";
import { PriceBookCardView } from "./components/PriceBookCardView";
import { PriceBookTableView } from "./components/PriceBookTableView";
import { usePriceBooks } from "./hooks/usePriceBooks";
import { PriceBookToolbar } from "./components/PriceBookToolbar";

export default function PriceBooksPage() {
  const router = useRouter();
  const [slotPreset, setSlotPreset] = useState<{
    purpose: PriceBookPurpose;
    currencyCode: string;
  } | null>(null);
  const {
    t,
    canRead,
    canManage,
    canManageDefaults,
    isScopeResolved,
    items,
    allItems,
    viewMode,
    setViewMode,
    search,
    setSearch,
    purpose,
    setPurpose,
    governanceFilter,
    setGovernanceFilter,
    onlyDefaults,
    setOnlyDefaults,
    defaultMappings,
    isDefaultBusy,
    isBookDefault,
    setBookAsCompanyDefault,
    removeBookCompanyDefault,
    updateBook,
    selectedIds,
    toggleSelectRow,
    toggleSelectAll,
    clearSelection,
    bulkSetStatus,
    exportSelectedCsv,
    pageInfo,
    setPage,
    isLoading,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    openCreate,
    closeCreate,
    create,
    reload,
  } = usePriceBooks();

  const content = (
    <div
      className={cn(
        "flex flex-col gap-3",
        viewMode === "board" && "h-full min-h-0",
      )}
    >
      <PageHeader
        className="sr-only"
        title={t.tradePricing.booksTitle}
        description={t.tradePricing.booksSubtitle}
        primaryAction={canManage ? {
          label: t.tradePricing.bookCreate,
          icon: <Plus className="size-4" aria-hidden="true" />,
          size: "sm",
          onClick: () => {
            setSlotPreset(null);
            openCreate();
          },
        } : undefined}
        secondaryActions={
          <Tooltip>
            <TooltipTrigger asChild>
            <Button asChild size="sm" variant="outline" className="size-8 p-0">
              <Link href={TENANT_ROUTES.tradePricing} aria-label={t.tradePricing.simulatorShort}>
                <Calculator className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            </TooltipTrigger>
            <TooltipContent>{t.tradePricing.simulatorShort}</TooltipContent>
          </Tooltip>
        }
      />

      <PriceBookToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        search={search}
        setSearch={setSearch}
        purpose={purpose}
        setPurpose={setPurpose}
        governanceFilter={governanceFilter}
        setGovernanceFilter={setGovernanceFilter}
        setOnlyDefaults={setOnlyDefaults}
      />

      {isScopeResolved ? (
        <>
          {/* Dark Ocean Navy 4-Slot Company Defaults Matrix on Bento Cards View (Mockup 02) */}
          {viewMode === "cards" ? (
            <CompanyDefaultsStrip
              defaultMappings={defaultMappings}
              items={allItems}
              canManageDefaults={canManageDefaults}
              isBusy={isDefaultBusy}
              onSetDefault={setBookAsCompanyDefault}
              onRemoveDefault={removeBookCompanyDefault}
              onCreateForSlot={(slotPurpose, slotCurrency) => {
                setSlotPreset({ purpose: slotPurpose, currencyCode: slotCurrency });
                openCreate();
              }}
            />
          ) : null}

          {isLoading ? (
            <Skeleton className="h-80" />
          ) : queryError ? (
            <ErrorState
              title={t.tradePricing.booksLoadFailed}
              description={queryError.message}
              onRetry={() => void reload()}
              retryLabel={t.common.retry}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={
                purpose || governanceFilter || onlyDefaults || search.trim()
                  ? t.tradeCommon.emptyForFilter
                  : t.tradePricing.booksEmpty
              }
              description={t.tradePricing.booksSubtitle}
              action={
                canManage ? { label: t.tradePricing.bookCreate, onClick: openCreate } : undefined
              }
            />
          ) : viewMode === "board" ? (
            <div className="min-h-0 flex-1">
              <PriceBookBoardView
                items={items}
                canManage={canManage}
                canManageDefaults={canManageDefaults}
                isDefaultBusy={isDefaultBusy}
                isBookDefault={isBookDefault}
                onSetDefault={setBookAsCompanyDefault}
                onRemoveDefault={removeBookCompanyDefault}
                onToggleStatus={(book, nextStatus) => updateBook(book, { status: nextStatus })}
                onOpenCreate={openCreate}
                onManageDefaults={() => setViewMode("cards")}
              />
            </div>
          ) : viewMode === "cards" ? (
            <PriceBookCardView
              items={items}
              canManageDefaults={canManageDefaults}
              isDefaultBusy={isDefaultBusy}
              isBookDefault={isBookDefault}
              onSetDefault={setBookAsCompanyDefault}
            />
          ) : (
            <PriceBookTableView
              items={items}
              pageInfo={pageInfo}
              onPageChange={setPage}
              canManage={canManage}
              canManageDefaults={canManageDefaults}
              isDefaultBusy={isDefaultBusy}
              isBookDefault={isBookDefault}
              onSetDefault={setBookAsCompanyDefault}
              onUpdateBook={updateBook}
              selectedIds={selectedIds}
              onToggleRow={toggleSelectRow}
              onToggleAll={toggleSelectAll}
              onClearSelection={clearSelection}
              onBulkStatus={bulkSetStatus}
              onExportCsv={exportSelectedCsv}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={t.tradePricing.selectCompanyTitle}
          description={t.tradePricing.selectCompanyDescription}
        />
      )}

      <CreatePriceBookModal
        key={
          createOpen
            ? `create-open-${slotPreset?.purpose ?? "default"}-${slotPreset?.currencyCode ?? "EGP"}`
            : "create-closed"
        }
        isOpen={createOpen}
        onClose={() => {
          setSlotPreset(null);
          closeCreate();
        }}
        isSubmitting={isSubmitting}
        error={formError}
        existingBooks={allItems}
        canManageDefaults={canManageDefaults}
        initialPurpose={slotPreset?.purpose}
        initialCurrencyCode={slotPreset?.currencyCode}
        initialSetDefault={Boolean(slotPreset)}
        onSubmit={async (values) => {
          const createdId = await create(values);
          if (createdId && createdId !== "created") {
            router.push(`${TENANT_ROUTES.tradePriceBooks}/${createdId}`);
          }
          return Boolean(createdId);
        }}
      />
    </div>
  );

  return !isScopeResolved || canRead ? (
    content
  ) : (
    <PermissionGate require={PRICING_READ_PERMISSION}>{content}</PermissionGate>
  );
}
