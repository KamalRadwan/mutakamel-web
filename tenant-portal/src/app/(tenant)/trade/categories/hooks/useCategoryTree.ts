"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { readCategory, readCategoryTree } from "../category-api";
import { CATEGORY_NODE_CACHE_LIMIT, CATEGORY_PAGE_SIZE, type CategoryDetail, type CategoryPage } from "../category-contract";
import { categoryPageKey, categoryTreeNodes, removeCategoryChildren } from "../category-tree";

interface TreeState {
  pages: Map<string, CategoryPage>;
  expanded: Set<string>;
  busy: Set<string>;
  errors: Map<string, NormalizedApiError>;
  treeVersion: number | null;
  notice: "changed" | "capacity" | "revealed" | null;
  focusRequest?: { id: string; sequence: number };
}
const emptyTree = (): TreeState => ({ pages: new Map(), expanded: new Set(), busy: new Set(), errors: new Map(), treeVersion: null, notice: null });

export function useCategoryTree(locale: string, enabled = true) {
  const [state, setState] = useState<TreeState>(emptyTree);
  const current = useRef(state);
  const epoch = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const update = useCallback((change: (before: TreeState) => TreeState) => {
    const next = change(current.current); current.current = next; setState(next);
  }, []);
  const abort = useCallback(() => {
    epoch.current += 1;
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
  }, []);

  const load = useCallback(async (parentId: string | null, page = 1, reset = false): Promise<void> => {
    if (!enabled) return;
    const key = categoryPageKey(parentId);
    if (reset) { abort(); update(() => emptyTree()); }
    const previous = current.current;
    const retained = new Map(previous.pages);
    const removed = removeCategoryChildren(retained, new Set(previous.expanded), parentId);
    const count = [...retained.entries()].reduce((sum, [id, entry]) => sum + (id === key ? 0 : entry.items.length), 0);
    if (count + CATEGORY_PAGE_SIZE > CATEGORY_NODE_CACHE_LIMIT) {
      update((before) => ({ ...before, notice: "capacity" })); return;
    }
    for (const child of removed) { controllers.current.get(child)?.abort(); controllers.current.delete(child); }
    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);
    const requestEpoch = epoch.current;
    update((before) => {
      const errors = new Map(before.errors); errors.delete(key);
      const busy = new Set(before.busy).add(key);
      for (const child of removed) { errors.delete(child); busy.delete(child); }
      return { ...before, errors, busy };
    });
    try {
      const result = await readCategoryTree(parentId, page, locale, controller.signal);
      if (controller.signal.aborted || requestEpoch !== epoch.current) return;
      if (current.current.treeVersion !== null && result.treeVersion !== current.current.treeVersion) {
        // Do not combine pages from different snapshots. One bounded fresh root read.
        abort();
        const fresh = new AbortController(); controllers.current.set("ROOT", fresh);
        const freshEpoch = epoch.current;
        update(() => ({ ...emptyTree(), notice: "changed", busy: new Set(["ROOT"]) }));
        try {
          const roots = await readCategoryTree(null, 1, locale, fresh.signal);
          if (!fresh.signal.aborted && freshEpoch === epoch.current) update((before) => ({ ...before,
            pages: new Map([["ROOT", roots]]), treeVersion: roots.treeVersion, busy: new Set() }));
        } catch (error) {
          if (!fresh.signal.aborted && freshEpoch === epoch.current) update((before) => ({ ...before,
            busy: new Set(), errors: new Map([["ROOT", normalizeApiError(error)]]) }));
        } finally { if (controllers.current.get("ROOT") === fresh) controllers.current.delete("ROOT"); }
        return;
      }
      update((before) => {
        const pages = new Map(before.pages); const expanded = new Set(before.expanded);
        removeCategoryChildren(pages, expanded, parentId);
        pages.set(key, result);
        if (parentId) expanded.add(parentId);
        const busy = new Set(before.busy); busy.delete(key);
        return { ...before, pages, expanded, busy, treeVersion: result.treeVersion };
      });
    } catch (error) {
      if (!controller.signal.aborted && requestEpoch === epoch.current) update((before) => ({ ...before,
        errors: new Map(before.errors).set(key, normalizeApiError(error)) }));
    } finally {
      if (controllers.current.get(key) === controller) {
        controllers.current.delete(key);
        if (requestEpoch === epoch.current) update((before) => {
          const busy = new Set(before.busy); busy.delete(key); return { ...before, busy };
        });
      }
    }
  }, [abort, enabled, locale, update]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active && enabled) void load(null, 1, true); });
    return () => { active = false; abort(); };
  }, [abort, enabled, load]);

  const expand = (id: string, open: boolean) => {
    if (open) {
      if (current.current.busy.has(id)) return;
      update((before) => ({ ...before, expanded: new Set(before.expanded).add(id) }));
      void load(id); return;
    }
    // Collapsed branches are evicted first; late responses must not reopen them.
    const descendants = new Set<string>([id]);
    const collect = (parent: string) => { for (const node of current.current.pages.get(parent)?.items ?? []) { descendants.add(node.id); collect(node.id); } };
    collect(id);
    for (const child of descendants) { controllers.current.get(child)?.abort(); controllers.current.delete(child); }
    update((before) => {
      const pages = new Map(before.pages); const expanded = new Set(before.expanded);
      const busy = new Set(before.busy); const errors = new Map(before.errors);
      removeCategoryChildren(pages, expanded, id); pages.delete(id); expanded.delete(id);
      for (const child of descendants) { busy.delete(child); errors.delete(child); }
      return { ...before, pages, expanded, busy, errors, notice: null };
    });
  };

  const reveal = async (initial: CategoryDetail): Promise<boolean> => {
    abort();
    const controller = new AbortController(); controllers.current.set("REVEAL", controller);
    const requestEpoch = epoch.current;
    update((before) => ({ ...before, busy: new Set(["ROOT"]), errors: new Map() }));
    try {
      let detail = initial;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const pages = new Map<string, CategoryPage>(); const expanded = new Set<string>();
        let matches = true;
        for (let index = 0; index < detail.path.length; index += 1) {
          const segment = detail.path[index];
          const parentId = detail.path[index - 1]?.id ?? null;
          const page = Math.floor((segment.siblingPosition - 1) / CATEGORY_PAGE_SIZE) + 1;
          const result = await readCategoryTree(parentId, page, locale, controller.signal);
          if (controller.signal.aborted || requestEpoch !== epoch.current) return false;
          if (result.treeVersion !== detail.treeVersion || !result.items.some((node) => node.id === segment.id)) { matches = false; break; }
          pages.set(categoryPageKey(parentId), result);
          if (parentId) expanded.add(parentId);
        }
        if (matches) {
          update(() => ({ ...emptyTree(), pages, expanded, treeVersion: detail.treeVersion, notice: "revealed",
            focusRequest: { id: detail.id, sequence: requestEpoch } }));
          return true;
        }
        if (attempt === 0) detail = await readCategory(initial.id, locale, controller.signal);
      }
      throw new Error("Category tree changed during reveal.");
    } catch (error) {
      if (!controller.signal.aborted && requestEpoch === epoch.current) update((before) => ({ ...before,
        busy: new Set(), notice: "changed", errors: new Map([["ROOT", normalizeApiError(error)]]) }));
      return false;
    } finally { if (controllers.current.get("REVEAL") === controller) controllers.current.delete("REVEAL"); }
  };
  return { ...state, nodes: categoryTreeNodes(state.pages, state.busy), load, expand, reveal, reload: () => load(null, 1, true) };
}
