"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, CopyButton, DetailSection, Dialog, DialogContent, DialogDescription, DialogTitle, EmptyState, ErrorState, IdentifierText, NotFoundState, PermissionGate, Skeleton } from "@/design-system";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { formatDateTime } from "@/lib/format/date";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { inventoryMessage } from "../../inventory-messages";
import { useInventoryDecision } from "../[id]/hooks/useInventoryDecision";
import { decisionOutcomeTone } from "../decision-presentation";

export function DecisionEvidenceModal({ id, onClose, onRestoreFocus }: { id: string; onClose: () => void; onRestoreFocus: (event: Event) => void }) {
  const vm = useInventoryDecision(id);
  const { t, lang, decision } = vm;
  const copy = t.tradeInventory.readViews;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent size="2xl" onCloseAutoFocus={onRestoreFocus} className="max-h-[90dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0">
      <header className="border-b border-border px-5 py-4 pe-16"><DialogTitle>{t.tradeInventory.decisionDetailTitle}</DialogTitle>
        <DialogDescription className="mt-1 text-sm">{copy.safeEvidenceNote}</DialogDescription></header>
      <div className="min-h-0 overflow-y-auto p-5">
        {vm.isNotFound ? <NotFoundState title={t.tradeInventory.decisionNotFound} description={t.tradeInventory.decisionNotFoundDescription} backLabel={t.common.close} onBack={onClose} />
          : !vm.isScopeResolved ? <EmptyState title={t.tradeInventory.selectCompanyFirst} description={t.tradeInventory.selectCompanyFirstDescription} />
          : <PermissionGate require={vm.canRead ? [] : INVENTORY_READ_PERMISSION} denied={!vm.canRead || vm.queryError?.status === 403}>
            {vm.isLoading ? <Skeleton className="h-72" /> : vm.queryError ? <ErrorState title={t.tradeInventory.decisionLoadFailed} description={inventoryMessage(vm.queryError, t) ?? t.tradeInventory.decisionLoadFailed} onRetry={() => void vm.reload()} retryLabel={t.common.retry} /> : decision && <RecordHistoryTab entityType="TradeDecisionReceiptEntity" entityId={decision.id}>
              <div className="flex flex-col gap-4">
                <DetailSection title={copy.policyEvidence} density="compact" fields={[
                  { label: t.tradeInventory.decisionType, value: tradeStatusLabel(t.tradeStatus, decision.decisionType, t.common.unknownCode) },
                  { label: t.tradeInventory.outcome, value: <Badge tone={decisionOutcomeTone(decision.outcome)}>{decision.outcome ? tradeStatusLabel(t.tradeStatus, decision.outcome, t.common.unknownCode) : t.tradeInventory.readViews.notSet}</Badge> },
                  { label: copy.selectedValue, value: <bdi>{vm.selectedLabel}</bdi> },
                  { label: copy.relatedTransaction, value: vm.aggregateLabel },
                  { label: t.common.branch, value: <bdi>{vm.branchLabel}</bdi> },
                  { label: t.tradeInventory.evaluatedAt, value: formatDateTime(decision.evaluatedAt, lang) },
                  { label: t.tradeInventory.explanation, value: decision.explanation || t.tradeInventory.readViews.notSet, wide: true },
                ]} />
                <DetailSection title={copy.policyVersions} density="compact">
                  {vm.policyRows.length ? <ul className="flex flex-col gap-2">{vm.policyRows.map((policy) => <li key={policy.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm"><bdi>{policy.code}</bdi><span>{copy.revision} <bdi>{policy.version}</bdi></span></li>)}</ul> : <p className="text-sm text-muted-foreground">{copy.noEvidence}</p>}
                </DetailSection>
                <DetailSection title={copy.matchedRules} density="compact">
                  {decision.matchedRules.length ? <ul className="flex flex-col gap-2">{decision.matchedRules.map((rule, index) => <li key={`${rule}-${index}`}><bdi className="text-sm">{rule}</bdi></li>)}</ul> : <p className="text-sm text-muted-foreground">{copy.noEvidence}</p>}
                </DetailSection>
                <Collapsible><CollapsibleTrigger className="text-sm text-muted-foreground">{copy.technicalDetails}<ChevronDown className="size-4" aria-hidden="true" /></CollapsibleTrigger>
                  <CollapsibleContent className="pt-3"><DetailSection title={copy.technicalDetails} density="compact" fields={[
                    { label: copy.recordReference, value: <div className="flex flex-wrap items-center gap-2"><IdentifierText>{decision.id}</IdentifierText><CopyButton value={decision.id} copyLabel={copy.copyReference} copiedLabel={t.tradeInventory.readViews.copied} failedLabel={t.tradeInventory.readViews.copyFailed} showLabel /></div> },
                    { label: copy.sourceReference, value: decision.aggregateId ? <IdentifierText>{decision.aggregateId}</IdentifierText> : t.tradeInventory.readViews.notSet },
                    { label: t.tradeInventory.readViews.correlationReference, value: decision.correlationId ? <div className="flex flex-wrap items-center gap-2"><IdentifierText>{decision.correlationId}</IdentifierText><CopyButton value={decision.correlationId} copyLabel={copy.copyReference} copiedLabel={t.tradeInventory.readViews.copied} failedLabel={t.tradeInventory.readViews.copyFailed} showLabel /></div> : t.tradeInventory.readViews.notSet },
                    { label: t.tradeInventory.explanationCode, value: <bdi>{decision.explanationCode || t.tradeInventory.readViews.notSet}</bdi> },
                    { label: copy.selectedValue, value: <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs" dir="ltr">{JSON.stringify(decision.selectedValue, null, 2) ?? t.tradeInventory.readViews.notSet}</pre>, wide: true },
                    { label: copy.policyVersions, value: <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs" dir="ltr">{JSON.stringify(decision.policyVersions, null, 2)}</pre>, wide: true },
                  ]} /></CollapsibleContent>
                </Collapsible>
              </div>
            </RecordHistoryTab>}
          </PermissionGate>}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3"><Button variant="outline" size="sm" onClick={() => void vm.reload()} loading={vm.isRefreshing} disabled={!vm.canRead || vm.isNotFound}><RefreshCw className="size-4" aria-hidden="true" />{t.tradeCommon.reload}</Button><Button variant="outline" size="sm" onClick={onClose}>{t.common.close}</Button></footer>
    </DialogContent>
  </Dialog>;
}
