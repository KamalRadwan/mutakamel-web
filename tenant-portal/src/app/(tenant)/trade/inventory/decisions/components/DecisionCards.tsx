"use client";

import { Eye, FileSearch } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import type { useInventoryDecisions } from "../hooks/useInventoryDecisions";
import { decisionOutcomeTone } from "../decision-presentation";

export function DecisionCards({ vm }: { vm: ReturnType<typeof useInventoryDecisions> }) {
  const { t } = vm;
  if (vm.isLoading) return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  if (vm.queryError && !vm.isStale) return <ErrorState title={t.tradeInventory.decisionsLoadFailed} description={vm.errorMessage} onRetry={() => void vm.reload()} retryLabel={t.common.retry} />;
  if (!vm.items.length) return <EmptyState icon={FileSearch} title={t.tradeInventory.decisionsEmpty} />;
  return <div className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">{t.tradeInventory.readViews.thisPage}</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {vm.items.map((decision) => <Card key={decision.id} className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium">{tradeStatusLabel(t.tradeStatus, decision.decisionType, t.common.unknownCode)}</h2>
        <Badge tone={decisionOutcomeTone(decision.outcome)}>{decision.outcome ? tradeStatusLabel(t.tradeStatus, decision.outcome, t.common.unknownCode) : t.tradeInventory.readViews.notSet}</Badge></div>
      <p className="text-sm">{vm.aggregateLabel(decision.aggregateType)}</p>
      <p className="text-sm text-muted-foreground">{vm.branchLabel(decision.branchId)} · {formatDateTime(decision.evaluatedAt, vm.lang)}</p>
      <Button variant="outline" size="sm" onClick={() => vm.openDecision(decision.id)} className="self-start"><Eye className="size-4" aria-hidden="true" />{t.tradeInventory.readViews.viewExplanation}</Button>
    </Card>)}
  </div></div>;
}
