"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch } from "../../../../trade-api";
import { hasTradePermission, tradeScopeHeaders, useTradeScope } from "../../../../trade-advanced-scope";
import {
  INVENTORY_NODES_MANAGE_PERMISSION,
  INVENTORY_READ_PERMISSION,
  buildUpdateNodeRequest,
  inventoryNodePath,
  parseInventoryNodeDetail,
  type InventoryNodeDetail,
  type NodeFormValues,
} from "../../../inventory-contract";
import { inventoryFormMessage, inventoryMessage } from "../../../inventory-messages";

const NODE_RESPONSE_LIMIT_BYTES = 40_000;

export function useInventoryNode(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const readScope = useTradeScope("BRANCH", branchId);

  const [node, setNode] = useState<InventoryNodeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

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
        const response = await tradeGet(inventoryNodePath(id), {
          signal,
          headers: readScope.headers,
          maxResponseBytes: NODE_RESPONSE_LIMIT_BYTES,
        });
        setNode(parseInventoryNodeDetail(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, readScope.isResolved, readScope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const update = useCallback(
    async (values: NodeFormValues): Promise<boolean> => {
      if (!canManage || !node || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateNodeRequest(node, values);
        if (Object.keys(request).length === 0) {
          setEditOpen(false);
          return true;
        }
        await tradePatch(inventoryNodePath(node.id), request, {
          headers: {
            // The node write targets COMPANY while the read above is BRANCH.
            ...tradeScopeHeaders(user, branchId, "COMPANY"),
            // Trade has one If-Match parser and never answers 428: a missing
            // header is 400 TRADE.CONCURRENCY.IF_MATCH_REQUIRED.
            "If-Match": tradeIfMatch(node.version),
          },
          maxResponseBytes: NODE_RESPONSE_LIMIT_BYTES,
        });
        setEditOpen(false);
        toast.success(t.tradeCommon.savedTitle, t.tradeInventory.nodeUpdated);
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        if (normalized.status === 409) {
          setConflictOpen(true);
          return false;
        }
        setFormError(inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, node, isSubmitting, user, branchId, toast, t, load],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    node,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    isSubmitting,
    formError,
    editOpen,
    conflictOpen,
    openEdit: () => {
      setFormError(null);
      setEditOpen(true);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditOpen(false);
    },
    resolveConflict: () => {
      setConflictOpen(false);
      setEditOpen(false);
      void load();
    },
    dismissConflict: () => setConflictOpen(false),
    update,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
