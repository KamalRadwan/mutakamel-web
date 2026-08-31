"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradePost } from "../../../trade-api";
import { parseTradeArray } from "../../../trade-advanced-validation";
import { hasTradePermission, tradeScopeHeaders, useTradeScope } from "../../../trade-advanced-scope";
import { tradeGet } from "../../../trade-api";
import {
  INVENTORY_NODES_MANAGE_PERMISSION,
  INVENTORY_NODES_PATH,
  INVENTORY_READ_PERMISSION,
  buildCreateNodeRequest,
  invalidResponse,
  parseInventoryNode,
  type InventoryNode,
  type NodeFormValues,
} from "../../inventory-contract";
import { inventoryFormMessage, inventoryMessage } from "../../inventory-messages";

const NODES_RESPONSE_LIMIT_BYTES = 200_000;
const NODE_RESPONSE_LIMIT_BYTES = 20_000;

/**
 * `GET /inventory/nodes` is `BRANCH`-scoped and `POST /inventory/nodes` is
 * `COMPANY`-scoped — the same neighbouring-route disagreement `/uoms` has.
 * One "inventory context" would send the wrong headers on half this screen, so
 * the two calls build their headers separately from the same selection.
 */
export function useInventoryNodes() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const readScope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<InventoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const canRead = hasTradePermission(
    readScope.permissions,
    readScope.isTenantOwner,
    INVENTORY_READ_PERMISSION,
  );
  const canManage = hasTradePermission(
    readScope.permissions,
    readScope.isTenantOwner,
    INVENTORY_NODES_MANAGE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!readScope.isResolved) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(INVENTORY_NODES_PATH, {
          signal,
          headers: readScope.headers,
          maxResponseBytes: NODES_RESPONSE_LIMIT_BYTES,
        });
        // The handler ends in TypeORM's getMany(): `data` is the array itself,
        // with no `items` wrapper and no `total`.
        setItems(parseTradeArray(response.data, parseInventoryNode, invalidResponse));
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [readScope.isResolved, readScope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = useCallback(
    async (values: NodeFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateNodeRequest(values);
        const response = await tradePost(INVENTORY_NODES_PATH, request, {
          // A node write targets COMPANY even though the list beside it is
          // BRANCH — sending the branch header here narrows the resolved
          // target and the create is refused.
          headers: tradeScopeHeaders(user, branchId, "COMPANY"),
          maxResponseBytes: NODE_RESPONSE_LIMIT_BYTES,
        });
        setCreateOpen(false);
        // `Idempotency-Replayed` is set to "false" on first execution, so
        // presence is not replay — only "true" is, and a replay is a success.
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeInventory.nodeCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        const specific = inventoryMessage(normalized, t);
        if (specific) {
          setFormError(specific);
          return false;
        }
        setFormError(inventoryFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, user, branchId, toast, t, load],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    isScopeResolved: readScope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setCreateOpen(false);
    },
    create,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
