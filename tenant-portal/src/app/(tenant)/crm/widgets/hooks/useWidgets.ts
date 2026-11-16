"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { mergeDefinitionItems } from "../../dashboards/definition-pagination";
import { parseCatalogResponse, type DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { WIDGETS_PATH, WIDGET_CATALOG_PATH, buildCloneWidgetRequest, normalizeWidgetDisplaySpec, widgetClonePath, widgetPath } from "../../dashboards/widget-contract";
import { WIDGET_LIBRARY_SEARCH_LIMIT, isPlaceableWidget, parseWidgetLibraryResponse, widgetLibraryListPath,
  type WidgetLibraryFilters, type WidgetLibraryItem } from "../../dashboards/widget-library-contract";
import { parseQuerySpec } from "../../dashboards/widget-response";
import { parseWidgetDraftState, type WidgetDraftContent } from "../widget-draft-contract";
import { useWidgetSafety, type WidgetWriteTicket } from "./useWidgetSafety";
import { WIDGET_READ, WIDGET_WRITE, assertWidgetStatus, widgetFailure, refusedWidgetWrite, sameWidgetValue, type WidgetWriteResult } from "./widget-requests";
export type { WidgetWriteResult } from "./widget-requests";
interface Snapshot { scope: string; path: string; items: WidgetLibraryItem[]; cursor: string | null; catalog: DashboardCatalog | null; catalogFailed: boolean; }
const EMPTY: WidgetLibraryItem[] = [];
const DEFAULT_FILTERS: WidgetLibraryFilters = { search: "", access: null, status: null, source: null, ownerUserId: null };
export function useWidgets() {
  const { user } = useTenantAuth();
  const safety = useWidgetSafety("widgets");
  const { scope, startRead, currentRead, reconciled } = safety;
  const permissions = user?.permissions ?? [];
  const canRead = hasPermission(permissions, "crm.widgets.read");
  const canCreate = safety.canMutate && hasPermission(permissions, "crm.widgets.create");
  const canDelete = safety.canMutate && hasPermission(permissions, "crm.widgets.delete");
  const canPreview = hasPermission(permissions, "crm.dashboards.read", true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const confirmed = useRef<Snapshot | null>(null);
  const [loading, setLoading] = useState<{ scope: string; path: string } | null>(null);
  const [error, setError] = useState<{ scope: string; path: string; value: NormalizedApiError } | null>(null);
  const [pending, setPending] = useState<{ scope: string; id: string } | null>(null);
  const [writeDenied, setWriteDenied] = useState<string | null>(null);
  const [filterState, setFilterState] = useState({ scope, value: DEFAULT_FILTERS });
  const filters = filterState.scope === scope ? filterState.value : DEFAULT_FILTERS;
  const { search, access, status, source, ownerUserId } = filters;
  const term = search.trim();
  const path = widgetLibraryListPath({ search: term, access, status, source, ownerUserId });
  const load = useCallback(async (cursor?: string, signal?: AbortSignal, write?: WidgetWriteTicket, refreshCatalog = false) => {
    const ticket = canRead ? startRead(write) : null;
    if (!ticket) return false;
    setLoading({ scope, path }); setError(null);
    const previous = confirmed.current?.scope === scope ? confirmed.current : null;
    const loadedCatalog = refreshCatalog ? null : previous?.catalog;
    const [list, catalog] = await Promise.allSettled([
      axiosClient.get<unknown>(widgetLibraryListPath({ search: term, access, status, source, ownerUserId }, cursor), { ...WIDGET_READ, signal }),
      loadedCatalog ? Promise.resolve(null) : axiosClient.get<unknown>(WIDGET_CATALOG_PATH, { ...WIDGET_READ, signal }),
    ]);
    if (signal?.aborted || !currentRead(ticket)) return false;
    try {
      if (list.status === "rejected") throw list.reason;
      assertWidgetStatus(list.value, 200);
      const page = parseWidgetLibraryResponse(list.value.data);
      if (page.items.some(item => (status && item.status !== status)
        || (ownerUserId && item.ownerUserId !== ownerUserId)
        || (source === "unclassified" ? item.sourceResources?.length !== 0 : source && !item.sourceResources?.includes(source))
        || (access === "OWNED" && item.accessLevel !== "OWNER") || ((access === "SHARED" || access === "TEAM") && item.accessLevel === "OWNER"))) {
        throw new Error("Widget library page does not match the selected filters.");
      }
      let nextCatalog = loadedCatalog ?? null;
      try { if (catalog.status === "fulfilled" && catalog.value) { assertWidgetStatus(catalog.value, 200); nextCatalog = parseCatalogResponse(catalog.value.data); } } catch {}
      const next = { scope, path, items: cursor && previous?.path === path ? mergeDefinitionItems(previous.items, page.items) : page.items,
        cursor: page.nextCursor, catalog: nextCatalog, catalogFailed: !nextCatalog };
      confirmed.current = next; setSnapshot(next); reconciled(ticket);
      return true;
    } catch (caught) {
      const value = normalizeApiError(caught);
      if ([401, 403, 404].includes(value.status)) { confirmed.current = null; setSnapshot(null); }
      setError({ scope, path, value });
      return false;
    }
    finally { if (!signal?.aborted && currentRead(ticket)) setLoading(null); }
  }, [canRead, scope, path, term, access, status, source, ownerUserId, startRead, currentRead, reconciled]);
  useEffect(() => {
    const controller = new AbortController();
    const start = () => { if (!controller.signal.aborted) void load(undefined, controller.signal); };
    const delay = term ? setTimeout(start, 250) : undefined;
    if (!term) queueMicrotask(start);
    return () => { clearTimeout(delay); controller.abort(); };
  }, [load, term]);
  const queryError = error?.scope === scope && error.path === path ? error.value : null;
  const queryLoading = loading?.scope === scope && loading.path === path;
  const execute = async (kind: "create" | "clone" | "delete", id?: string, input?: WidgetDraftContent, name = ""): Promise<WidgetWriteResult> => {
    const current = confirmed.current?.scope === scope && confirmed.current.path === path ? confirmed.current : null;
    const target = current?.items.find((item) => item.id === id);
    const source = target && isPlaceableWidget(target) ? target : null;
    const permitted = kind === "delete" ? canDelete && target?.accessLevel === "OWNER" : canCreate && (kind !== "clone" || !!source);
    if (!current || queryError || queryLoading || writeDenied === scope || !permitted) return refusedWidgetWrite();
    if (kind === "create" && !input) return refusedWidgetWrite();
    const ticket = safety.beginWrite(true);
    if (!ticket) return refusedWidgetWrite();
    setPending({ scope, id: id ?? "create" });
    try {
      const content = input ? { ...input, name: input.name.trim(),
        displaySpec: Object.hasOwn(input.querySpec, "editorDraft") ? input.displaySpec : normalizeWidgetDisplaySpec(input.displaySpec),
      } : null;
      const response = kind === "delete"
        ? await axiosClient.delete<unknown>(widgetPath(id!), WIDGET_WRITE)
        : await axiosClient.post<unknown>(kind === "create" ? WIDGETS_PATH : widgetClonePath(id!), kind === "create" ? content : buildCloneWidgetRequest(name), WIDGET_WRITE);
      if (!safety.currentWrite(ticket)) throw new Error("Widget write scope changed.");
      let createdId: string | null = null;
      if (kind === "delete") assertWidgetStatus(response, 204);
      else {
        assertWidgetStatus(response, 201);
        const receipt = parseWidgetDraftState(response.data);
        const draft = receipt.draft;
        if (!draft || receipt.widgetId === id || receipt.activeVersionNumber !== null || draft.baseVersionNumber !== null
          || receipt.widgetRevision !== 1 || receipt.governanceRevision !== 1 || draft.revision !== 1 || draft.updatedByUserId !== user?.id) throw new Error("Invalid initial widget draft.");
        if (content && (draft.name !== content.name || draft.visualizationType !== content.visualizationType
          || !sameWidgetValue(draft.querySpec, content.querySpec) || !sameWidgetValue(draft.displaySpec, content.displaySpec))) throw new Error("Widget draft receipt changed the requested definition.");
        if (kind === "clone") {
          const requestedName = name.trim();
          if (!draft.name.trim() || !draft.visualizationType || (requestedName && draft.name !== requestedName)) {
            throw new Error("Cloned draft receipt does not match.");
          }
          parseQuerySpec(draft.querySpec);
        }
        createdId = receipt.widgetId;
      }
      const refreshed = await load(undefined, undefined, ticket);
      if (!refreshed) safety.fence(ticket);
      return { ok: true, replayed: isIdempotentReplay(response.headers), createdId, error: null, reconciled: refreshed };
    } catch (caught) {
      const failure = widgetFailure(caught);
      if (failure.error?.status === 403) setWriteDenied(scope);
      if (failure.uncertain) { safety.fence(ticket); failure.reconciled = await load(undefined, undefined, ticket); }
      return { ...failure, stale: !safety.currentWrite(ticket) };
    } finally { const active = safety.currentWrite(ticket); safety.finish(ticket); if (active) setPending(null); }
  };
  const visible = canRead && snapshot?.scope === scope ? snapshot : null;
  const active = visible?.path === path ? visible : null;
  const items = queryError?.status === 403 ? EMPTY : active?.items ?? EMPTY;
  const changeFilters = (next: Partial<WidgetLibraryFilters>) => {
    if (!safety.isPending()) setFilterState(current => ({ scope, value: { ...(current.scope === scope ? current.value : DEFAULT_FILTERS), ...next } }));
  };
  return { scope, items, allItems: items, catalog: visible?.catalog ?? null, catalogFailed: visible?.catalogFailed ?? false,
    hasLoaded: !!active && queryError?.status !== 403, isLoading: canRead && (!active && !queryError || queryLoading),
    queryError, filters, searchQuery: search, setSearchQuery: (value: string) => changeFilters({ search: value.slice(0, WIDGET_LIBRARY_SEARCH_LIMIT) }),
    setAccess: (value: WidgetLibraryFilters["access"]) => { if (value !== access) changeFilters({ access: value, ownerUserId: null }); },
    setStatus: (value: WidgetLibraryFilters["status"]) => changeFilters({ status: value }),
    setSource: (value: WidgetLibraryFilters["source"]) => changeFilters({ source: value }),
    setOwner: (value: string | null) => changeFilters({ ownerUserId: value }),
    clearFilters: () => changeFilters(DEFAULT_FILTERS),
    canCreate: canCreate && writeDenied !== scope, canDelete: canDelete && writeDenied !== scope, canPreview,
    readOnly: !safety.canMutate || writeDenied === scope, hasMore: !!active?.cursor,
    isSubmitting: pending?.scope === scope && pending.id === "create", pendingId: pending?.scope === scope ? pending.id : null,
    blocked: safety.blocked || safety.busy || !active || !!queryError,
    needsReview: safety.unresolved, reviewReady: safety.reviewedRead, review: safety.review, isPending: safety.isPending,
    loadMore: () => !safety.busy && !queryLoading && active?.cursor ? load(active.cursor) : Promise.resolve(false),
    reload: () => load(undefined, undefined, undefined, true), create: (input: WidgetDraftContent) => execute("create", undefined, input),
    clone: (id: string, name?: string) => execute("clone", id, undefined, name),
    remove: (id: string) => execute("delete", id),
  };
}
