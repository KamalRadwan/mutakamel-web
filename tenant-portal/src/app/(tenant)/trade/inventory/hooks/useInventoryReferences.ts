"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import type { TradePath } from "@/lib/api/envelope";
import { tradeGet } from "../../trade-api";
import { useTradeBranchSelection, useTradeScope, hasTradePermission } from "../../trade-advanced-scope";
import { record, tradeLocalizedName } from "../../trade-validation";
import { ITEMS_PATH, itemPath } from "../../items/item-contract";
import { parseUomResponse, uomPath } from "../../uoms/uom-contract";
import { INVENTORY_NODES_PATH, INVENTORY_READ_PERMISSION, invalidResponse, parseInventoryNode, type InventoryNode } from "../inventory-contract";
import { parseInventoryReferenceItem, type InventoryReferenceItem, type InventoryReferenceUom } from "../inventory-reference-contract";
import { loadInventoryUnits } from "../inventory-reference-loader";

interface Options { headers: Record<string, string>; scopeKey: string; enabled: boolean }
interface Directory {
  key: string;
  identity: object;
  items: InventoryReferenceItem[];
  known: Record<string, InventoryReferenceItem>;
  nodes: InventoryNode[];
  uoms: InventoryReferenceUom[];
  error: NormalizedApiError | null;
  itemError: NormalizedApiError | null;
  uomError: NormalizedApiError | null;
  nodeError: NormalizedApiError | null;
  loading: boolean;
}
const EMPTY: Omit<Directory, "key" | "identity"> = { items: [], known: {}, nodes: [], uoms: [], error: null, itemError: null, uomError: null, nodeError: null, loading: false };
const LIMIT_BYTES = 1_500_000;
function mergeKnownItems(known: Directory["known"], items: InventoryReferenceItem[]): Directory["known"] {
  const merged = { ...known };
  for (const item of items) {
    const cached = known[item.id];
    merged[item.id] = cached && cached.trackInventory !== null ? cached : item;
  }
  return merged;
}

