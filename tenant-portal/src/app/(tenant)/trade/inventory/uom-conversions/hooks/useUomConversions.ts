"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradeIfMatch, tradePost } from "../../../trade-api";
import { parseTradeArray } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  INVENTORY_GOVERNANCE_PERMISSION,
  INVENTORY_READ_PERMISSION,
  invalidResponse,
} from "../../inventory-contract";
import {
  INVENTORY_UOM_CONVERSIONS_PATH,
  buildCreateUomConversionRequest,
  buildReasonCode,
  parseInventoryUomConversion,
  uomConversionActionPath,
  uomConversionsListPath,
  type InventoryUomConversion,
  type UomConversionFormValues,
  type UomConversionStatus,
} from "../../inventory-governance-contract";
import { inventoryFormMessage, inventoryMessage } from "../../inventory-messages";

const LIST_RESPONSE_LIMIT_BYTES = 120_000;
const ROW_RESPONSE_LIMIT_BYTES = 20_000;

type PendingAction = { id: string; action: "publish" | "retire" } | null;

export function useUomConversions() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [items, setItems] = useState<InventoryUomConversion[]>([]);
  const [statusFilter, setStatusFilter] = useState<UomConversionStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [transition, setTransition] = useState<PendingAction>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    INVENTORY_READ_PERMISSION,
  );
  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    INVENTORY_GOVERNANCE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!scope.isResolved) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(uomConversionsListPath(statusFilter), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        setItems(parseTradeArray(response.data, parseInventoryUomConversion, invalidResponse));
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [scope.isResolved, scope.headers, statusFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = useCallback(
    async (values: UomConversionFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          INVENTORY_UOM_CONVERSIONS_PATH,
          buildCreateUomConversionRequest(values),
          { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeInventory.conversionCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, scope.headers, toast, t, load],
  );

  const runTransition = useCallback(
    async (reason: string): Promise<void> => {
      if (!canManage || !transition || pending) return;
      const target = items.find((entry) => entry.id === transition.id);
      if (!target) return;
      setPending(transition);
      try {
        await tradePost(
          uomConversionActionPath(target.id, transition.action),
          buildReasonCode(reason),
          {
            headers: { ...scope.headers, "If-Match": tradeIfMatch(target.version) },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          },
        );
        toast.success(t.tradeCommon.savedTitle, t.tradeInventory.conversionTransitioned);
        setTransition(null);
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(
            t.tradeInventory.conversionTransitionFailed,
            inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t),
          );
        }
      } finally {
        setPending(null);
        await load();
      }
    },
    [canManage, transition, pending, items, scope.headers, toast, t, load],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    statusFilter,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    pending,
    transition,
    setStatusFilter,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openTransition: (row: InventoryUomConversion, action: "publish" | "retire") =>
      setTransition({ id: row.id, action }),
    closeTransition: () => {
      if (pending) return;
      setTransition(null);
    },
    create,
    runTransition,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
