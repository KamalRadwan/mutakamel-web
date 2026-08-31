"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchOrgTree,
  ORG_TREE_TOO_LARGE_CODE,
  type OrgTreeNode,
} from "../../contracts/organization-contract";

export interface OrganizationTreeState {
  roots: OrgTreeNode[];
  /** Ids whose children are shown. Companies open by default, deeper levels do not. */
  expandedIds: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isTooLarge, setIsTooLarge] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

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
          setExpandedIds(new Set(tree.map((node) => node.id)));
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

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  return useMemo(
    () => ({ roots, expandedIds, toggleExpanded, isLoading, loadError, isTooLarge, reload }),
    [expandedIds, isLoading, isTooLarge, loadError, reload, roots, toggleExpanded],
  );
}

/** Counts every node at every depth, for the tree screen's summary line. */
export function countTreeNodes(nodes: OrgTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countTreeNodes(node.children), 0);
}
