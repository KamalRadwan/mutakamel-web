"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch } from "../../../../trade-api";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../../trade-advanced-scope";
import { useInventoryWriteIntent } from "../../../hooks/useInventoryWriteIntent";
import { INVENTORY_NODES_MANAGE_PERMISSION, INVENTORY_READ_PERMISSION, buildUpdateNodeRequest, inventoryNodePath, parseInventoryNodeDetail, type InventoryNodeDetail, type NodeFormValues } from "../../../inventory-contract";
import { inventoryFormMessage, inventoryMessage } from "../../../inventory-messages";

export function useInventoryNode(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { branchId } = useTradeBranchSelection(user);
  const readScope = useTradeScope("BRANCH", branchId);
  const writeScope = useTradeScope("COMPANY", branchId);
  const { patch, complete, hasPending, retry, canRetry } = useInventoryWriteIntent(JSON.stringify([user?.id, realtimeAuthGeneration, branchId]));
  const identityKey = JSON.stringify([id, readScope.headers, writeScope.headers, user?.id, realtimeAuthGeneration, lang]);
  const identity = useMemo(() => ({ key: identityKey }), [identityKey]);
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  const [result, setResult] = useState<{ identity: typeof identity; node: InventoryNodeDetail } | null>(null);
  const [failure, setFailure] = useState<{ identity: typeof identity; error: NormalizedApiError } | null>(null);
  const [loading, setLoading] = useState<typeof identity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFailure, setFormFailure] = useState<{ identity: typeof identity; message: string } | null>(null);
  const [editScope, setEditScope] = useState<typeof identity | null>(null);
  const [conflictScope, setConflictScope] = useState<typeof identity | null>(null);
  const [draft, setDraft] = useState<{ identity: typeof identity; values: NodeFormValues } | null>(null);
  const canRead = hasTradePermission(readScope.permissions, readScope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const canManage = hasTradePermission(writeScope.permissions, writeScope.isTenantOwner, INVENTORY_NODES_MANAGE_PERMISSION);
  const queryError = failure?.identity === identity ? failure.error : null;
  const node = result?.identity === identity ? result.node : null;
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!readScope.isResolved || !canRead) return;
    setLoading(identity); setFailure(null);
    try {
      const response = await tradeGet(inventoryNodePath(id), { signal, headers: readScope.headers, maxResponseBytes: 40_000 });
      if (signal?.aborted || currentIdentity.current !== identity) return;
      setResult({ identity, node: parseInventoryNodeDetail(response.data) });
    } catch (error) { if (!signal?.aborted && currentIdentity.current === identity) setFailure({ identity, error: normalizeApiError(error) }); }
    finally { if (!signal?.aborted && currentIdentity.current === identity) setLoading(null); }
  }, [id, readScope.isResolved, readScope.headers, canRead, identity]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load]);
  const update = useCallback(async (values?: NodeFormValues) => {
    if (!canManage || !node || isSubmitting) return false;
    setIsSubmitting(true); setFormFailure(null); if (values && !hasPending()) setDraft({ identity, values });
    try {
      const body = values ? buildUpdateNodeRequest(node, values) : undefined;
      if (body && Object.keys(body).length === 0) { setEditScope(null); return true; }
      const headers = { ...writeScope.headers, "If-Match": tradeIfMatch(node.version) };
      const response = body ? await patch(inventoryNodePath(node.id), body, headers, 40_000) : await retry(inventoryNodePath(node.id), headers);
      parseInventoryNodeDetail(response.data); complete();
      if (currentIdentity.current !== identity) return false;
      setEditScope(null); setDraft(null); toast.success(t.tradeCommon.savedTitle, t.tradeInventory.nodeUpdated); await load(); return true;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (currentIdentity.current === identity) {
        if (normalized.code === "TRADE.CONCURRENCY.STALE_VERSION") setConflictScope(identity);
        else setFormFailure({ identity, message: inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t) });
      }
      return false;
    } finally { setIsSubmitting(false); }
  }, [canManage, node, isSubmitting, patch, complete, hasPending, retry, writeScope.headers, identity, t, toast, load]);
  return { t, lang, canRead, canManage, node, isLoading: readScope.isResolved && canRead && !node && !queryError, isRefreshing: loading === identity, queryError, isNotFound: queryError?.status === 404,
    isSubmitting, formError: formFailure?.identity === identity ? formFailure.message : null, editOpen: editScope === identity, conflictOpen: conflictScope === identity,
    editDraft: draft?.identity === identity ? draft.values : undefined,
    unresolved: !isSubmitting && hasPending(), retryOriginal: () => update(), canRetryOriginal: Boolean(node && canRetry(inventoryNodePath(node.id), { ...writeScope.headers, "If-Match": tradeIfMatch(node.version) })),
    openEdit: () => { if (!hasPending()) setDraft(null); setFormFailure(null); setEditScope(identity); }, closeEdit: () => { if (!isSubmitting && !hasPending()) { setEditScope(null); setFormFailure(null); } },
    resolveConflict: () => { setConflictScope(null); void load(); }, dismissConflict: () => setConflictScope(null), update, reload: () => load() };
}
