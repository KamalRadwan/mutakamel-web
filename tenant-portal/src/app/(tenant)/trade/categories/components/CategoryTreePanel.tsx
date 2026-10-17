"use client";

import { FolderTree } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  EmptyState,
  ErrorState,
  IdentifierText,
  PermissionGate,
  Skeleton,
  SWATCH_SURFACE_PALETTES,
  Tree,
  type TreeNode,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { getCategoryDepthHue } from "../category-catalogue-metadata";
import type { useCategoryTree } from "../hooks/useCategoryTree";

export function CategoryTreePanel({
  tree,
  selectedId,
  onSelect,
}: {
  tree: ReturnType<typeof useCategoryTree>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.trade.categories;
  const known = new Map(
    [...tree.pages.values()].flatMap((page) =>
      page.items.map((node) => [node.id, node] as const),
    ),
  );

  const describe = (nodes: readonly TreeNode[]): TreeNode[] =>
    nodes.map((node) => {
      const category = known.get(node.id);
      if (!category) {
        return {
          ...node,
          children: node.children ? describe(node.children) : undefined,
        };
      }
      const depthHue = getCategoryDepthHue(category.depth);
      const depthPalette = SWATCH_SURFACE_PALETTES[depthHue];
      const currentSegment = category.path.at(-1);
      return {
        ...node,
        children: node.children ? describe(node.children) : undefined,
        description: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium",
                depthPalette.badge,
              )}
            >
              {formatTemplate(copy.levelBadge, {
                depth: formatNumber(category.depth, lang),
              })}
            </span>
            <IdentifierText className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-2xs">
              {category.code}
            </IdentifierText>
            {currentSegment ? (
              <span className="text-2xs text-muted-foreground">
                {formatTemplate(copy.siblingPositionLabel, {
                  pos: formatNumber(currentSegment.siblingPosition, lang),
                  total: formatNumber(currentSegment.siblingTotal, lang),
                })}
              </span>
            ) : null}
            <Badge tone={category.effectiveActive ? "positive" : "neutral"}>
              {category.status === "ACTIVE"
                ? category.effectiveActive
                  ? copy.status.ACTIVE
                  : copy.inheritedInactive
                : category.status === "INACTIVE"
                  ? copy.status.INACTIVE
                  : copy.status.unknown}
            </Badge>
          </span>
        ),
      };
    });

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
      <p className="text-xs text-muted-foreground">{copy.keyboardHint}</p>
      {tree.busy.has("ROOT") && tree.nodes.length === 0 ? (
        <Skeleton className="h-48 w-full" />
      ) : null}
      <Tree
        nodes={describe(tree.nodes)}
        label={copy.title}
        expanded={tree.expanded}
        selectedId={selectedId}
        focusRequest={tree.focusRequest}
        onSelect={onSelect}
        onExpand={tree.expand}
        labels={{ expand: copy.expand, collapse: copy.collapse }}
      />
      {tree.pages.has("ROOT") &&
      tree.nodes.length === 0 &&
      !tree.busy.has("ROOT") ? (
        <EmptyState
          icon={FolderTree}
          title={copy.empty}
          description={copy.emptyDescription}
        />
      ) : null}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="text-xs text-muted-foreground"
      >
        {tree.busy.size > 0
          ? t.common.loading
          : tree.notice
            ? copy[tree.notice]
            : null}
      </div>
      {[...tree.errors].map(([key, error]) => (
        <PermissionGate
          key={key}
          require={TRADE_PERMISSIONS.itemsRead}
          denied={error.status === 403}
        >
          <ErrorState
            title={copy.loadFailed}
            description={known.get(key)?.name ?? copy.root}
            onRetry={() => void tree.load(key === "ROOT" ? null : key)}
            retryLabel={t.common.retry}
          />
        </PermissionGate>
      ))}
      {[...tree.pages]
        .filter(([, page]) => page.total > page.limit)
        .map(([key, page]) => (
          <div
            key={key}
            role="group"
            aria-label={formatTemplate(copy.siblingPages, {
              name: known.get(key)?.name ?? copy.root,
            })}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"
          >
            <span className="text-xs text-muted-foreground">
              {known.get(key)?.name ?? copy.root} ·{" "}
              {formatTemplate(copy.pageSummary, {
                page: formatNumber(page.page, lang),
                total: formatNumber(page.total, lang),
              })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={tree.busy.has(key) || !page.hasPrev}
                onClick={() =>
                  void tree.load(key === "ROOT" ? null : key, page.page - 1)
                }
              >
                {t.common.previousPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={tree.busy.has(key) || !page.hasNext}
                onClick={() =>
                  void tree.load(key === "ROOT" ? null : key, page.page + 1)
                }
              >
                {t.common.nextPage}
              </Button>
            </div>
          </div>
        ))}
    </div>
  );
}
