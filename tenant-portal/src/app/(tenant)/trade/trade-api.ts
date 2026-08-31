import { axiosClient, type TenantApiRequestConfig } from "@/lib/api/axiosClient";
import type { TradePath } from "@/lib/api/envelope";

// Every Trade call this route group makes goes through here.
//
// Written once, before any Trade screen existed, because four of the rules
// below differ from Core's and each of them would break every Trade screen at
// the same time if a screen got it wrong on its own. Sources are
// docs/api/trade-foundation.md, trade-documents.md and trade-advanced.md,
// which were verified against trade-app source.
//
// `src/lib/api/` is a closed boundary (docs/build/HANDOFF.md, Tier 1), so this
// restates the unwrap for one route group rather than extending the shared
// envelope module — the same arrangement core-api.ts uses.

/** Trade's own scope header. Core and CRM have no equivalent. */
export const CHANNEL_SCOPE_HEADER = "x-mutakamel-channel-id";

export interface TradeResult {
  readonly data: unknown;
  readonly headers: Headers;
  readonly status: number;
}

/**
 * Trade answers `{ success, data, correlationId, timestamp }`.
 *
 * Two differences from Core that matter:
 *
 * 1. **There is no `meta`.** Core puts a pager in a sibling `meta`; Trade puts
 *    `{ items, total, page, limit }` inside `data` itself and carries no
 *    `totalPages`, `hasNext` or `hasPrev` at all. See `derivePageInfo`.
 * 2. **A payload that already carries `success` is passed through unwrapped**
 *    by `TradeResponseInterceptor`, so it arrives with no `data` key. Unwrap
 *    only when both keys are present, or such a response is destroyed.
 */
function tradeEnvelopeData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if ("success" in record && "data" in record) return record.data;
  }
  return payload;
}

/**
 * Trade sets `Idempotency-Replayed` **itself**, and sets it to the string
 * `"false"` on first execution. Presence therefore does not mean replay —
 * `headers.has(...)` is true on every idempotent write. Only `=== "true"` is a
 * replay, and a replay renders as success, never as a duplicate error.
 */
export function isTradeReplay(headers: Headers): boolean {
  return headers.get("idempotency-replayed") === "true";
}

/**
 * Trade has exactly **one** `If-Match` parser (`parseExpectedVersion`), unlike
 * Core, which has three of differing strictness in one app. It accepts `W/"n"`,
 * `"n"` and bare `n`; we always send the strong form.
 *
 * A missing or unparseable header is **400 `TRADE.CONCURRENCY.IF_MATCH_REQUIRED`**
 * — Trade never answers 428. A screen that renders a "precondition required"
 * state on 428 will therefore never render it here; branch on the code.
 */
export function tradeIfMatch(version: number | string): string {
  return `"${version}"`;
}

export interface TradePageInfo {
  readonly items: readonly unknown[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
}

/**
 * Trade lists are flat `{ items, total, page, limit }` with **no** `totalPages`,
 * `hasNext` or `hasPrev`. Derive them here rather than in each screen, or the
 * pager renders wrong on the last page.
 *
 * Three query dialects exist across Trade — `page`+`limit`, `limit`-only, and
 * `limit`+`offset` (dashboards) — so a caller still has to send what its own
 * route documents. This only reads the response.
 */
export function derivePageInfo(payload: unknown): TradePageInfo | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.items)) return null;
  if (typeof record.total !== "number" || typeof record.limit !== "number") return null;
  const page = typeof record.page === "number" ? record.page : 1;
  const totalPages = record.limit > 0 ? Math.max(1, Math.ceil(record.total / record.limit)) : 1;
  return {
    items: record.items,
    total: record.total,
    page,
    limit: record.limit,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

/**
 * Trade failures carry **`code`**, not Core's `errorCode`, and there is no
 * exception filter — error bodies are Nest defaults with the thrown object's
 * keys merged in, so the shape is less regular than Core's. Read the code
 * defensively and fall back to the status.
 */
export function tradeErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const code = record.code ?? (record.error as Record<string, unknown> | undefined)?.code;
  return typeof code === "string" ? code : null;
}

// No "PUT": zero of Trade's 231 Gateway routes use it. A transport method for
// a verb the contract does not have is the same mistake as an invented DTO
// field — it offers a capability that does not exist.
async function send(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: TradePath,
  body: unknown,
  config?: TenantApiRequestConfig,
): Promise<TradeResult> {
  const init: TenantApiRequestConfig = { cache: "no-store", ...config };
  const response =
    method === "GET"
      ? await axiosClient.get<unknown>(path, init)
      : method === "DELETE"
        ? await axiosClient.delete<unknown>(path, init)
        : method === "POST"
          ? await axiosClient.post<unknown>(path, body, init)
          : await axiosClient.patch<unknown>(path, body, init);
  return {
    data: tradeEnvelopeData(response.data),
    headers: response.headers,
    status: response.status,
  };
}

export function tradeGet(path: TradePath, config?: TenantApiRequestConfig): Promise<TradeResult> {
  return send("GET", path, undefined, config);
}

export function tradePost(
  path: TradePath,
  body?: unknown,
  config?: TenantApiRequestConfig,
): Promise<TradeResult> {
  return send("POST", path, body, config);
}

export function tradePatch(
  path: TradePath,
  body: unknown,
  config?: TenantApiRequestConfig,
): Promise<TradeResult> {
  return send("PATCH", path, body, config);
}

export function tradeDelete(
  path: TradePath,
  config?: TenantApiRequestConfig,
): Promise<TradeResult> {
  return send("DELETE", path, undefined, config);
}
