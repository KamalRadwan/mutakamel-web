import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import type { AxiosResponse } from "@/lib/api/axiosClient";
export const WIDGET_READ = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
export const WIDGET_WRITE = { ...WIDGET_READ, nonReplayable: true } as const;
export interface WidgetWriteResult { ok: boolean; replayed: boolean; createdId: string | null; error: NormalizedApiError | null; uncertain?: boolean; reconciled?: boolean; stale?: boolean; }
export function refusedWidgetWrite(): WidgetWriteResult { return { ok: false, replayed: false, createdId: null, error: null }; }
export function uncertainWidgetWrite(error: NormalizedApiError) {
  if (error.status === 0 || error.status >= 500 || ["GW.IDEM.IN_FLIGHT", "IDEMPOTENCY_REQUEST_PROCESSING"].includes(error.code ?? "")) return true;
  if ([403, 404, 429].includes(error.status)) return false;
  if (["CRM_WIDGET_DRAFT_CONFLICT", "CRM_WIDGET_DRAFT_BASE_CONFLICT", "CRM_WIDGET_DRAFT_INVALID", "CRM_WIDGET_DRAFT_REVISION_LIMIT"].includes(error.code ?? "")) return false;
  const known = ["CRM_WIDGET_REVISION_CONFLICT", "CRM_WIDGET_OWNER_LIMIT", "CRM_WIDGET_VISUALIZATION_INVALID", "CRM_WIDGET_METRIC_INVALID", "CRM_WIDGET_ENGINE_INVALID", "CRM_WIDGET_SERIES_INVALID", "CRM_WIDGET_DIMENSION_INVALID", "CRM_WIDGET_SHAPE_INCOMPATIBLE", "CRM_WIDGET_UNITS_INCOMPATIBLE", "CRM_WIDGET_AXIS_REQUIRED", "CRM_WIDGET_TARGET_REQUIRED", "CRM_WIDGET_TARGET_INVALID", "CRM_WIDGET_COMPARISON_UNSUPPORTED", "CRM_WIDGET_TIME_GRAIN_REQUIRED", "CRM_WIDGET_FILTER_INVALID", "CRM_SHARE_EXPIRY_INVALID", "CRM_SHARE_TARGET_INVALID", "CRM_SHARE_SELF_INVALID", "CRM_VALIDATION_FAILED", "GW.REQUEST.INVALID", "GW.IDEM.MISMATCH", "IDEMPOTENCY_BODY_MISMATCH"];
  return !known.includes(error.code ?? "");
}
export function widgetFailure(caught: unknown): WidgetWriteResult {
  const error = normalizeApiError(caught); return { ...refusedWidgetWrite(), error, uncertain: uncertainWidgetWrite(error) };
}
export function assertWidgetStatus(response: AxiosResponse<unknown>, status: number) {
  if (response.status !== status) throw new Error("Invalid widget receipt status.");
}
export function sameWidgetValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => sameWidgetValue(value, b[index]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left); return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameWidgetValue(left[key], right[key]));
  }
  return false;
}
