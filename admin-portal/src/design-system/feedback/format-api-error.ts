import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

/**
 * Embeds errorCode + correlationId into the toast message text so a
 * deterministic rejected-write toast (409/422, unambiguous) doesn't lose
 * the evidence an operator would otherwise read off an inline banner.
 * whitespace-pre-line (AppToast.tsx) renders the newline. Phase 12's
 * CodeRef pattern can later render this more richly (copy button,
 * dir="ltr", monospace); this plain-text form is fully functional today.
 */
export function formatApiErrorMessage(error: NormalizedApiError): string {
  const parts = [error.errorCode];
  if (error.correlationId) parts.push(error.correlationId);
  return `${error.message}\n${parts.join(" · ")}`;
}
