"use client";

import { Pencil, RefreshCw, XCircle } from "lucide-react";
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
import { companyLabel } from "../company-options";
import type { Tax } from "./tax-contract";
import { CreateTaxModal } from "./components/CreateTaxModal";
import { DeactivateTaxConfirmModal } from "./components/DeactivateTaxConfirmModal";
import { EditTaxModal } from "./components/EditTaxModal";
import { useTaxes } from "./hooks/useTaxes";

export default function TaxesPage() {
  const {
    t,
    lang,
    canManage,
    companies,
    items,
    pageInfo,
    statusFilter,
    companyFilter,
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
    setCompanyFilter,
    setSearch,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    openDeactivate,
    closeDeactivate,
    create,
    update,
    deactivate,
    reload,
    sort,
    setSort,
  } = useTaxes();

  const filterValues: FilterValues = {
    ...(statusFilter ? { status: { kind: "select" as const, value: statusFilter } } : {}),
    ...(companyFilter ? { companyId: { kind: "select" as const, value: companyFilter } } : {}),
  };

  const columns: ColumnDef<Tax>[] = [
    {
      id: "code",
      sortable: true,
      header: t.coreSettings.taxCode,
      cell: (tax) => <span className="font-medium text-foreground">{tax.code}</span>,
    },
    { id: "name", sortable: true, header: t.coreSettings.taxName, cell: (tax) => tax.name },
    {
      id: "scope",
      header: t.coreSettings.taxScope,
      cell: (tax) => companyLabel(companies, tax.companyId, t.coreSettings.taxTenantWide),
    },
    {
      id: "rate",
      sortable: true,
      header: t.coreSettings.taxRate,
      numeric: true,
      // `numeric(7,4)` arrives as an exact string and is already a percentage
      // value (0–100), so `style: "percent"` would multiply it by 100 again.
      // The unit sign comes from the dictionary, not from a literal.
      cell: (tax) =>
        formatTemplate(t.coreSettings.taxRateValue, {
          rate: formatDecimalString(tax.rate, lang, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          }),
        }),
    },
    {
      id: "inclusive",
      header: t.coreSettings.taxInclusive,
      cell: (tax) => (
        <Badge tone="neutral">
          {tax.isInclusive ? t.coreSettings.taxInclusiveYes : t.coreSettings.taxInclusiveNo}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (tax) => (
        <Badge tone={tax.status === "ACTIVE" ? "positive" : "neutral"}>
          {tax.status === "ACTIVE" ? t.common.active : t.common.inactive}
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
            cell: (tax: Tax) => (
              <span className="flex items-center justify-end gap-1">
                <RowAction
                  label={t.coreSettings.taxEditTitle}
                  disabled={pendingId !== null}
                  onClick={() => openEdit(tax)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </RowAction>
                {tax.status === "ACTIVE" ? (
                  <RowAction
                    label={t.coreSettings.deactivate}
                    disabled={pendingId !== null}
                    onClick={() => openDeactivate(tax)}
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
    <PermissionGate require="taxes.tax.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.coreSettings.taxesTitle}
          description={t.coreSettings.taxesSubtitle}
          primaryAction={canManage ? { label: t.coreSettings.taxCreate, onClick: openCreate } : undefined}
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
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
            ...(companies.length > 0
              ? [
                  {
                    id: "companyId",
                    kind: "select" as const,
                    label: t.coreSettings.taxScope,
                    placeholder: t.coreSettings.taxScopeAny,
                    options: companies.map((company) => ({
                      value: company.id,
                      label: company.name,
                    })),
                  },
                ]
              : []),
          ]}
          values={filterValues}
          onChange={(next) => {
            const status = next.status;
            const company = next.companyId;
            setStatusFilter(
              status?.kind === "select" && status.value ? (status.value as ActiveStatus) : undefined,
            );
            setCompanyFilter(company?.kind === "select" && company.value ? company.value : undefined);
          }}
          onReset={() => {
            setStatusFilter(undefined);
            setCompanyFilter(undefined);
          }}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.coreSettings.taxSearch}
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
          rowKey={(tax) => tax.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.coreSettings.taxLoadFailed,
            emptyTitle: t.coreSettings.taxEmpty,
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

        <CreateTaxModal
          key={createOpen ? "create-open" : "create-closed"}
          isOpen={createOpen}
          companies={companies}
          onClose={closeCreate}
          onSubmit={create}
          isSubmitting={isSubmitting}
          error={formError}
        />

        {editing ? (
          <EditTaxModal
            key={editing.id}
            tax={editing}
            companies={companies}
            onClose={closeEdit}
            onSubmit={update}
            isSubmitting={isSubmitting}
            error={formError}
          />
        ) : null}

        <DeactivateTaxConfirmModal
          tax={deactivating}
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
