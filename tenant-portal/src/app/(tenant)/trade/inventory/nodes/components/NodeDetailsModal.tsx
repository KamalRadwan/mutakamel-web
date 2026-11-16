"use client";
import { Badge, Button, ConflictDialog, DetailSection, Dialog, DialogContent, DialogDescription, DialogTitle, ErrorState, NotFoundState, PermissionGate, Skeleton } from "@/design-system";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { useInventoryNode } from "../[id]/hooks/useInventoryNode";
import { EditNodeModal } from "../[id]/components/EditNodeModal";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { inventoryMessage } from "../../inventory-messages";

export function NodeDetailsModal({ nodeId, onClose, onRestoreFocus }: { nodeId: string; onClose: () => void; onRestoreFocus: (event: Event) => void }) {
  const model = useInventoryNode(nodeId);
  const branches = useTenantOrganizationOptions("branch", model.node?.branches.map((branch) => branch.branchId) ?? []);
  const { t, lang, node } = model;
  const close = () => { if (!model.isSubmitting && !model.unresolved) onClose(); };
  return <>
    <Dialog open={!model.editOpen && !model.conflictOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent size="2xl" closeLabel={t.common.close} onCloseAutoFocus={(event) => { if (model.editOpen || model.conflictOpen) event.preventDefault(); else onRestoreFocus(event); }} className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle>{node?.name ?? t.tradeInventory.nodeDetailTitle}</DialogTitle>
        <DialogDescription>{node?.code ?? t.tradeInventory.nodesSubtitle}</DialogDescription>
        <PermissionGate require={model.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!model.canRead || model.queryError?.status === 403}>
        {model.isLoading ? <Skeleton className="h-56" /> : model.isNotFound ? <NotFoundState title={t.tradeInventory.nodeNotFound} description={t.tradeInventory.nodeNotFoundDescription} backHref={TENANT_ROUTES.tradeInventoryNodes} backLabel={t.tradeInventory.backToNodes} /> : model.queryError ? <ErrorState title={t.tradeInventory.nodeLoadFailed} description={inventoryMessage(model.queryError, t) ?? t.tradeCommon.actionFailed} onRetry={() => void model.reload()} retryLabel={t.common.retry} /> : node ? <RecordHistoryTab entityType="InventoryFulfillmentNodeEntity" entityId={node.id}>
          <div className="flex flex-wrap gap-2"><Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, node.status, t.common.unknownCode)}</Badge><Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, node.nodeType, t.common.unknownCode)}</Badge></div>
          <DetailSection title={t.tradeCommon.overview} emptyValueLabel={t.tradeCommon.notSet} fields={[
            { label: t.tradeInventory.nodeTimezone, value: node.timezone },
            { label: t.tradeCommon.updatedAt, value: formatDateTime(node.updatedAt, lang) },
          ]} />
          <div className="flex flex-col gap-2"><h2 className="text-sm font-medium">{t.tradeInventory.nodeBranches}</h2><div className="flex flex-wrap gap-2">{node.branches.map((branch) => <Badge key={branch.branchId} tone="neutral">{branches.find((option) => option.value === branch.branchId)?.label ?? t.common.nameUnavailable}</Badge>)}</div></div>
        </RecordHistoryTab> : null}
        </PermissionGate>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" onClick={close}>{t.common.close}</Button>{model.canManage && node ? <Button onClick={model.openEdit}>{t.tradeInventory.nodeEditTitle}</Button> : null}</div>
      </DialogContent>
    </Dialog>
    {node && model.editOpen ? <EditNodeModal key={`${node.id}-${node.version}`} node={node} draft={model.editDraft} isOpen={!model.conflictOpen} onClose={model.closeEdit} onSubmit={model.update} isSubmitting={model.isSubmitting || model.isRefreshing} error={model.formError} unresolved={model.unresolved} onRetryOriginal={model.retryOriginal} canRetryOriginal={model.canRetryOriginal} /> : null}
    <ConflictDialog open={model.conflictOpen} onOpenChange={(open) => { if (!open) model.dismissConflict(); }} title={t.tradeCommon.conflictTitle} description={t.tradeCommon.conflictDescription}
      onReload={model.resolveConflict} onCancel={model.dismissConflict} loading={model.isSubmitting}
      labels={{ yourChanges: t.tradeCommon.yourChanges, theirChanges: t.tradeCommon.theirChanges, reload: t.tradeCommon.conflictReload, overwrite: t.tradeCommon.conflictOverwrite, cancel: t.common.cancel }} />
  </>;
}
