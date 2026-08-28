"use client";

import { FormInput, RefreshCw } from "lucide-react";
import { Badge, Button, DataTable, FilterBar, PageHeader, SubNav, NAV_SECTIONS, type ColumnDef } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { CreateCrmCustomFieldsModal } from "./components/CreateCrmCustomFieldsModal";
import { type CustomFieldItem, useCrmCustomFields } from "./hooks/useCrmCustomFields";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function CrmCustomFieldsPage() {
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    error,
    createError,
    canManage,
    isCreateOpen,
    openCreate,
    closeCreate,
    handleCreate,
    reload,
  } = useCrmCustomFields();

  const canCreate = canManage && !isLoading && !error;

  const columns: ColumnDef<CustomFieldItem>[] = [
    {
      id: "name",
      header: t.crmLeadStages.arabicName,
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
            <FormInput className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          </span>
          <div>
            <p dir="rtl" className="font-medium text-foreground">
              {item.nameAr}
            </p>
            <code className="font-mono text-2xs text-muted-foreground">{item.fieldKey}</code>
          </div>
        </div>
      ),
    },
    {
      id: "nameEn",
      header: t.crmLeadStages.englishName,
      cell: (item) => <span dir="ltr">{item.nameEn}</span>,
    },
    {
      id: "owner",
      header: t.crmCustomFields.owner,
      cell: (item) => <Badge tone="neutral">{t.crmCustomFields.ownerTypes[item.ownerType] ?? item.ownerType}</Badge>,
    },
    {
      id: "fieldType",
      header: t.crmCustomFields.fieldType,
      cell: (item) => <Badge tone="neutral">{t.crmCustomFields.fieldTypes[item.type] ?? item.type}</Badge>,
    },
    {
      id: "properties",
      header: t.crmCustomFields.properties,
      cell: (item) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={item.isActive ? "positive" : "neutral"}>{item.isActive ? t.common.active : t.common.inactive}</Badge>
          {item.isSearchable && <Badge tone="caution">{t.crmCustomFields.searchable}</Badge>}
          {item.optionsCount > 0 && <Badge tone="neutral">{t.crmCustomFields.optionsCount(item.optionsCount)}</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.crm.cRMFormCustomFieldsCustom}
        description={t.crmCustomFields.subtitle}
        primaryAction={canCreate ? { label: t.crm.addACustomField, onClick: openCreate } : undefined}
        secondaryActions={
          <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            {t.crmCustomFields.reload}
          </Button>
        }
      />

      <SubNav items={CRM_SETUP_ITEMS} />

      {error && (
        <div role="alert" className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
          {error}
        </div>
      )}

      {createError && !isCreateOpen ? (
        <div role="alert" className="rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
          {createError}
        </div>
      ) : null}

      <FilterBar
        filters={[]}
        values={{}}
        onChange={() => undefined}
        onReset={() => undefined}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t.crmCustomFields.search}
      />

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={null}
        page={{ page: 1, limit: Math.max(items.length, 1), total: items.length }}
        onPageChange={() => undefined}
        rowKey={(item) => item.id}
        labels={{
          retry: t.common.retry,
          errorTitle: "",
          emptyTitle: t.crmCustomFields.empty,
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

      <CreateCrmCustomFieldsModal
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        isSubmitting={isCreating}
        error={createError}
        onClose={closeCreate}
        onSubmit={handleCreate}
      />
    </div>
  );
}
