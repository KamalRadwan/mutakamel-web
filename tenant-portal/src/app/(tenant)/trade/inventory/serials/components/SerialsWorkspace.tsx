"use client";

import { Eye, RefreshCw, ScanBarcode } from "lucide-react";
import { Badge, Button, Card, Combobox, DataTable, EmptyState, Field, Input, NameSelect, PageHeader, PermissionGate, ViewSwitcher, type ColumnDef } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../../components/InventoryListPagination";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { SERIAL_STATES, type InventorySerial } from "../../inventory-governance-contract";
import { useInventorySerials } from "../hooks/useInventorySerials";
import { SerialCollection } from "./SerialCollection";
import { SerialLifecycleModal } from "./SerialLifecycleModal";

export function SerialsWorkspace() {
  const vm = useInventorySerials();
  const { t, lang, references, draft } = vm;
  const copy = t.tradeInventory.readViews;
  const columns: ColumnDef<InventorySerial>[] = [
    { id: "serial", header: t.tradeInventory.serialKey, cell: (serial) => <span dir="ltr" className="font-mono text-sm font-medium">{serial.serialKey}</span> },
    { id: "item", header: copy.item, cell: (serial) => <bdi>{references.itemLabel(serial.itemId)}</bdi> },
    { id: "state", header: t.tradeInventory.serialState, cell: (serial) => <Badge tone={serial.state === "ON_HAND" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, serial.state, t.common.unknownCode)}</Badge> },
    { id: "node", header: t.tradeInventory.currentNode, cell: (serial) => <bdi>{serial.currentFulfillmentNodeId ? references.nodeLabel(serial.currentFulfillmentNodeId) : t.tradeInventory.serialNoCustody}</bdi> },
    { id: "unit", header: copy.unit, cell: (serial) => serial.currentUomId ? <bdi>{references.uomLabel(serial.currentUomId)}</bdi> : t.tradeInventory.readViews.notSet },
    { id: "transition", header: t.tradeInventory.lastTransitionAt, cell: (serial) => <span className="tabular-nums">{formatDateTime(serial.lastTransitionAt, lang)}</span> },
    { id: "actions", header: t.common.actions, align: "end", cell: (serial) => <Button variant="outline" size="xs" onClick={() => vm.openSerial(serial.id)}><Eye className="size-3.5" aria-hidden="true" />{copy.viewLifecycle}</Button> },
  ];
  const tableLabels = {
    retry: t.common.retry, errorTitle: t.tradeInventory.serialsLoadFailed,
    emptyTitle: vm.filters.itemId || vm.filters.serialKey || vm.filters.state || vm.filters.profileId ? t.tradeCommon.emptyForFilter : t.tradeInventory.serialsEmpty,
    selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
    pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from: number, to: number, total: number) => formatTemplate(t.common.showingOf, { from, to, total }) },
  };
  return <div className="flex min-w-0 flex-col gap-4">
    <InventoryModuleSubnav active="serials" />
    <PageHeader title={t.tradeInventory.serialsTitle} headingRef={vm.headingRef} description={t.tradeInventory.serialsSubtitle} secondaryActions={<>
      <TenantBranchSelect branchIds={vm.branchIds} branchId={vm.branchId} onChange={vm.selectBranch} disabled={vm.isRefreshing} />
      <Button variant="outline" size="sm" onClick={() => void vm.reload()} loading={vm.isRefreshing}><RefreshCw className="size-4" aria-hidden="true" />{t.tradeCommon.reload}</Button>
    </>} />
    {vm.isScopeResolved ? <PermissionGate require={vm.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!vm.canRead || vm.queryError?.status === 403}>
      <Card className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={copy.exactSerial} showLabel error={vm.validationError ?? undefined} hint={copy.exactSerialHint}><Input value={draft.serialKey} maxLength={120} onChange={(event) => vm.setFilter("serialKey", event.target.value)} /></Field>
          <Field label={copy.item} showLabel><Combobox value={draft.itemId || undefined} selectedLabel={draft.itemId ? references.itemLabel(draft.itemId) : undefined}
            options={references.items.map((item) => ({ value: item.id, label: item.name, description: item.code }))} onSearch={references.searchItems}
            onValueChange={(value) => vm.setFilter("itemId", value ?? "")} placeholder={copy.allItems} searchPlaceholder={t.common.search}
            loadingLabel={t.common.loading} emptyLabel={t.common.noData} loading={references.isLoading} disabled={!references.canCatalog}
            errorContent={references.itemError ? <div role="alert" className="flex flex-col gap-2"><span className="text-sm text-destructive">{copy.namesUnavailable}</span><Button variant="outline" size="sm" onClick={references.refresh}>{t.common.retry}</Button></div> : undefined} clearLabel={copy.clear} /></Field>
          <Field label={copy.itemProfile} showLabel><Combobox value={draft.profileId || undefined} selectedLabel={draft.profileId ? references.profileLabel(draft.profileId) : undefined}
            options={references.items.flatMap((item) => item.profileId && (!draft.itemId || item.id === draft.itemId) ? [{ value: item.profileId, label: item.name, description: item.code }] : [])}
            onSearch={references.searchItems} onValueChange={(value) => vm.setFilter("profileId", value ?? "")} placeholder={copy.allProfiles}
            searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.common.noData} loading={references.isLoading} disabled={!references.canCatalog}
            errorContent={references.itemError ? <div role="alert" className="flex flex-col gap-2"><span className="text-sm text-destructive">{copy.namesUnavailable}</span><Button variant="outline" size="sm" onClick={references.refresh}>{t.common.retry}</Button></div> : undefined} clearLabel={copy.clear} /></Field>
          <Field label={t.tradeInventory.serialState} showLabel><NameSelect value={draft.state ?? "ALL"}
            options={[{ value: "ALL", label: copy.allStates }, ...SERIAL_STATES.map((state) => ({ value: state, label: tradeStatusLabel(t.tradeStatus, state, t.common.unknownCode) }))]}
            onValueChange={(value) => vm.setFilter("state", SERIAL_STATES.find((state) => state === value))} placeholder={copy.allStates} /></Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={vm.applyFilters} disabled={vm.isRefreshing}>{copy.apply}</Button><Button variant="ghost" size="sm" onClick={vm.clearFilters}>{copy.clear}</Button></div>
          <ViewSwitcher value={vm.view} onChange={vm.setView} available={["table", "card", "board"]} labels={{ table: t.tradeInventory.tableView, card: t.tradeInventory.serialCards, board: t.tradeInventory.serialBoard }} />
        </div>
        {!references.canCatalog && <p className="text-sm text-muted-foreground">{copy.namesPermissionHint}</p>}
      </Card>
      {vm.isStale ? <Card role="status" className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="space-y-1"><Badge tone="caution">{copy.staleResults}</Badge><p className="text-sm text-muted-foreground">{vm.errorMessage}</p></div><Button variant="outline" size="sm" onClick={() => void vm.reload()} loading={vm.isRefreshing}>{t.common.retry}</Button></Card> : null}
      {vm.view === "table" ? <DataTable columns={columns} rows={vm.items} rowKey={(serial) => serial.id} onRowClick={(serial) => vm.openSerial(serial.id)}
        isLoading={vm.isLoading} error={vm.isStale ? null : vm.queryError} onRetry={() => void vm.reload()} labels={tableLabels} showRowNumbers={false} />
        : <SerialCollection view={vm.view} vm={vm} />}
      <InventoryListPagination page={vm.pagination} onPageChange={vm.setPage} isRefreshing={vm.isRefreshing} />
    </PermissionGate> : <EmptyState icon={ScanBarcode} title={t.tradeInventory.selectCompanyFirst} description={t.tradeInventory.selectCompanyFirstDescription} />}
    {vm.detailId && <SerialLifecycleModal id={vm.detailId} onClose={vm.closeSerial} onRestoreFocus={vm.restoreFocus} />}
  </div>;
}
