"use client";

import { FolderTree } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, PermissionGate, Skeleton, Tree, type TreeNode } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import type { useCategoryTree } from "../hooks/useCategoryTree";

export function CategoryTreePanel({ tree, selectedId, onSelect }: {
  tree: ReturnType<typeof useCategoryTree>; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.trade.categories;
  const known = new Map([...tree.pages.values()].flatMap((page) => page.items.map((node) => [node.id, node] as const)));
  const describe = (nodes: readonly TreeNode[]): TreeNode[] => nodes.map((node) => {
    const category = known.get(node.id);
    return { ...node, children: node.children ? describe(node.children) : undefined,
      description: category ? <Badge tone={category.effectiveActive ? "positive" : "neutral"}>
        {category.status === "ACTIVE" ? category.effectiveActive ? copy.status.ACTIVE : copy.inheritedInactive
          : category.status === "INACTIVE" ? copy.status.INACTIVE : copy.status.unknown}
      </Badge> : undefined };
  });
  return <div className="min-w-0 space-y-3">
    <p className="text-xs text-muted-foreground">{copy.keyboardHint}</p>
    {tree.busy.has("ROOT") && tree.nodes.length === 0 ? <Skeleton className="h-48 w-full" /> : null}
    <Tree nodes={describe(tree.nodes)} label={copy.title} expanded={tree.expanded}
      selectedId={selectedId} focusRequest={tree.focusRequest} onSelect={onSelect} onExpand={tree.expand}
      labels={{ expand: copy.expand, collapse: copy.collapse }} />
    {tree.pages.has("ROOT") && tree.nodes.length === 0 && !tree.busy.has("ROOT")
      ? <EmptyState icon={FolderTree} title={copy.empty} description={copy.emptyDescription} /> : null}
    <div aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground">
      {tree.busy.size > 0 ? t.common.loading : tree.notice ? copy[tree.notice] : null}
    </div>
    {[...tree.errors].map(([key, error]) => <PermissionGate key={key} require={TRADE_PERMISSIONS.itemsRead} denied={error.status === 403}>
      <ErrorState title={copy.loadFailed} description={known.get(key)?.name ?? copy.root}
        onRetry={() => void tree.load(key === "ROOT" ? null : key)} retryLabel={t.common.retry} />
    </PermissionGate>)}
    {[...tree.pages].filter(([, page]) => page.total > page.limit).map(([key, page]) => (
      <div key={key} role="group" aria-label={formatTemplate(copy.siblingPages, { name: known.get(key)?.name ?? copy.root })}
        className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">{known.get(key)?.name ?? copy.root} · {formatTemplate(copy.pageSummary, {
          page: formatNumber(page.page, lang), total: formatNumber(page.total, lang),
        })}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={tree.busy.has(key) || !page.hasPrev}
            onClick={() => void tree.load(key === "ROOT" ? null : key, page.page - 1)}>{t.common.previousPage}</Button>
          <Button variant="outline" size="sm" disabled={tree.busy.has(key) || !page.hasNext}
            onClick={() => void tree.load(key === "ROOT" ? null : key, page.page + 1)}>{t.common.nextPage}</Button>
        </div>
      </div>
    ))}
  </div>;
}
