"use client";

import { Pencil, RefreshCw } from "lucide-react";
import {
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
import { formatTemplate } from "@/lib/format/template";
import { companyLabel } from "../company-options";
import { formatNumberingValue, type NumberingSequence } from "./numbering-contract";
import { CreateNumberingSequenceModal } from "./components/CreateNumberingSequenceModal";
import { EditNumberingSequenceModal } from "./components/EditNumberingSequenceModal";
import { useNumberingSequences } from "./hooks/useNumberingSequences";

export default function NumberingPage() {
  const {
    t,
    canManage,
    companies,
    items,
    pageInfo,
    companyFilter,
    search,
    isLoading,
    isRefreshing,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    editing,
    setPage,
    setCompanyFilter,
    setSearch,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    create,
    update,
    reload,
  } = useNumberingSequences();

  const filterValues: FilterValues = companyFilter
    ? { companyId: { kind: "select", value: companyFilter } }
    : {};

  const columns: ColumnDef<NumberingSequence>[] = [
    {
      id: "code",
      header: t.coreSettings.numberingCode,
      cell: (sequence) => <span className="font-medium text-foreground">{sequence.code}</span>,
    },
    {
      id: "scope",
      header: t.coreSettings.numberingScope,
      cell: (sequence) =>
        companyLabel(companies, sequence.companyId, t.coreSettings.numberingTenantWide),
    },
    {
      id: "next",
      header: t.coreSettings.numberingNextNumber,
      // The counter is a bigint string; `formatNumberingValue` pads text and
      // never converts it to a number.
      cell: (sequence) => (
        <span className="font-mono text-foreground">
          {formatNumberingValue(sequence.prefix ?? "", sequence.padding, sequence.nextValue)}
        </span>
      ),
    },
    {
      id: "value",
      header: t.coreSettings.numberingNextValue,
      align: "end",
      cell: (sequence) => <span className="font-mono">{sequence.nextValue}</span>,
    },
    {
      id: "padding",
      header: t.coreSettings.numberingPadding,
      numeric: true,
      cell: (sequence) => sequence.padding,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (sequence: NumberingSequence) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.coreSettings.numberingEditTitle}
                    onClick={() => openEdit(sequence)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.coreSettings.numberingEditTitle}</TooltipContent>
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  return (
    <PermissionGate require="numbering.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.coreSettings.numberingTitle}
          description={t.coreSettings.numberingSubtitle}
          primaryAction={
            canManage ? { label: t.coreSettings.numberingCreate, onClick: openCreate } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
              {t.coreSettings.reload}
            </Button>
          }
        />

        <SubNav items={CORE_SETTINGS_NAV_ITEMS} />

        <FilterBar
          filters={
            companies.length > 0
              ? [
                  {
                    id: "companyId",
                    kind: "select" as const,
                    label: t.coreSettings.numberingScope,
                    placeholder: t.coreSettings.taxScopeAny,
                    options: companies.map((company) => ({
                      value: company.id,
                      label: company.name,
                    })),
                  },
                ]
              : []
          }
          values={filterValues}
          onChange={(next) => {
            const company = next.companyId;
            setCompanyFilter(company?.kind === "select" && company.value ? company.value : undefined);
          }}
          onReset={() => setCompanyFilter(undefined)}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.coreSettings.numberingSearch}
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
          rowKey={(sequence) => sequence.id}
          labels={{
            retry: t.common.retry,
            errorTitle: t.coreSettings.numberingLoadFailed,
            emptyTitle: t.coreSettings.numberingEmpty,
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

        <CreateNumberingSequenceModal
          key={createOpen ? "create-open" : "create-closed"}
          isOpen={createOpen}
          companies={companies}
          onClose={closeCreate}
          onSubmit={create}
          isSubmitting={isSubmitting}
          error={formError}
        />

        {editing ? (
          <EditNumberingSequenceModal
            key={editing.id}
            sequence={editing}
            companies={companies}
            onClose={closeEdit}
            onSubmit={update}
            isSubmitting={isSubmitting}
            error={formError}
          />
        ) : null}
      </div>
    </PermissionGate>
  );
}
