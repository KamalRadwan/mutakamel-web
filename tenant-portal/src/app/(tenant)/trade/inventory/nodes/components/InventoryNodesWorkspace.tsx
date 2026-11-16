"use client";
import { Eye, LayoutGrid, List, RefreshCw, Warehouse } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, IdentifierText, Input, NameSelect,
  PageHeader, PermissionGate, type ColumnDef } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../../components/InventoryModuleSubnav";
import { INVENTORY_READ_PERMISSION, NODE_TYPES, type InventoryNode } from "../../inventory-contract";
import { inventoryMessage } from "../../inventory-messages";
import { useInventoryNodes } from "../hooks/useInventoryNodes";
import { useInventoryNodesView } from "../hooks/useInventoryNodesView";
import { CreateNodeModal } from "./CreateNodeModal";
import { NodeDetailsModal } from "./NodeDetailsModal";

export function InventoryNodesWorkspace() {
  const model = useInventoryNodes();
  const view = useInventoryNodesView(model.items, model.scopeIdentity);
  const { t, lang } = model;
  const inv = t.tradeInventory;
  const loadError = model.queryError ? { ...model.queryError, message: inventoryMessage(model.queryError, t) ?? inv.nodesLoadFailed } : null;
  const columns: ColumnDef<InventoryNode>[] = [
    { id: "name", header: inv.nodeName, cell: (node) => <div className="flex flex-col gap-1">
      <Button variant="ghost" className="h-auto justify-start p-0 font-medium hover:underline" onClick={() => view.openNode(node.id)}>{node.name}</Button>
      <IdentifierText className="text-caption text-muted-foreground">{node.code}</IdentifierText></div> },
    { id: "type", header: inv.nodeType, cell: (node) => <span>{tradeStatusLabel(t.tradeStatus, node.nodeType, t.common.unknownCode)}</span> },
    { id: "status", header: t.common.status, cell: (node) => <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, node.status, t.common.unknownCode)}</Badge> },
    { id: "timezone", header: inv.nodeTimezone, cell: (node) => <bdi>{node.timezone}</bdi> },
    { id: "updated", header: t.tradeCommon.updatedAt, cell: (node) => formatDateTime(node.updatedAt, lang) },
    { id: "actions", header: t.common.actions, cell: (node) => <Button variant="outline" size="sm" onClick={() => view.openNode(node.id)}>
      <Eye className="size-4" aria-hidden="true" />{inv.nodeDetailTitle}</Button> },
  ];
  const content = <div className="flex flex-col gap-4">
    <InventoryModuleSubnav active="nodes" />
    <PageHeader headingRef={view.headingRef} title={inv.nodesTitle} description={inv.nodesSubtitle}
      primaryAction={model.canManage ? { label: inv.nodeCreate, onClick: model.openCreate } : undefined}
      secondaryActions={<TenantBranchSelect branchIds={model.branchIds} branchId={model.branchId} onChange={model.selectBranch} disabled={model.isRefreshing} />} />

    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <Field showLabel label={inv.filterLoadedNodes} className="min-w-56 flex-1"><Input value={view.search} onChange={(event) => view.setSearch(event.target.value)} /></Field>
      <Field showLabel label={inv.nodeType} className="min-w-40"><NameSelect value={view.type} onValueChange={view.setType} placeholder={inv.nodeType}
        options={[{ value: "ALL", label: inv.filterAll }, ...NODE_TYPES.map((value) => ({ value, label: t.tradeStatus[value] }))]} /></Field>
      <Field showLabel label={t.common.status} className="min-w-40"><NameSelect value={view.status} onValueChange={view.setStatus} placeholder={t.common.status}
        options={[{ value: "ALL", label: inv.filterAll }, { value: "ACTIVE", label: t.tradeStatus.ACTIVE }, { value: "INACTIVE", label: t.tradeStatus.INACTIVE }]} /></Field>
      <Button variant="outline" onClick={() => void model.reload()} disabled={model.isRefreshing}><RefreshCw className={model.isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />{t.tradeCommon.reload}</Button>
      <div className="flex gap-1"><Button variant={view.view === "table" ? "secondary" : "outline"} aria-pressed={view.view === "table"} onClick={() => view.setView("table")}><List className="size-4" aria-hidden="true" />{inv.tableView}</Button>
        <Button variant={view.view === "cards" ? "secondary" : "outline"} aria-pressed={view.view === "cards"} onClick={() => view.setView("cards")}><LayoutGrid className="size-4" aria-hidden="true" />{t.trade.categories.cards}</Button></div>
    </div>
    {loadError && model.hasLoaded ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 text-sm"><p>{inv.governanceStaleList}</p><Button variant="outline" size="sm" onClick={() => void model.reload()} disabled={model.isRefreshing}>{t.common.retry}</Button></div> : null}
    {!model.isScopeResolved ? <EmptyState icon={Warehouse} title={inv.selectBranchFirst} description={inv.selectBranchFirstDescription} /> :
      view.view === "cards" && !model.isLoading && (!loadError || model.hasLoaded) ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {view.filtered.map((node) => <Card key={node.id} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-medium">{node.name}</h2><IdentifierText className="text-caption text-muted-foreground">{node.code}</IdentifierText></div><Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, node.status, t.common.unknownCode)}</Badge></div>
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{tradeStatusLabel(t.tradeStatus, node.nodeType, t.common.unknownCode)}</span><bdi>{node.timezone}</bdi></div>
          <Button variant="outline" onClick={() => view.openNode(node.id)}>{inv.nodeDetailTitle}</Button>
        </Card>)}{view.filtered.length === 0 ? <EmptyState icon={Warehouse} title={inv.nodesEmpty} /> : null}</div> :
      <DataTable columns={columns} rows={view.filtered} rowKey={(node) => node.id} isLoading={model.isLoading} error={model.hasLoaded ? null : loadError} onRetry={() => void model.reload()}
        labels={{ retry: t.common.retry, errorTitle: inv.nodesLoadFailed, emptyTitle: inv.nodesEmpty, selectAll: t.views.selectAll, selectRow: t.views.selectRow,
          sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
          pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }} />}
    <p className="text-caption text-muted-foreground">{formatTemplate(inv.linkedNodeCount, { count: formatNumber(view.filtered.length, lang) })}</p>
    <CreateNodeModal key={model.createOpen ? "open" : "closed"} isOpen={model.createOpen} onClose={model.closeCreate} onSubmit={model.create} isSubmitting={model.isSubmitting} error={model.formError} initialValues={model.createDraft} unresolved={model.unresolved} onRetryOriginal={model.retryOriginal} canRetryOriginal={model.canRetryOriginal} />
    {view.detailId ? <NodeDetailsModal nodeId={view.detailId} onClose={view.closeNode} onRestoreFocus={view.restoreFocus} /> : null}
  </div>;
  return <PermissionGate require={model.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!model.canRead || model.queryError?.status === 403}>{content}</PermissionGate>;
}



