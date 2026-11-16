"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format/number";
import { tradeGet } from "../../../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../../trade-advanced-scope";
import { isUuidV7, record, tradeStatusLabel } from "../../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../../inventory-contract";
import { inventoryDecisionPath, parseInventoryDecision, type InventoryDecision } from "../../../inventory-governance-contract";

export function useInventoryDecision(id: string) {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { branchId } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const scopeKey = JSON.stringify([id, scope.headers, user?.id, realtimeAuthGeneration, lang]);
  const key = useMemo(() => ({ scopeKey }), [scopeKey]);
  const currentKey = useRef(key);
  useLayoutEffect(() => { currentKey.current = key; }, [key]);
  const [result, setResult] = useState<{ key: typeof key; decision: InventoryDecision } | null>(null);
  const [pending, setPending] = useState<typeof key | null>(null);
  const [failure, setFailure] = useState<{ key: typeof key; error: NormalizedApiError } | null>(null);
  const decision = result?.key === key ? result.decision : null;
  const queryError = failure?.key === key ? failure.error : null;
  const validId = isUuidV7(id);
  const branchIds = useMemo(() => decision?.branchId ? [decision.branchId] : [], [decision]);
  const branches = useTenantOrganizationOptions("branch", branchIds);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!scope.isResolved || !canRead || !validId) return;
    setPending(key);
    setFailure(null);
    try {
      const response = await tradeGet(inventoryDecisionPath(id), { signal, headers: scope.headers, maxResponseBytes: 500_000 });
      if (signal?.aborted || currentKey.current !== key) return;
      setResult({ key, decision: parseInventoryDecision(response.data) });
    } catch (error) {
      if (!signal?.aborted && currentKey.current === key) setFailure({ key, error: normalizeApiError(error) });
    } finally { if (!signal?.aborted && currentKey.current === key) setPending(null); }
  }, [scope.isResolved, scope.headers, canRead, validId, key, id]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load]);

  const policyRows = (decision?.policyVersions ?? []).map((value, index) => {
    const row = record(value);
    return { key: typeof row?.id === "string" ? row.id : String(index),
      code: typeof row?.definitionCode === "string" ? row.definitionCode : t.tradeInventory.readViews.notSet,
      version: typeof row?.version === "number" && Number.isSafeInteger(row.version) ? formatNumber(row.version, lang) : t.tradeInventory.readViews.notSet };
  });
  const selectedValue = decision?.selectedValue;
  const selectedLabel = typeof selectedValue === "string" ? tradeStatusLabel(t.tradeStatus, selectedValue, selectedValue)
    : typeof selectedValue === "number" ? formatNumber(selectedValue, lang)
    : typeof selectedValue === "boolean" ? (selectedValue ? t.tradeInventory.readViews.booleanYes : t.tradeInventory.readViews.booleanNo)
    : selectedValue == null ? t.tradeInventory.readViews.notSet : t.tradeInventory.readViews.structuredValue;
  const aggregateLabel = decision ? tradeStatusLabel(t.tradeInventory.readViews.aggregates, decision.aggregateType, t.common.unknownCode) : t.tradeInventory.readViews.notSet;
  const branchLabel = decision?.branchId ? branches.find((branch) => branch.value === decision.branchId)?.label ?? t.common.nameUnavailable : t.tradeInventory.readViews.notSet;
  return { t, lang, canRead, isScopeResolved: scope.isResolved, decision, queryError, policyRows, selectedLabel, aggregateLabel, branchLabel,
    isLoading: validId && scope.isResolved && canRead && !decision && !queryError,
    isRefreshing: pending === key, isNotFound: !validId || queryError?.status === 404, reload: () => load() };
}
