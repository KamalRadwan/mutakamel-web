"use client";

import { ChevronDown, Eye, FileSearch, RefreshCw } from "lucide-react";
import { Badge, Button, Card, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, EmptyState, Field, Input, NameSelect, PageHeader, PermissionGate, ViewSwitcher, type ColumnDef } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../../components/InventoryListPagination";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { INVENTORY_POLICY_KINDS, type InventoryDecision } from "../../inventory-governance-contract";
import { useInventoryDecisions } from "../hooks/useInventoryDecisions";
import { DecisionEvidenceModal } from "./DecisionEvidenceModal";
import { DecisionCards } from "./DecisionCards";
import { decisionOutcomeTone } from "../decision-presentation";

export function DecisionsWorkspace() {
  const vm = useInventoryDecisions();
  const { t, lang, draft } = vm;
  const copy = t.tradeInventory.readViews;
  const columns: ColumnDef<InventoryDecision>[] = [
    { id: "policy", header: t.tradeInventory.policyKind, cell: (decision) => tradeStatusLabel(t.tradeStatus, decision.decisionType, t.common.unknownCode) },
    { id: "outcome", header: t.tradeInventory.outcome, cell: (decision) => <Badge tone={decisionOutcomeTone(decision.outcome)}>{decision.outcome ? tradeStatusLabel(t.tradeStatus, decision.outcome, t.common.unknownCode) : t.tradeInventory.readViews.notSet}</Badge> },
    { id: "transaction", header: copy.relatedTransaction, cell: (decision) => vm.aggregateLabel(decision.aggregateType) },
    { id: "branch", header: t.common.branch, cell: (decision) => <bdi>{vm.branchLabel(decision.branchId)}</bdi> },
    { id: "evaluated", header: t.tradeInventory.evaluatedAt, cell: (decision) => <span className="tabular-nums">{formatDateTime(decision.evaluatedAt, lang)}</span> },
    { id: "actions", header: t.common.actions, align: "end", cell: (decision) => <Button variant="outline" size="xs" onClick={() => vm.openDecision(decision.id)}><Eye className="size-3.5" aria-hidden="true" />{copy.viewExplanation}</Button> },
  ];
  const labels = { retry: t.common.retry, errorTitle: t.tradeInventory.decisionsLoadFailed,
    emptyTitle: vm.filters.policyKind || vm.filters.aggregateId ? t.tradeCommon.emptyForFilter : t.tradeInventory.decisionsEmpty,
    selectAll: t.views.selectAll, selectRow: t.views.selectRow, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted,
    pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from: number, to: number, total: number) => formatTemplate(t.common.showingOf, { from, to, total }) } };
  return <div className="flex min-w-0 flex-col gap-4">
    <InventoryModuleSubnav active="decisions" />
    <PageHeader title={t.tradeInventory.decisionsTitle} headingRef={vm.headingRef} description={t.tradeInventory.decisionsSubtitle} secondaryActions={<>
      <TenantBranchSelect branchIds={vm.branchIds} branchId={vm.branchId} onChange={vm.selectBranch} disabled={vm.isRefreshing} />
      <Button variant="outline" size="sm" onClick={() => void vm.reload()} loading={vm.isRefreshing}><RefreshCw className="size-4" aria-hidden="true" />{t.tradeCommon.reload}</Button>
    </>} />
    {vm.isScopeResolved ? <PermissionGate require={vm.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!vm.canRead || vm.queryError?.status === 403}>
      <Card className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
          <Field label={t.tradeInventory.policyKind} showLabel><NameSelect value={draft.policyKind ?? "ALL"} placeholder={copy.allPolicies}
            options={[{ value: "ALL", label: copy.allPolicies }, ...INVENTORY_POLICY_KINDS.map((kind) => ({ value: kind, label: tradeStatusLabel(t.tradeStatus, kind, t.common.unknownCode) }))]}
            onValueChange={(value) => vm.setFilter("policyKind", INVENTORY_POLICY_KINDS.find((kind) => kind === value))} /></Field>
          <Field label={copy.relatedTransaction} showLabel hint={copy.sourceFilterHint}><NameSelect value={draft.aggregateId || undefined} options={vm.sourceOptions}
            placeholder={copy.allTransactions} onValueChange={(value) => vm.setFilter("aggregateId", value)} /></Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={vm.applyFilters} disabled={vm.isRefreshing}>{copy.apply}</Button><Button variant="ghost" size="sm" onClick={vm.clearFilters}>{copy.clear}</Button></div>
          <ViewSwitcher value={vm.view} onChange={vm.setView} available={["table", "card"]} labels={{ table: t.tradeInventory.tableView, card: t.tradeInventory.decisionCards }} />
        </div>
        <Collapsible><CollapsibleTrigger className="text-sm text-muted-foreground">{copy.technicalDetails}<ChevronDown className="size-4" aria-hidden="true" /></CollapsibleTrigger><CollapsibleContent className="pt-3">
          <Field label={copy.exactReference} showLabel error={vm.referenceError ?? undefined}><Input value={draft.aggregateId} maxLength={36} dir="ltr" onChange={(event) => vm.setFilter("aggregateId", event.target.value)} /></Field>
        </CollapsibleContent></Collapsible>
      </Card>
      {vm.isStale ? <Card role="status" className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="space-y-1"><Badge tone="caution">{copy.staleResults}</Badge><p className="text-sm text-muted-foreground">{vm.errorMessage}</p></div><Button variant="outline" size="sm" onClick={() => void vm.reload()} loading={vm.isRefreshing}>{t.common.retry}</Button></Card> : null}
      {vm.view === "table" ? <DataTable columns={columns} rows={vm.items} isLoading={vm.isLoading} error={vm.isStale ? null : vm.queryError} onRetry={() => void vm.reload()}
        rowKey={(decision) => decision.id} onRowClick={(decision) => vm.openDecision(decision.id)} labels={labels} showRowNumbers={false} /> : <DecisionCards vm={vm} />}
      <InventoryListPagination page={vm.pagination} onPageChange={vm.setPage} isRefreshing={vm.isRefreshing} />
    </PermissionGate> : <EmptyState icon={FileSearch} title={t.tradeInventory.selectCompanyFirst} description={t.tradeInventory.selectCompanyFirstDescription} />}
    {vm.detailId && <DecisionEvidenceModal id={vm.detailId} onClose={vm.closeDecision} onRestoreFocus={vm.restoreFocus} />}
  </div>;
}
