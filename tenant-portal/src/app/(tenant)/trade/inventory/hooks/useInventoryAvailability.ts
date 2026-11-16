"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../trade-advanced-scope";
import { availabilityPath, buildAvailabilityRequest, EMPTY_AVAILABILITY_FORM, INVENTORY_READ_PERMISSION,
  parseInventoryAvailability, type AvailabilityFormValues, type InventoryAvailability } from "../inventory-contract";
import type { InventoryReferenceItem } from "../inventory-reference-contract";
import { inventoryFormMessage } from "../inventory-messages";
import { useInventoryReferences } from "./useInventoryReferences";

export interface AvailabilityHistoryEntry { key: string; query: AvailabilityFormValues; snapshot: InventoryAvailability; item?: InventoryReferenceItem }
interface State {
  scopeKey: string;
  identity: object;
  values: AvailabilityFormValues;
  result: InventoryAvailability | null;
  history: AvailabilityHistoryEntry[];
  selectedItem: InventoryReferenceItem | null;
  resultQuery: AvailabilityFormValues | null;
  formError: string | null;
  formField: keyof AvailabilityFormValues | null;
  queryError: NormalizedApiError | null;
  loading: boolean;
  itemLoading: boolean;
}
const empty = (scopeKey: string, identity: object): State => ({ scopeKey, identity, values: EMPTY_AVAILABILITY_FORM, result: null, history: [],
  selectedItem: null, resultQuery: null, formError: null, formField: null, queryError: null, loading: false, itemLoading: false });

