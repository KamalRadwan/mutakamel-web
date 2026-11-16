"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet } from "../../../trade-api";
import { parseTradeArray } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeBranchSelection, useTradeScope } from "../../../trade-advanced-scope";
import { useInventoryWriteIntent } from "../../hooks/useInventoryWriteIntent";
import { INVENTORY_NODES_MANAGE_PERMISSION, INVENTORY_NODES_PATH, INVENTORY_READ_PERMISSION, buildCreateNodeRequest, invalidResponse, parseInventoryNode, type InventoryNode, type NodeFormValues } from "../../inventory-contract";
import { inventoryFormMessage, inventoryMessage } from "../../inventory-messages";

export function useInventoryNodes() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTradeBranchSelection(user);
  const readScope = useTradeScope("BRANCH", branchId);
  const writeScope = useTradeScope("COMPANY", branchId);
  const identityKey = JSON.stringify([readScope.headers, writeScope.headers, user?.id, realtimeAuthGeneration, lang]);
  const { post, complete, hasPending, retry, canRetry } = useInventoryWriteIntent(JSON.stringify([user?.id, realtimeAuthGeneration, branchId]));
  const identity = useMemo(() => ({ key: identityKey }), [identityKey]);
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => { currentIdentity.current = identity; }, [identity]);
  const [result, setResult] = useState<{ identity: typeof identity; items: InventoryNode[] } | null>(null);
  const [failure, setFailure] = useState<{ identity: typeof identity; error: NormalizedApiError } | null>(null);
  const [loading, setLoading] = useState<typeof identity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFailure, setFormFailure] = useState<{ identity: typeof identity; message: string } | null>(null);
  const [createScope, setCreateScope] = useState<typeof identity | null>(null);
  const [draft, setDraft] = useState<{ identity: typeof identity; values: NodeFormValues } | null>(null);
  const canRead = hasTradePermission(readScope.permissions, readScope.isTenantOwner, INVENTORY_READ_PERMISSION);
  const canManage = hasTradePermission(writeScope.permissions, writeScope.isTenantOwner, INVENTORY_NODES_MANAGE_PERMISSION);
  const queryError = failure?.identity === identity ? failure.error : null;
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!readScope.isResolved || !canRead) return;
    setLoading(identity); setFailure(null);
    try {
      const response = await tradeGet(INVENTORY_NODES_PATH, { signal, headers: readScope.headers, maxResponseBytes: 200_000 });
      if (signal?.aborted || currentIdentity.current !== identity) return;
      setResult({ identity, items: parseTradeArray(response.data, parseInventoryNode, invalidResponse) });
    } catch (error) { if (!signal?.aborted && currentIdentity.current === identity) setFailure({ identity, error: normalizeApiError(error) }); }
    finally { if (!signal?.aborted && currentIdentity.current === identity) setLoading(null); }
  }, [readScope.isResolved, readScope.headers, canRead, identity]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load]);
  const create = useCallback(async (values?: NodeFormValues) => {
    if (!canManage || isSubmitting) return false;
    setIsSubmitting(true); setFormFailure(null);
    if (values && !hasPending()) setDraft({ identity, values });
    try {
      const response = values ? await post(INVENTORY_NODES_PATH, buildCreateNodeRequest(values), writeScope.headers, 20_000) : await retry(INVENTORY_NODES_PATH, writeScope.headers);
      parseInventoryNode(response.data); complete();
      if (currentIdentity.current !== identity) return false;
      setCreateScope(null); setDraft(null); toast.success(t.tradeCommon.savedTitle, isTradeReplay(response.headers) ? t.tradeCommon.replayedDescription : t.tradeInventory.nodeCreated);
      await load(); return true;
    } catch (error) { const normalized = normalizeApiError(error); if (currentIdentity.current === identity) setFormFailure({ identity, message: inventoryMessage(normalized, t) ?? inventoryFormMessage(error, t) }); return false; }
    finally { setIsSubmitting(false); }
  }, [canManage, isSubmitting, post, complete, hasPending, retry, writeScope.headers, identity, t, toast, load]);
  return { t, lang, canRead, canManage, scopeKey: identityKey, scopeIdentity: identity, isScopeResolved: readScope.isResolved, branchIds, branchId, selectBranch,
    items: result?.identity === identity ? result.items : [], isLoading: readScope.isResolved && canRead && result?.identity !== identity && !queryError,
    isRefreshing: loading === identity, hasLoaded: result?.identity === identity, queryError, isSubmitting, formError: formFailure?.identity === identity ? formFailure.message : null,
    createOpen: createScope === identity, unresolved: !isSubmitting && hasPending(), createDraft: draft?.identity === identity ? draft.values : undefined,
    retryOriginal: () => create(), canRetryOriginal: canRetry(INVENTORY_NODES_PATH, writeScope.headers),
    openCreate: () => { setFormFailure(null); setCreateScope(identity); }, closeCreate: () => { if (!isSubmitting && !canRetry(INVENTORY_NODES_PATH, writeScope.headers)) { setCreateScope(null); setDraft(null); } }, create, reload: () => load() };
}
