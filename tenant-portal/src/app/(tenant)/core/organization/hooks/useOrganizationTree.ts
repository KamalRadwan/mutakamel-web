"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeResync } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchOrgTree,
  ORG_TREE_TOO_LARGE_CODE,
  type OrgLevel,
  type OrgTreeNode,
} from "../../contracts/organization-contract";
import type { QuickViewTarget } from "./useQuickViewNode";

interface FilteredTreeResult {
  nodes: OrgTreeNode[];
  autoExpandedIds: Set<string>;
}

/** Counts every node at every depth, for the tree screen's summary line. */
export function countTreeNodes(nodes: readonly OrgTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countTreeNodes(node.children), 0);
}

/** Collects every node id that owns at least one child, for Expand All. */
export function collectExpandableTreeIds(nodes: readonly OrgTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (items: readonly OrgTreeNode[]) => {
    for (const item of items) {
      if (item.children.length > 0) {
        ids.add(item.id);
        visit(item.children);
      }
    }
  };
  visit(nodes);
  return ids;
}

/**
 * Filters the bounded tree client-side by case-insensitive `name` or `code`,
 * retaining ancestor chains and auto-expanding ancestors of matching descendants.
 */
export function filterTreeNodes(
  nodes: readonly OrgTreeNode[],
  rawQuery: string,
): FilteredTreeResult {
  const needle = rawQuery.trim().toLowerCase();
  const autoExpandedIds = new Set<string>();
  if (!needle) {
    return { nodes: [...nodes], autoExpandedIds };
  }

  const walk = (items: readonly OrgTreeNode[]): OrgTreeNode[] => {
    const kept: OrgTreeNode[] = [];
    for (const item of items) {
      const filteredChildren = walk(item.children);
      const selfMatches =
        item.name.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle);
      if (filteredChildren.length > 0) {
        autoExpandedIds.add(item.id);
      }
      if (selfMatches || filteredChildren.length > 0) {
        kept.push({
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children,
        });
      }
    }
    return kept;
  };

  return { nodes: walk(nodes), autoExpandedIds };
}

interface OrganizationTreeState {
  roots: OrgTreeNode[];
  visibleRoots: OrgTreeNode[];
  totalCount: number;
  visibleCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  /** Ids whose children are shown. Companies open by default, deeper levels do not. */
  expandedIds: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  quickViewTarget: QuickViewTarget | null;
  openQuickView: (level: OrgLevel, node: OrgTreeNode) => void;
  closeQuickView: () => void;
  isLoading: boolean;
  loadError: NormalizedApiError | null;
  /**
   * The tenant is past the bounded tree's 5 000-nodes-per-level ceiling.
   *
   * Its own state, not an error banner: nothing is broken and retrying cannot
   * help. The paginated list screens are the answer, and the screen says so.
   */
  isTooLarge: boolean;
  reload: () => void;
}

export function useOrganizationTree(): OrganizationTreeState {
  const [roots, setRoots] = useState<OrgTreeNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isTooLarge, setIsTooLarge] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [manualExpandedIds, setManualExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [quickViewTarget, setQuickViewTarget] = useState<QuickViewTarget | null>(null);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setLoadError(null);
      setIsTooLarge(false);
      fetchOrgTree(controller.signal)
        .then((tree) => {
          if (controller.signal.aborted) return;
          setRoots(tree);
          // Only the top level opens on load. A tenant with 5 000 branches would
          // otherwise paint every node in the workspace at once.
          setManualExpandedIds(new Set(tree.map((node) => node.id)));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          setRoots([]);
          if (normalized.status === 422 && normalized.code === ORG_TREE_TOO_LARGE_CODE) {
            setIsTooLarge(true);
          } else {
            setLoadError(normalized);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useRealtimeResync(reload);

  const filtered = useMemo(() => filterTreeNodes(roots, searchQuery), [roots, searchQuery]);

  const effectiveExpandedIds = useMemo(() => {
    if (filtered.autoExpandedIds.size === 0) return manualExpandedIds;
    const merged = new Set(manualExpandedIds);
    for (const id of filtered.autoExpandedIds) merged.add(id);
    return merged;
  }, [filtered.autoExpandedIds, manualExpandedIds]);

  const toggleExpanded = useCallback((id: string) => {
    setManualExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setManualExpandedIds(collectExpandableTreeIds(roots));
  }, [roots]);

  const collapseAll = useCallback(() => {
    setManualExpandedIds(new Set());
  }, []);

  const openQuickView = useCallback((level: OrgLevel, node: OrgTreeNode) => {
    setQuickViewTarget({
      kind: "summary",
      level,
      summary: { id: node.id, code: node.code, name: node.name, status: node.status },
    });
  }, []);

  const closeQuickView = useCallback(() => setQuickViewTarget(null), []);

  const totalCount = useMemo(() => countTreeNodes(roots), [roots]);
  const visibleCount = useMemo(() => countTreeNodes(filtered.nodes), [filtered.nodes]);

  return useMemo(
    () => ({
      roots,
      visibleRoots: filtered.nodes,
      totalCount,
      visibleCount,
      searchQuery,
      setSearchQuery,
      expandedIds: effectiveExpandedIds,
      toggleExpanded,
      expandAll,
      collapseAll,
      quickViewTarget,
      openQuickView,
      closeQuickView,
      isLoading,
      loadError,
      isTooLarge,
      reload,
    }),
    [
      closeQuickView,
      collapseAll,
      effectiveExpandedIds,
      expandAll,
      filtered.nodes,
      isLoading,
      isTooLarge,
      loadError,
      openQuickView,
      quickViewTarget,
      reload,
      roots,
      searchQuery,
      toggleExpanded,
      totalCount,
      visibleCount,
    ],
  );
}
