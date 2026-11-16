"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../trade-api";
import { parseTradeArray } from "../../../trade-advanced-validation";
import { INVENTORY_NODES_PATH, invalidResponse, parseInventoryNode, type InventoryNode } from "../../inventory-contract";
import { inventoryFormMessage, inventoryMessage } from "../../inventory-messages";

export function useMovementNodes(headers: Record<string, string>, scopeKey: string, enabled: boolean) {
  const { t } = useI18n();
  const request = useMemo(() => ({ headers, scopeKey, enabled, t }), [headers, scopeKey, enabled, t]);
  const [result, setResult] = useState<{ request: object; nodes: InventoryNode[]; error: string | null } | null>(null);
  const current = result?.request === request ? result : null;
  useEffect(() => {
    if (!request.enabled) return;
    const controller = new AbortController();
    void tradeGet(INVENTORY_NODES_PATH, { headers: request.headers, signal: controller.signal, maxResponseBytes: 120_000 })
      .then(response => {
        if (!controller.signal.aborted) setResult({ request, nodes: parseTradeArray(response.data, parseInventoryNode, invalidResponse), error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ request, nodes: [], error: inventoryMessage(normalizeApiError(error), request.t) ?? inventoryFormMessage(error, request.t) });
      });
    return () => controller.abort();
  }, [request]);
  return { knownNodes: current?.nodes ?? [], nodesError: current?.error ?? null };
}
