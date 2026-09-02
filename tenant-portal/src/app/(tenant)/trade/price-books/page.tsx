"use client";

import Link from "next/link";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
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
    canRead,
    canManage,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
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

  const filterValues: FilterValues = purpose
    ? { purpose: { kind: "select", value: purpose } }
    : {};

  const columns: ColumnDef<PriceBook>[] = [
    { id: "code", header: t.tradePricing.bookCode, cell: (book) => book.code },
    {
      id: "purpose",
      header: t.tradePricing.bookPurpose,
      cell: (book) => tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode),
    },
    { id: "currency", header: t.tradePricing.currencyCode, cell: (book) => book.currencyCode },
    {
      id: "status",
      // `status` on a price book is a free string with no enum in source, so it
      // is rendered as it arrives rather than mapped.
      header: t.common.status,
      cell: (book) => <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, book.status, t.common.unknownCode)}</Badge>,
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
                <Badge tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                  {`v${version.versionNumber} · ${tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}`}
                </Badge>
              </Link>
            ))}
          </span>
        ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (book: PriceBook) => (
              <Button variant="ghost" size="sm" onClick={() => openVersion(book)}>
                <Plus className="size-4" aria-hidden="true" />
                {t.tradePricing.newVersion}
              </Button>
            ),
          },
        ]
      : []),
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
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

      {isScopeResolved ? (
        <>
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
            onReset={() => setPurpose(undefined)}
            searchValue=""
            onSearchChange={() => undefined}
            filtersLabel={t.common.filter}
            clearAllLabel={t.filters.clearAll}
          />

          <DataTable
            columns={columns}
            rows={items}
            isLoading={isLoading}
            error={queryError}
            onRetry={() => void reload()}
            page={pageInfo}
            onPageChange={setPage}
            rowKey={(book) => book.id}
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
          key={versionFor.id}
          bookCode={versionFor.code}
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
