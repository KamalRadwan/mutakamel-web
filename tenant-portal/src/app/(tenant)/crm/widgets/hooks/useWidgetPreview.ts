"use client";
import { useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { buildCreateWidgetRequest, WIDGET_PREVIEW_PATH } from "../../dashboards/widget-contract";
import { parseWidgetResult, type WidgetResult } from "../../dashboards/dashboard-run-contract";
import type { WidgetAuthoringInput } from "../widget-form";
import { useWidgetSafety } from "./useWidgetSafety";
import { assertWidgetStatus, WIDGET_READ } from "./widget-requests";

export function useWidgetPreview(signature: string, enabled: boolean) {
  const safety = useWidgetSafety("preview");
  const key = JSON.stringify([safety.scope, signature, enabled]);
  const [snapshot, setSnapshot] = useState<{ key: string; result?: WidgetResult; error?: NormalizedApiError; busy: boolean } | null>(null);
  const active = useRef<{ controller: AbortController; key: string } | null>(null);
  useEffect(() => () => { active.current?.controller.abort(); active.current = null; }, [key]);
  const run = async (input: WidgetAuthoringInput) => {
    if (!enabled || !safety.isCurrent() || active.current?.key === key) return;
    active.current?.controller.abort();
    const controller = new AbortController(); active.current = { controller, key };
    setSnapshot({ key, busy: true });
    try {
      const response = await axiosClient.post<unknown>(WIDGET_PREVIEW_PATH, buildCreateWidgetRequest(input), { ...WIDGET_READ, signal: controller.signal, skipAutoIdempotency: true });
      if (controller.signal.aborted || !safety.isCurrent()) return;
      assertWidgetStatus(response, 201);
      const result = parseWidgetResult(response.data);
      if (result.widgetId !== "preview") throw new Error("Invalid preview receipt.");
      setSnapshot({ key, busy: false, result });
    } catch (caught) { if (!controller.signal.aborted && safety.isCurrent()) setSnapshot({ key, busy: false, error: normalizeApiError(caught) }); }
    finally { if (active.current?.controller === controller) active.current = null; }
  };
  return { result: snapshot?.key === key ? snapshot.result ?? null : null, error: snapshot?.key === key ? snapshot.error ?? null : null,
    busy: snapshot?.key === key && snapshot.busy, run };
}