/** Exact advisory inquiry; actor/scope changes invalidate responses and session snapshots. */
export function useInventoryAvailability() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const actorKey = useAuthScopeKey(user);
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);
  const scopeKey = JSON.stringify([actorKey, realtimeAuthGeneration, scope.headers]);
  const identity = useMemo(() => ({ scopeKey }), [scopeKey]);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const references = useInventoryReferences({ headers: scope.headers, scopeKey, enabled: scope.isResolved && canRead });
  const [stored, setStored] = useState<State>(() => empty(scopeKey, identity));
  const [inspected, setInspected] = useState<{ identity: object; entry: AvailabilityHistoryEntry } | null>(null);
  const inspectorTrigger = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const queryRef = useRef<HTMLDivElement | null>(null);
  const activeKey = useRef(identity);
  useLayoutEffect(() => { activeKey.current = identity; }, [identity]);
  const sequence = useRef(0);
  const itemSequence = useRef(0);
  const state = stored.identity === identity && canRead ? stored : empty(scopeKey, identity);
  useLayoutEffect(() => {
    if (state.formField) queryRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  const update = useCallback((change: Partial<State>) => {
    setStored((previous) => ({ ...(previous.identity === identity ? previous : empty(scopeKey, identity)), ...change }));
  }, [scopeKey, identity]);
  useEffect(() => () => { sequence.current += 1; itemSequence.current += 1; }, [identity]);

  const chooseItem = useCallback(async (id: string) => {
    const request = ++itemSequence.current;
    update({ values: { ...state.values, itemId: id, uomId: "", lotKey: "", serialKey: "" }, selectedItem: null, itemLoading: true, formError: null, formField: null });
    try {
      const item = await references.ensureItem(id);
      if (activeKey.current !== identity || request !== itemSequence.current) return;
      setStored((previous) => ({ ...previous, selectedItem: item, itemLoading: false,
        values: { ...previous.values, uomId: item.baseUomId }, formError: item.trackInventory ? null : t.tradeInventory.availabilityItemNotTracked,
        formField: item.trackInventory ? null : "itemId" }));
      void references.ensureUom(item.baseUomId).catch(() => undefined);
    } catch {
      if (activeKey.current === identity && request === itemSequence.current) update({ itemLoading: false, formError: t.tradeInventory.availabilityReferenceUnavailable });
    }
  }, [references, identity, state.values, t.tradeInventory.availabilityItemNotTracked, t.tradeInventory.availabilityReferenceUnavailable, update]);

  const executeLookup = useCallback(async (values: AvailabilityFormValues) => {
    if (!canRead || !scope.isResolved) return;
    const request = ++sequence.current;
    update({ loading: true, formError: null, formField: null, queryError: null });
    let query: AvailabilityFormValues;
    let item: InventoryReferenceItem;
    let trackingField: keyof AvailabilityFormValues = values.lotKey.length > 120 ? "lotKey" : "serialKey";
    try {
      query = buildAvailabilityRequest(values);
      item = state.selectedItem?.id === query.itemId ? state.selectedItem : await references.ensureItem(query.itemId);
      trackingField = item.trackingMode === "LOT" ? "lotKey" : "serialKey";
      if (!item.trackInventory) throw new Error("INVENTORY_FORM_ITEM");
      if ((item.trackingMode === "LOT" && !query.lotKey.trim()) || (item.trackingMode === "SERIAL" && !query.serialKey.trim())) throw new Error("INVENTORY_FORM_TRACKING");
      if (item.trackingMode === "NONE" && (query.lotKey || query.serialKey)) throw new Error("INVENTORY_FORM_TRACKING");
    } catch (error) {
      const fields: Record<string, keyof AvailabilityFormValues> = {
        INVENTORY_FORM_NODE: "nodeId", INVENTORY_FORM_ITEM: "itemId", INVENTORY_FORM_UOM: "uomId",
        INVENTORY_FORM_TRACKING: trackingField,
      };
      if (activeKey.current === identity && request === sequence.current) update({ loading: false,
        formError: inventoryFormMessage(error, t), formField: error instanceof Error ? fields[error.message] ?? null : null });
      return;
    }
    if (activeKey.current !== identity || request !== sequence.current) return;
    try {
      const response = await tradeGet(availabilityPath(query), { headers: scope.headers, maxResponseBytes: 8_000 });
      if (activeKey.current !== identity || request !== sequence.current) return;
      const result = parseInventoryAvailability(response.data);
      const key = JSON.stringify([result.nodeId, result.itemId, result.uomId, query.lotKey, query.serialKey]);
      setStored((previous) => ({ ...previous, result, resultQuery: query, loading: false,
        selectedItem: previous.values.itemId === query.itemId ? item : previous.selectedItem,
        history: [{ key, query, snapshot: result, item }, ...previous.history.filter((row) => row.key !== key)].slice(0, 12) }));
    } catch (error) {
      if (activeKey.current === identity && request === sequence.current) update({ loading: false, queryError: normalizeApiError(error) });
    }
  }, [canRead, references, scope.headers, scope.isResolved, identity, state.selectedItem, t, update]);

  return { t, lang, canRead, isScopeResolved: scope.isResolved, branchIds, branchId, selectBranch,
    ...state, references,
    inspected: inspected?.identity === identity && canRead ? inspected.entry : null,
    setInspected: (entry: AvailabilityHistoryEntry | null) => {
      if (entry) inspectorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setInspected(entry ? { identity, entry } : null);
    },
    headingRef, queryRef,
    restoreInspectorFocus: () => {
      if (inspectorTrigger.current?.isConnected) inspectorTrigger.current.focus();
      else headingRef.current?.focus();
    },
    knownNodes: references.nodes, isLoading: state.loading,
    setValue: (field: keyof AvailabilityFormValues, value: string) => update({ values: { ...state.values, [field]: value }, formError: null, formField: null }),
    chooseItem,
    reset: () => { sequence.current += 1; itemSequence.current += 1; setStored(empty(scopeKey, identity)); setInspected(null); },
    lookUp: () => executeLookup(state.values),
    refreshSnapshot: () => state.resultQuery ? executeLookup(state.resultQuery) : Promise.resolve(),
    clearHistory: () => update({ history: [] }),
    selectHistoryEntry: (entry: AvailabilityHistoryEntry, requery = false) => {
      sequence.current += 1; itemSequence.current += 1;
      update({ values: entry.query, result: entry.snapshot, resultQuery: entry.query, selectedItem: entry.item ?? null,
        loading: false, itemLoading: false, formError: null, formField: null, queryError: null });
      if (requery) void executeLookup(entry.query);
    },
  };
}
