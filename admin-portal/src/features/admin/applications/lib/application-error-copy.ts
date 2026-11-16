import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

/** Accepts transport errors, normalized failures and per-server bind results. */
export function localizeApplicationError(error: unknown, t: Dictionary): string {
  const record = error && typeof error === "object"
    ? error as { errorCode?: unknown; code?: unknown; message?: unknown; correlationId?: unknown }
    : null;
  const normalized = normalizeApiError(error);
  const messages = t.applications.errors;
  const code = typeof record?.errorCode === "string" ? record.errorCode
    : typeof record?.code === "string" ? record.code
      : typeof record?.message === "string" && Object.prototype.hasOwnProperty.call(messages, record.message)
        ? record.message : normalized.errorCode;
  const message = Object.prototype.hasOwnProperty.call(messages, code)
    ? messages[code as keyof typeof messages]
    : (typeof record?.errorCode === "string" || typeof record?.code === "string" || normalized.errorCode === "UNKNOWN_ERROR") &&
      typeof record?.message === "string" && record.message.trim()
      ? record.message : normalized.message;
  const correlationId = typeof record?.correlationId === "string"
    ? record.correlationId : normalized.correlationId;
  // LTR isolates keep diagnostic identifiers readable inside Arabic sentences,
  // including string-only toast and error-state consumers.
  const diagnostics = [code === "UNKNOWN_ERROR" ? null : code, correlationId]
    .filter(Boolean).map((value) => `\u2066${value}\u2069`).join(" · ");
  const suffix = ` (${diagnostics})`;
  return diagnostics && !message.endsWith(suffix) ? `${message}${suffix}` : message;
}
