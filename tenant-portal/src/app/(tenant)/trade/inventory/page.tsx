"use client";

import { RotateCcw } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, PageHeader, PermissionGate, Skeleton } from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { inventoryMessage } from "./inventory-messages";
import { INVENTORY_READ_PERMISSION } from "./inventory-contract";
import { InventoryModuleSubnav } from "./components/InventoryModuleSubnav";
import { AvailabilityQuery } from "./components/AvailabilityQuery";
import { AvailabilitySnapshot } from "./components/AvailabilitySnapshot";
import { AvailabilitySession } from "./components/AvailabilitySession";
import { AvailabilityInspector } from "./components/AvailabilityInspector";
import { useInventoryAvailability } from "./hooks/useInventoryAvailability";

export default function InventoryAvailabilityPage() {
  const state = useInventoryAvailability();
  const { t, canRead, isScopeResolved, branchIds, branchId, selectBranch, result, resultQuery, references, isLoading, queryError } = state;
  const inv = t.tradeInventory;
  const content = <div className="flex flex-col gap-4">
    <InventoryModuleSubnav active="availability" />
    <PageHeader title={inv.availabilityTitle} headingRef={state.headingRef} description={inv.availabilitySubtitle}
      primaryAction={{ label: inv.lookUp, onClick: () => void state.lookUp(), disabled: !isScopeResolved || state.itemLoading || !references.canCatalog, loading: isLoading }}
      secondaryActions={<><TenantBranchSelect branchIds={branchIds} branchId={branchId} onChange={selectBranch} disabled={isLoading} />
        <Button variant="outline" size="sm" onClick={state.reset} disabled={isLoading}><RotateCcw className="size-4" aria-hidden="true" />{inv.clearLookup}</Button></>} />
    {!isScopeResolved ? <EmptyState title={inv.selectBranchFirst} description={inv.selectBranchFirstDescription} /> : <>
      <AvailabilityQuery state={state} />
      {queryError ? <ErrorState title={inv.availabilityFailed} description={inventoryMessage(queryError, t) ?? t.tradeCommon.actionFailed}
        onRetry={() => void state.lookUp()} retryLabel={t.common.retry} /> : null}
      {isLoading && !result ? <Skeleton className="h-48 rounded-lg" /> : result && resultQuery ?
        <AvailabilitySnapshot snapshot={result} query={resultQuery} references={references} stale={Boolean(queryError)}
          onRefresh={() => void state.refreshSnapshot()} onInspect={() => state.setInspected({ key: JSON.stringify([result.nodeId, result.itemId, result.uomId, resultQuery.lotKey, resultQuery.serialKey]), query: resultQuery, snapshot: result })} /> :
        <Card><EmptyState title={inv.availabilityNotAsked} description={inv.availabilityNotAskedDescription} /></Card>}
      <AvailabilitySession state={state} />
      <AvailabilityInspector entry={state.inspected} references={references} onClose={() => state.setInspected(null)} onRestoreFocus={state.restoreInspectorFocus} />
    </>}
  </div>;
  return <PermissionGate require={canRead ? [] : INVENTORY_READ_PERMISSION} denied={!canRead || queryError?.status === 403}>{content}</PermissionGate>;
}
