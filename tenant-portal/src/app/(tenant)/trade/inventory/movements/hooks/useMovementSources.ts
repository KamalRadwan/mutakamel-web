"use client";

import { useEffect, useMemo, useState } from "react";
import type { TradePath } from "@/lib/api/envelope";
import { useI18n } from "@/i18n/I18nContext";
import { tradeGet } from "../../../trade-api";
import { inventoryFormMessage } from "../../inventory-messages";
import { parseMovementSource, parseMovementSources, type MovementSource } from "../movement-source-contract";

export function useMovementSources(kind: "sales" | "purchase", headers: Record<string, string>, enabled: boolean) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<MovementSource | null>(null);
  const [result, setResult] = useState<{ request: object; items: MovementSource[]; total: number; error: string | null } | null>(null);
  const [detail, setDetail] = useState<{ request: object; source: MovementSource | null; error: string | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => ({ kind, headers, enabled, page, revision, t }), [kind, headers, enabled, page, revision, t]);
  const current = result?.request === request ? result : null;
  const detailRequest = useMemo(() => ({ request, id: selection?.id }), [request, selection?.id]);
  const currentDetail = detail?.request === detailRequest ? detail : null;
  const base = kind === "sales"
    ? "/api/tenant/trade/v1/sales-orders"
    : "/api/tenant/trade/v1/purchase-orders";

  useEffect(() => {
    if (!request.enabled) return;
    const controller = new AbortController();
    // Purchase search is deliberately local to this bounded page: its service ignores DTO search.
    void tradeGet(`${base}?status=CONFIRMED&page=${request.page}&limit=100` as TradePath,
      { headers: request.headers, signal: controller.signal, maxResponseBytes: 500_000 })
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ request, ...parseMovementSources(data), error: null }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ request, items: [], total: 0, error: inventoryFormMessage(error, request.t) }); });
    return () => controller.abort();
  }, [request, base]);

  useEffect(() => {
    if (!request.enabled || !detailRequest.id) return;
    const controller = new AbortController();
    void tradeGet(`${base}/${encodeURIComponent(detailRequest.id)}` as TradePath,
      { headers: request.headers, signal: controller.signal, maxResponseBytes: 2_000_000 })
      .then(({ data }) => { if (!controller.signal.aborted) setDetail({ request: detailRequest, source: parseMovementSource(data, true), error: null }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setDetail({ request: detailRequest, source: null, error: inventoryFormMessage(error, request.t) }); });
    return () => controller.abort();
  }, [request, detailRequest, base]);

  return {
    items: current?.items ?? [], total: current?.total ?? 0, page,
    source: currentDetail?.source ?? null,
    selectedId: selection?.id ?? "", selectedLabel: selection?.label ?? "",
    loading: enabled && (!current || (!!selection && !currentDetail)),
    error: current?.error ?? currentDetail?.error ?? null,
    select: (id: string) => setSelection(current?.items.find(item => item.id === id) ?? null),
    previous: () => { setSelection(null); setPage(value => Math.max(1, value - 1)); },
    next: () => { setSelection(null); setPage(value => value + 1); },
    refresh: () => setRevision(value => value + 1),
  };
}
