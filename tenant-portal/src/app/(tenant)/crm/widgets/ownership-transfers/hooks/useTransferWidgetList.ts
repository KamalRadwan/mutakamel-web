"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useWidgetSafety } from "../../hooks/useWidgetSafety";
import { assertWidgetStatus, WIDGET_READ } from "../../hooks/widget-requests";
import { parseTransferWidgetPage, widgetTransferSearchPath, WIDGET_TRANSFER_LIST_PATH, type TransferWidget } from "../../widget-ownership-transfer-contract";

type Snapshot = {
  scope: string; items: TransferWidget[]; cursor: string | null; search: string;
  loading: boolean; error: NormalizedApiError | null;
};

export function useTransferWidgetList() {
  const { scope, busy, startRead, currentRead, isCurrent } = useWidgetSafety("ownership-transfer-list");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState({ scope, value: "" });
  const request = useRef<AbortController | null>(null);
  const visible = snapshot?.scope === scope ? snapshot : null;
  const input = draft.scope === scope ? draft.value : "";

  const load = useCallback(async (search: string, existing?: Snapshot, append = false): Promise<boolean> => {
    const ticket = startRead();
    if (!ticket) return false;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const cursor = append ? existing?.cursor ?? undefined : undefined;
    const base: Snapshot = { scope, search, cursor: cursor ?? null, items: existing?.items ?? [], loading: true, error: null };
    setSnapshot(base);
    try {
      const path = widgetTransferSearchPath(WIDGET_TRANSFER_LIST_PATH, search, cursor);
      const response = await axiosClient.get<unknown>(path, { ...WIDGET_READ, signal: controller.signal });
      assertWidgetStatus(response, 200);
      const page = parseTransferWidgetPage(response.data, cursor);
      if (controller.signal.aborted || !currentRead(ticket)) return false;
      setSnapshot({ ...base, items: append ? [...base.items, ...page.items] : page.items, cursor: page.nextCursor, loading: false });
      return true;
    } catch (error) {
      if (!controller.signal.aborted && currentRead(ticket)) setSnapshot({ ...base, loading: false, error: normalizeApiError(error) });
      return false;
    } finally {
      if (request.current === controller && isCurrent()) {
        request.current = null;
        setSnapshot((value) => value === base ? { ...base, loading: false } : value);
      }
    }
  }, [scope, startRead, currentRead, isCurrent]);

  const initialized = visible !== null;
  useEffect(() => {
    if (initialized || busy) return;
    const activation = new AbortController();
    queueMicrotask(() => { if (!activation.signal.aborted) void load(""); });
    return () => activation.abort();
  }, [busy, initialized, load]);
  useEffect(() => () => request.current?.abort(), [scope]);

  return { visible, input, setInput: (value: string) => setDraft({ scope, value }),
    search: () => void load(input.trim()), refresh: () => load(visible?.search ?? "", visible ?? undefined),
    more: () => { if (visible?.cursor && !visible.loading) void load(visible.search, visible, true); },
  };
}