/** Authorized naming directory. UUIDs remain values, never a display fallback. */
export function useInventoryReferences({ headers, scopeKey, enabled }: Options) {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const authKey = useAuthScopeKey(user);
  const { branchId } = useTradeBranchSelection(user);
  const nodeScope = useTradeScope("BRANCH", branchId);
  const canCatalog = can(user, "trade.items.read", {
    companyId: headers[COMPANY_SCOPE_HEADER],
    ...(headers[BRANCH_SCOPE_HEADER] ? { branchId: headers[BRANCH_SCOPE_HEADER] } : {}),
  });
  const canNodes = nodeScope.isResolved && hasTradePermission(nodeScope.permissions, nodeScope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const key = JSON.stringify([authKey, realtimeAuthGeneration, scopeKey, headers, nodeScope.headers, lang, enabled, canCatalog, canNodes]);
  const identity = useMemo(() => ({ key }), [key]);
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  const searchRequest = useRef(0);
  const searchIntent = useRef({ identity, query: "" });
  const [directory, setDirectory] = useState<Directory>({ key, identity, ...EMPTY });
  const directoryRef = useRef(directory);
  useLayoutEffect(() => { directoryRef.current = directory; }, [directory]);
  const [attempt, setAttempt] = useState(0);
  const active = directory.identity === identity && enabled ? directory : { key, identity, ...EMPTY };

  const loadItems = useCallback(async (search: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: "1", limit: "100", status: "ACTIVE", itemKind: "PRODUCT" });
    if (search.trim()) query.set("search", search.trim());
    const response = await tradeGet(`${ITEMS_PATH}?${query}` as TradePath, { headers, signal, maxResponseBytes: LIMIT_BYTES });
    const page = record(response.data);
    if (!page || !Array.isArray(page.items)) invalidResponse();
    return page.items.map((item) => parseInventoryReferenceItem(item, lang));
  }, [headers, lang]);

  useEffect(() => {
    const controller = new AbortController();
    const initialSearch = searchRequest.current;
    const initialQuery = searchIntent.current.identity === identity ? searchIntent.current.query : "";
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setDirectory((state) => state.identity === identity
        ? { ...state, loading: enabled }
        : { key, identity, ...EMPTY, loading: enabled });
      if (!enabled) return;
      void Promise.allSettled([
        canCatalog ? loadItems(initialQuery, controller.signal) : Promise.resolve([]),
        canCatalog ? loadInventoryUnits(headers, lang, controller.signal) : Promise.resolve([]),
        canNodes ? tradeGet(INVENTORY_NODES_PATH, { headers: nodeScope.headers, signal: controller.signal, maxResponseBytes: LIMIT_BYTES }).then((response) => {
          if (!Array.isArray(response.data)) invalidResponse();
          return response.data.map(parseInventoryNode);
        }) : Promise.resolve([]),
      ]).then(([items, uoms, nodes]) => {
        if (controller.signal.aborted || currentIdentity.current !== identity) return;
        const found = items.status === "fulfilled" ? items.value : [];
        setDirectory((state) => {
          if (state.identity !== identity) return state;
          const initialItemsAreCurrent = searchRequest.current === initialSearch;
          const itemError = initialItemsAreCurrent ? items.status === "rejected" ? normalizeApiError(items.reason) : null : state.itemError;
          const uomError = uoms.status === "rejected" ? normalizeApiError(uoms.reason) : null;
          const nodeError = nodes.status === "rejected" ? normalizeApiError(nodes.reason) : null;
          // Detail hydration and remote search may finish while the unit pages are still loading.
          const known = mergeKnownItems(state.known, found);
          return { ...state, items: initialItemsAreCurrent ? found.map(item => known[item.id]) : state.items, known,
            uoms: uoms.status === "fulfilled" ? uoms.value : [], nodes: nodes.status === "fulfilled" ? nodes.value : [],
            itemError, uomError, nodeError, error: itemError ?? uomError ?? nodeError, loading: false };
        });
      });
    });
    return () => { controller.abort(); searchRequest.current += 1; };
  }, [key, identity, enabled, canCatalog, canNodes, headers, nodeScope.headers, lang, loadItems, attempt]);

  const searchItems = useCallback(async (query: string) => {
    if (!enabled || !canCatalog) return;
    searchIntent.current = { identity, query };
    const request = ++searchRequest.current;
    try {
      const items = await loadItems(query);
      if (currentIdentity.current !== identity || request !== searchRequest.current) return;
      setDirectory((state) => {
        if (state.identity !== identity) return state;
        const known = mergeKnownItems(state.known, items);
        return { ...state, items: items.map(item => known[item.id]), itemError: null, error: state.uomError ?? state.nodeError, known };
      });
    } catch (error) {
      if (currentIdentity.current === identity && request === searchRequest.current) setDirectory((state) => state.identity === identity ? { ...state, error: normalizeApiError(error), itemError: normalizeApiError(error) } : state);
    }
  }, [canCatalog, enabled, identity, loadItems]);

  const ensureItem = useCallback(async (id: string) => {
    if (!enabled || !canCatalog) throw new Error(t.common.nameUnavailable);
    const response = await tradeGet(itemPath(id), { headers, maxResponseBytes: LIMIT_BYTES });
    const item = parseInventoryReferenceItem(response.data, lang, true);
    if (currentIdentity.current === identity) setDirectory((state) => state.identity === identity ? { ...state, known: { ...state.known, [id]: item }, items: state.items.map((row) => row.id === id ? item : row) } : state);
    return item;
  }, [canCatalog, enabled, headers, identity, lang, t.common.nameUnavailable]);

  const ensureUom = useCallback(async (id: string) => {
    if (!enabled || !canCatalog) return;
    const response = await tradeGet(uomPath(id), { headers, maxResponseBytes: LIMIT_BYTES });
    const unit = parseUomResponse(response.data);
    const found = { id: unit.id, code: unit.code, name: tradeLocalizedName(unit.localizedNames, lang) || unit.displayName };
    if (currentIdentity.current === identity) setDirectory((state) => state.identity === identity ? { ...state, uoms: [...state.uoms.filter((row) => row.id !== id), found] } : state);
  }, [canCatalog, enabled, headers, identity, lang]);

  const ensureProfiles = useCallback(async (ids: readonly string[]) => {
    if (!enabled || !canCatalog || ids.length === 0) return [];
    const known = directoryRef.current.identity === identity ? Object.values(directoryRef.current.known) : [];
    const matches = known.filter((item) => item.profileId && ids.includes(item.profileId));
    const missing = new Set(ids.filter((id) => !known.some((item) => item.profileId === id)));
    // There is no profile-id resolver. Page the authorized item catalogue,
    // including inactive items, until the requested historical labels are found.
    for (let pageNumber = 1; missing.size > 0; pageNumber += 1) {
      if (currentIdentity.current !== identity) return [];
      const query = new URLSearchParams({ page: String(pageNumber), limit: "100", itemKind: "PRODUCT" });
      const response = await tradeGet(`${ITEMS_PATH}?${query}` as TradePath, { headers, maxResponseBytes: LIMIT_BYTES });
      const page = record(response.data);
      if (!page || !Array.isArray(page.items) || typeof page.total !== "number" || !Number.isSafeInteger(page.total) || page.total < 0) invalidResponse();
      const items = page.items.map((item) => parseInventoryReferenceItem(item, lang));
      if (currentIdentity.current !== identity) return [];
      for (const item of items) if (item.profileId && missing.delete(item.profileId)) matches.push(item);
      setDirectory((state) => state.identity === identity ? { ...state, known: { ...state.known, ...Object.fromEntries(items.map((item) => [item.id, item])) } } : state);
      if (page.items.length === 0 || pageNumber * 100 >= page.total) return matches;
    }
    return matches;
  }, [canCatalog, enabled, headers, identity, lang]);

  const itemLabel = (id: string) => active.known[id] ? `${active.known[id].name} · ${active.known[id].code}` : t.common.nameUnavailable;
  const profileLabel = (id: string) => { const item = Object.values(active.known).find((row) => row.profileId === id); return item ? `${item.name} · ${item.code}` : t.common.nameUnavailable; };
  const nodeLabel = (id: string) => { const node = active.nodes.find((row) => row.id === id); return node ? `${node.name} · ${node.code}` : t.common.nameUnavailable; };
  const uomLabel = (id: string) => { const unit = active.uoms.find((row) => row.id === id); return unit ? `${unit.name} · ${unit.code}` : t.common.nameUnavailable; };
  return { items: active.items, nodes: active.nodes, uoms: active.uoms, isLoading: active.loading,
    error: active.error, itemError: active.itemError, nodeError: active.nodeError, uomError: active.uomError,
    canCatalog, canNodes, searchItems, ensureItem, ensureUom, ensureProfiles,
    refresh: () => setAttempt((value) => value + 1), itemLabel, profileLabel, nodeLabel, uomLabel };
}
