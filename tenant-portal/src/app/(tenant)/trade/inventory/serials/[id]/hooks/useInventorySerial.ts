"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../../trade-advanced-scope";
import { isUuidV7 } from "../../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../../inventory-contract";
import { useInventoryReferences } from "../../../hooks/useInventoryReferences";
import { parseInventorySerialDetail, serialPath, type InventorySerialDetail } from "../../../inventory-governance-contract";

export function useInventorySerial(id: string) {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { branchId } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const scopeKey = JSON.stringify([id, scope.headers, user?.id, realtimeAuthGeneration, lang]);
  const key = useMemo(() => ({ scopeKey }), [scopeKey]);
  const currentKey = useRef(key);
  useLayoutEffect(() => { currentKey.current = key; }, [key]);
  const references = useInventoryReferences({ headers: scope.headers, scopeKey, enabled: scope.isResolved && canRead });
  const { canCatalog, ensureItem, ensureUom } = references;
  const [result, setResult] = useState<{ key: typeof key; serial: InventorySerialDetail } | null>(null);
  const [pending, setPending] = useState<typeof key | null>(null);
  const [failure, setFailure] = useState<{ key: typeof key; error: NormalizedApiError } | null>(null);
  const serial = result?.key === key ? result.serial : null;
  const queryError = failure?.key === key ? failure.error : null;
  const validId = isUuidV7(id);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!scope.isResolved || !canRead || !validId) return;
    setPending(key);
    setFailure(null);
    try {
      const response = await tradeGet(serialPath(id), { signal, headers: scope.headers, maxResponseBytes: 1_000_000 });
      if (signal?.aborted || currentKey.current !== key) return;
      setResult({ key, serial: parseInventorySerialDetail(response.data) });
    } catch (error) {
      if (!signal?.aborted && currentKey.current === key) setFailure({ key, error: normalizeApiError(error) });
    } finally { if (!signal?.aborted && currentKey.current === key) setPending(null); }
  }, [scope.isResolved, scope.headers, canRead, validId, key, id]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!serial || !canCatalog) return;
    void ensureItem(serial.itemId).catch(() => undefined);
    const ids = [...new Set([serial.currentUomId, ...serial.lifecycle.map((event) => event.uomId)].filter((value): value is string => Boolean(value)))];
    void Promise.allSettled(ids.map(ensureUom));
  }, [serial, canCatalog, ensureItem, ensureUom]);

  return { t, lang, canRead, isScopeResolved: scope.isResolved, serial, references, queryError,
    isLoading: validId && scope.isResolved && canRead && !serial && !queryError,
    isRefreshing: pending === key, isNotFound: !validId || queryError?.status === 404, reload: () => load() };
}
