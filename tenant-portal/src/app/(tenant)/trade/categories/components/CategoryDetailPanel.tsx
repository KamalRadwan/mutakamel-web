"use client";

import { Badge, Button, DetailSection, ErrorState, IdentifierText, NotFoundState, PermissionGate, Skeleton } from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { formatDateTime } from "@/lib/format/date";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import type { useCategoryWorkspace } from "../hooks/useCategoryWorkspace";

export function CategoryDetailPanel({ workspace: state }: { workspace: ReturnType<typeof useCategoryWorkspace> }) {
  const { t, lang, detail } = state; const copy = t.trade.categories; const node = detail.data;
  if (state.invalidId || detail.error?.status === 404) return <NotFoundState title={copy.missing} backLabel={copy.back} onBack={() => state.select(null)} />;
  if (detail.loading) return <Skeleton className="h-56 w-full" />;
  if (detail.error) return <PermissionGate require={TRADE_PERMISSIONS.itemsRead} denied={detail.error.status === 403}>
    <ErrorState title={copy.loadFailed} retryLabel={t.common.retry} onRetry={() => void detail.reload()} />
  </PermissionGate>;
  if (!node) return <p className="p-4 text-sm text-muted-foreground">{copy.selectDetail}</p>;
  return <section className="min-w-0 space-y-4 rounded-md border border-border p-4" aria-label={node.name}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{node.name}</h2>
        <p className="mt-1 break-words text-xs text-muted-foreground">{node.path.map((entry) => entry.name).join(" / ")}</p>
      </div>
      <Badge tone={node.effectiveActive ? "positive" : "neutral"}>{node.status === "ACTIVE" ? copy.status.ACTIVE : node.status === "INACTIVE" ? copy.status.INACTIVE : copy.status.unknown}</Badge>
    </div>
    {node.status === "ACTIVE" && !node.effectiveActive ? <p className="text-xs text-muted-foreground">{copy.inheritedInactive}</p> : null}
    <Button variant="outline" size="sm" onClick={() => void state.reveal()}>{copy.showInTree}</Button>
    <DetailSection title={copy.defaultName} emptyValueLabel="—" fields={[
      { label: copy.code, value: <IdentifierText>{node.code}</IdentifierText> },
      { label: copy.defaultName, value: node.displayName },
      ...Object.entries(node.localizedNames).map(([locale, name]) => ({ label: locale, value: name })),
      { label: t.trade.updatedAt, value: formatDateTime(node.updatedAt, lang) },
    ]} />
    <DetailSection title={copy.directItems} emptyValueLabel="—" fields={[
      { label: copy.directItems, value: formatNumber(node.usage.directItemCount, lang) },
      { label: copy.subtreeItems, value: formatNumber(node.usage.subtreeItemCount, lang) },
      { label: copy.descendants, value: formatNumber(node.usage.descendantCount, lang) },
    ]} />
    {node.usage.hasRetainedItemReferences ? <p className="text-xs text-muted-foreground">{copy.retainedReferences}</p> : null}
    {state.canManage ? <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!state.canWrite || state.busy || state.uncertain} onClick={() => state.openEditor("update")}>{copy.edit}</Button>
        <Button variant="outline" size="sm" disabled={!state.canWrite || state.busy || state.uncertain || !node.effectiveActive || node.depth >= 8} onClick={() => state.openEditor("create", true)}>{copy.addChild}</Button>
        <Button variant="outline" size="sm" disabled={!state.canWrite || state.busy || state.uncertain} onClick={() => state.openEditor("move")}>{copy.move}</Button>
        <Button variant="outline" size="sm" disabled={!state.canWrite || state.busy || state.uncertain} onClick={() => state.openEditor("reorder")}>{copy.reorder}</Button>
        <Button variant="outline" size="sm" disabled={!state.canWrite || state.busy || state.uncertain || (node.status !== "ACTIVE" && node.status !== "INACTIVE")} onClick={() => state.openEditor("status")}>{node.status === "ACTIVE" ? copy.deactivate : node.status === "INACTIVE" ? copy.activate : copy.status.unknown}</Button>
        <Button variant="outline" size="sm" disabled={!state.canWrite || state.busy || state.uncertain || !node.usage.canDelete} onClick={() => state.openEditor("delete")}>{copy.delete}</Button>
      </div>
      {node.usage.deleteBlockers.length ? <ul className="list-inside list-disc text-xs text-muted-foreground">
        {node.usage.deleteBlockers.map((reason) => <li key={reason}>{copy.deleteBlockers[reason]}</li>)}
      </ul> : null}
    </> : null}
  </section>;
}
