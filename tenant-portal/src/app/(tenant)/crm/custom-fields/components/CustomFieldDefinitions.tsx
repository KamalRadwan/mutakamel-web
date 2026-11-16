"use client";

import { FormInput, Info } from "lucide-react";
import { DataTable, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { useI18n } from "@/i18n/I18nContext";
import { CRM_CUSTOM_FIELD_OWNER_TYPES, CRM_CUSTOM_FIELDS_LIMIT } from "../custom-field-contract";
import type { CustomFieldOwnerFilter, CustomFieldStatusFilter, useCustomFieldsPage } from "../hooks/useCustomFieldsPage";
import { useCustomFieldColumns } from "./useCustomFieldColumns";

export function CustomFieldDefinitions({ screen }: { screen: ReturnType<typeof useCustomFieldsPage> }) {
  const { t, lang } = useI18n();
  const columns = useCustomFieldColumns({ canManage: screen.canManage,
    busy: screen.busy || screen.isLoading || !!screen.error || screen.needsReload,
    edit: screen.editor.select, requirements: screen.requirements.select });
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    {screen.definitions.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
      <Select value={screen.ownerFilter} onValueChange={(value) => screen.setOwnerFilter(value as CustomFieldOwnerFilter)}>
        <SelectTrigger className="w-48" aria-label={t.crmCustomFields.owner}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{t.crmCustomFields.allRecordTypes}</SelectItem>
          {[...CRM_CUSTOM_FIELD_OWNER_TYPES, "LEAD_AND_PARTY"].map((type) =>
            <SelectItem key={type} value={type}>{t.crmCustomFields.ownerTypes[type]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={screen.statusFilter} onValueChange={(value) => screen.setStatusFilter(value as CustomFieldStatusFilter)}>
        <SelectTrigger className="w-40" aria-label={t.common.status}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="ALL">{t.crmCustomFields.allStatuses}</SelectItem>
          <SelectItem value="ACTIVE">{t.common.active}</SelectItem><SelectItem value="INACTIVE">{t.common.inactive}</SelectItem>
        </SelectContent>
      </Select>
      <span className="ms-auto text-xs text-muted-foreground">
        {formatTemplate(t.crmCustomFields.fieldCount, { count: formatNumber(screen.items.length, lang) })}
      </span>
    </div>}
    <DataTable surface="embedded" columns={columns} rows={screen.items}
      isLoading={screen.isLoading && !screen.hasLoaded} error={screen.hasLoaded ? null : screen.error}
      onRetry={() => void screen.reload()} rowKey={(item) => item.id} showRowNumbers={false}
      emptyState={<EmptyState icon={FormInput} title={screen.filtered ? t.crmCustomFields.empty : t.crmCustomFields.catalogueEmpty}
        description={screen.filtered ? t.crmCustomFields.noMatchHint : t.crmCustomFields.catalogueEmptyHint}
        action={screen.filtered ? { label: t.crmCustomFields.resetFilters, onClick: screen.resetFilters } :
          screen.canCreate ? { label: t.crmCustomFields.addTitle, onClick: screen.openCreate } : undefined} />}
      labels={{ retry: t.common.retry, errorTitle: t.crmCustomFields.loadFailed, emptyTitle: t.crmCustomFields.empty,
        selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending,
        sortDescending: t.views.sortDescending, notSorted: t.views.notSorted, pagination: { previous: t.common.previousPage,
          next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />
    {screen.hasLoaded && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><Info className="size-3.5 shrink-0" aria-hidden="true" />{t.crmCustomFields.sharedDefinitions}</span>
      <span>{formatTemplate(t.crmCustomFields.catalogueCount, {
        count: formatNumber(screen.definitions.length, lang), limit: formatNumber(CRM_CUSTOM_FIELDS_LIMIT, lang) })}</span>
    </footer>}
  </section>;
}

