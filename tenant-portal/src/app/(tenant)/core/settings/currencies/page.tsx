"use client";

import { Pencil, RefreshCw, Star, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  CORE_SETTINGS_NAV_ITEMS,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { ActiveStatus } from "../../core-validation";
import type { Currency } from "./currency-contract";
import { CreateCurrencyModal } from "./components/CreateCurrencyModal";
import { DeactivateCurrencyConfirmModal } from "./components/DeactivateCurrencyConfirmModal";
import { EditCurrencyModal } from "./components/EditCurrencyModal";
import { useCurrencies } from "./hooks/useCurrencies";

export default function CurrenciesPage() {
  const {
    t,
    lang,
    canManage,
    items,
    pageInfo,
    statusFilter,
    search,
    isLoading,
    isRefreshing,
    isSubmitting,
    pendingId,
    queryError,
    formError,
    createOpen,
    editing,
    deactivating,
    setPage,
    setStatusFilter,
    setSearch,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    openDeactivate,
    closeDeactivate,
    create,
    update,
    setDefault,
    deactivate,
    reload,
    sort,
    setSort,
  } = useCurrencies();

  const filterValues: FilterValues = statusFilter
    ? { status: { kind: "select", value: statusFilter } }
    : {};

  const columns: ColumnDef<Currency>[] = [
    {
      id: "code",
      sortable: true,
      header: t.coreSettings.currencyCode,
      cell: (currency) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground">{currency.code}</span>
          {currency.isDefault ? <Badge tone="brand">{t.coreSettings.currencyDefault}</Badge> : null}
        </span>
      ),
    },
    { id: "name", sortable: true, header: t.coreSettings.currencyName, cell: (currency) => currency.name },
    {
      id: "symbol",
      header: t.coreSettings.currencySymbol,
      cell: (currency) => currency.symbol ?? "—",
    },
    {
      id: "rate",
      sortable: true,
      header: t.coreSettings.currencyExchangeRate,
      numeric: true,
      // `numeric(18,8)` arrives as an exact string and is formatted, never parsed.
      cell: (currency) =>
        currency.exchangeRate === null
          ? "—"
          : formatDecimalString(currency.exchangeRate, lang, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (currency) => (
        <Badge tone={currency.status === "ACTIVE" ? "positive" : "neutral"}>
          {currency.status === "ACTIVE" ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (currency: Currency) => (
              <span className="flex items-center justify-end gap-1">
                <RowAction
                  label={t.coreSettings.currencyEditTitle}
                  disabled={pendingId !== null}
                  onClick={() => openEdit(currency)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </RowAction>
                {!currency.isDefault && currency.status === "ACTIVE" ? (
                  <RowAction
                    label={t.coreSettings.currencySetDefault}
                    disabled={pendingId !== null}
                    loading={pendingId === currency.id}
                    onClick={() => void setDefault(currency)}
                  >
                    <Star className="size-4" aria-hidden="true" />
                  </RowAction>
                ) : null}
                {!currency.isDefault && currency.status === "ACTIVE" ? (
                  <RowAction
                    label={t.coreSettings.deactivate}
                    disabled={pendingId !== null}
                    onClick={() => openDeactivate(currency)}
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
    <PermissionGate require="currencies.currency.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.coreSettings.currenciesTitle}
          description={t.coreSettings.currenciesSubtitle}
          primaryAction={
            canManage ? { label: t.coreSettings.currencyCreate, onClick: openCreate } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.coreSettings.reload}
            </Button>
          }
        />

        <SubNav items={CORE_SETTINGS_NAV_ITEMS} />

        <FilterBar
          filters={[
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.coreSettings.statusAny,
              options: [
                { value: "ACTIVE", label: t.common.active },
                { value: "INACTIVE", label: t.common.inactive },
              ],
            },
          ]}
          values={filterValues}
          onChange={(next) => {
            const value = next.status;
            setStatusFilter(
              value?.kind === "select" && value.value ? (value.value as ActiveStatus) : undefined,
            );
          }}
          onReset={() => setStatusFilter(undefined)}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.coreSettings.currencySearch}
          clearAllLabel={t.coreSettings.clearFilters}
          filtersLabel={t.common.filter}
        />

        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading}
          error={queryError}
          onRetry={() => void reload()}
          page={pageInfo}
          onPageChange={setPage}
          sort={sort}
          onSortChange={setSort}
          rowKey={(currency) => currency.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.coreSettings.currencyLoadFailed,
            emptyTitle: t.coreSettings.currencyEmpty,
            selectAll: t.common.actions,
            selectRow: t.common.actions,
            sortAscending: t.common.actions,
            sortDescending: t.common.actions,
            notSorted: t.common.actions,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
            },
          }}
        />

        <CreateCurrencyModal
          key={createOpen ? "create-open" : "create-closed"}
          isOpen={createOpen}
          onClose={closeCreate}
          onSubmit={create}
          isSubmitting={isSubmitting}
          error={formError}
        />

        {editing ? (
          <EditCurrencyModal
            key={editing.id}
            currency={editing}
            onClose={closeEdit}
            onSubmit={update}
            isSubmitting={isSubmitting}
            error={formError}
          />
        ) : null}

        <DeactivateCurrencyConfirmModal
          currency={deactivating}
          onClose={closeDeactivate}
          onConfirm={() => void deactivate()}
          isSubmitting={pendingId !== null}
        />
      </div>
    </PermissionGate>
  );
}

function RowAction({
  label,
  disabled,
  loading,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={label} disabled={disabled} loading={loading} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
