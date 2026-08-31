import type { NormalizedApiError } from "./errors";

// Cross-cutting request outcomes that are NOT "the request failed" — each one
// needs its own surface because each one needs a different action from the
// user. MASTER-PLAN S8 and S9.
//
// Every code and status below is copied from backend source, not inferred:
//
//   api-gateway-app/src/common/gateway-error.catalog.ts
//     GW.RATE.LIMIT_EXCEEDED   429  rate limit hit
//     GW.RATE.UNAVAILABLE      503  the limiter itself is down; the Gateway
//                                   fails closed rather than letting the
//                                   request through (rate-limit.guard.ts,
//                                   assertRateLimitAvailable)
//     GW.IDEM.IN_FLIGHT        409  same key still processing
//     GW.IDEM.MISMATCH         422  same key, different request
//     GW.IDEM.UNAVAILABLE      503  idempotency store is down
//
//   core-app/src/common/interceptors/idempotency.interceptor.ts
//     IDEMPOTENCY_REQUEST_PROCESSING  409
//     IDEMPOTENCY_BODY_MISMATCH       422
//
// Both families reach the browser: the Gateway reserves first, and a request
// that clears the Gateway can still hit Core's own interceptor. Matching only
// one of them would leave the other rendering as a generic failure.
//
// There is deliberately NO retry-after countdown. The Gateway emits no
// Retry-After header (verified in rate-limit.guard.ts and
// problem-details.exception.ts), and a countdown the server never sent would
// be an invented number.

const RATE_LIMITED_CODE = "GW.RATE.LIMIT_EXCEEDED";
const RATE_LIMITER_DOWN_CODE = "GW.RATE.UNAVAILABLE";

const IDEMPOTENCY_PROCESSING_CODES = ["GW.IDEM.IN_FLIGHT", "IDEMPOTENCY_REQUEST_PROCESSING"];
const IDEMPOTENCY_MISMATCH_CODES = ["GW.IDEM.MISMATCH", "IDEMPOTENCY_BODY_MISMATCH"];

export type ApiOutcomeKind =
  | "rateLimited"
  | "rateLimiterUnavailable"
  | "idempotencyProcessing"
  | "idempotencyMismatch"
  | "other";

/**
 * Classifies a normalized error into the outcomes that need their own surface.
 *
 * Status is checked as well as code so a Problem Details body that loses its
 * `code` in transit still lands on the right branch — but never status alone
 * for 503, which is also an ordinary upstream outage.
 */
export function classifyApiOutcome(error: NormalizedApiError): ApiOutcomeKind {
  const code = error.code ?? "";
  if (code === RATE_LIMITER_DOWN_CODE) return "rateLimiterUnavailable";
  if (code === RATE_LIMITED_CODE || error.status === 429) return "rateLimited";
  if (IDEMPOTENCY_PROCESSING_CODES.includes(code)) return "idempotencyProcessing";
  if (IDEMPOTENCY_MISMATCH_CODES.includes(code)) return "idempotencyMismatch";
  return "other";
}

/**
 * True when the Gateway served a stored response instead of running the
 * mutation a second time.
 *
 * The header is set by the Gateway's routing proxy
 * (api-gateway-app/src/routing-proxy/routing-proxy.controller.ts) on the
 * replay path. It is a **success**, not a duplicate: the write happened once
 * and this is its result. Telling the user "already exists" here would be
 * wrong — nothing was rejected.
 */
export function isIdempotentReplay(headers: Headers): boolean {
  return headers.get("idempotency-replayed") === "true";
}
