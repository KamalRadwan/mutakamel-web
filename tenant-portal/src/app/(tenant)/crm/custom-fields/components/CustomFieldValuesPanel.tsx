"use client";

import { Info, RefreshCw } from "lucide-react";
import { Badge, Button, Combobox, DegradedBanner, EmptyState, ErrorState, Field, PermissionGate,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { CRM_RECORD_SOURCE_TYPES, type CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import type { useCustomFieldRecordValues } from "../hooks/useCustomFieldRecordValues";
import { CustomFieldValueRow } from "./CustomFieldValueRow";

export type CustomFieldRecordValuesState = ReturnType<typeof useCustomFieldRecordValues>;

export function CustomFieldValuesPanel({ state }: { state: CustomFieldRecordValuesState }) {
  const { t, values } = state;
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-3">
      <div className="flex min-w-40 flex-col gap-1.5">
        <span className="text-xs font-medium">{t.common.branch}</span>
        {state.branchIds.length < 2 ? <span className="min-h-7 text-sm">{state.branchLabel}</span> :
          <TenantBranchSelect branchIds={state.branchIds} branchId={state.branchId}
            disabled={values.isSaving} onChange={state.changeBranch} />}
      </div>
      <Field label={t.crmCustomFields.owner} showLabel className="min-w-40">
        <Select value={state.ownerType} disabled={values.isSaving}
          onValueChange={(next) => state.selectType(next as CrmRecordSourceType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CRM_RECORD_SOURCE_TYPES.map((type) =>
            <SelectItem key={type} value={type}>{t.crmCustomFields.ownerTypes[type]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={t.crmCustomFields.ownerRecord} showLabel className="min-w-48 flex-1">
        <Combobox value={state.ownerId} selectedLabel={state.ownerLabel} onValueChange={state.selectOwner}
          disabled={!state.branchId || values.isSaving} options={state.records.options} onSearch={state.records.search}
          loading={state.records.isLoading} placeholder={t.crmCustomFields.ownerRecordPlaceholder}
          searchPlaceholder={t.common.search} loadingLabel={t.common.loading}
          emptyLabel={state.records.error ? t.crmCustomFields.ownerRecordsUnavailable : t.crmCustomFields.ownerRecordsEmpty}
          clearLabel={t.common.dismiss} />
      </Field>
    </div>
    <div className="flex flex-col gap-3 p-3">
      {state.records.error?.status === 403 ? <PermissionGate require="crm.custom_fields.read" denied><span /></PermissionGate> :
        state.records.error ? <div className="flex flex-wrap items-center gap-2">
          <DegradedBanner message={t.crmCustomFields.ownerRecordsUnavailable} />
          <Button variant="outline" size="sm" onClick={() => state.records.search("")}>{t.crmCustomFields.recordListRetry}</Button>
        </div> : null}
      {state.notice ? <DegradedBanner message={state.notice} /> : null}
      {state.records.error?.status === 403 ? null : !state.branchId ? <EmptyState title={t.crmCustomFields.branchRequiredTitle} description={t.crmCustomFields.branchRequiredDescription} /> :
        !state.ownerId ? <EmptyState title={t.crmCustomFields.pickOwnerTitle} description={t.crmCustomFields.pickOwnerDescription} /> :
          values.loadError?.status === 403 || state.access.error?.status === 403 ?
            <PermissionGate require="crm.custom_fields.read" denied><span /></PermissionGate> :
            values.loadError ? <ErrorState title={t.crmCustomFields.valuesLoadFailed} description={t.crmCustomFields.valuesLoadFailedHint}
              retryLabel={t.common.retry} onRetry={state.reload} /> :
              values.isLoading ? <div aria-busy="true" className="flex flex-col gap-3">
                <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div> :
                state.applicable.length === 0 ? <EmptyState title={t.crmCustomFields.noApplicableTitle} description={t.crmCustomFields.noApplicableDescription} /> :
                  <>
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{state.ownerLabel}</h2>
                        <Badge tone="neutral">{t.crmCustomFields.ownerTypes[state.ownerType]}</Badge>
                        <span className="text-xs text-muted-foreground">{state.branchLabel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.crmCustomFields.valuesDescription}</p>
                    </header>
                    {state.access.isLoading ? <p role="status" className="text-xs text-muted-foreground">{t.crmCustomFields.valueAccessLoading}</p> :
                      state.access.error ? <div className="flex flex-wrap items-center gap-2">
                        <DegradedBanner message={t.crmCustomFields.valueAccessUnavailable} />
                        <Button size="sm" variant="outline" onClick={state.access.retry}>
                          <RefreshCw className="size-3.5" aria-hidden="true" />{t.crmCustomFields.valueAccessRetry}</Button>
                      </div> : !state.canEdit ? <p className="text-xs text-muted-foreground">
                        {state.access.converted ? t.crmCustomFields.valueErrors.LEAD_ALREADY_CONVERTED : t.crmCustomFields.valueAccessDenied}
                      </p> : null}
                    {state.isDirty && <p role="status"><Badge tone="caution">{t.crmCustomFields.valuesUnsaved}</Badge></p>}
                    <ul className="divide-y divide-border">
                      {state.applicable.map((field) => <CustomFieldValueRow key={field.id} field={field} state={state} />)}
                    </ul>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Info className="size-3.5" aria-hidden="true" />{t.crmCustomFields.valuesNotAutosaved}</p>
                  </>}
    </div>
  </section>;
}
