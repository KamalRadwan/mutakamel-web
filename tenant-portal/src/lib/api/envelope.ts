import { axiosClient, unwrapCoreData, type TenantApiRequestConfig } from "./axiosClient";

// Envelope discipline — MASTER-PLAN S1 / L4-1, docs/architecture/data-layer.md#response-envelopes.
//
// The three apps disagree about their response shape and the client must not
// pretend otherwise:
//
//   Core   { success, data, meta?, correlationId }   -> unwrap `data`
//   CRM    the payload itself, or { items, meta }    -> DO NOT unwrap
//   Trade  { success, data, ... }                    -> unwrap `data`
//
// Applying the Core unwrap to a CRM body is the single easiest way to break a
// new screen: `unwrapCoreData` returns the payload untouched when there is no
// `data` key, so it silently succeeds against `{ items, meta }` and then
// silently returns the WRONG object the day a CRM route happens to carry a
// field called `data`. Nothing catches it — the value merely becomes
// undefined somewhere downstream.
//
// The separation below is at the type level, and it is enforced by the one
// thing the two apps genuinely cannot share: their canonical Gateway path.
// A CRM path is not assignable to `CorePath`, so `readCoreData` cannot be
// handed a CRM route at all. `envelope.contract.test.ts` pins that with a
// `@ts-expect-error`, which fails `pnpm typecheck` if the separation is ever
// loosened.
//
// `unwrapCoreData` itself stays in the Tier-1 transport for its own callers;
// `eslint.config.mjs` stops feature code importing it directly, so these
// readers are the only route in.

/** `/api/tenant/core/v1/...` — the enveloped app. */
export type CorePath = `/api/tenant/core/v1/${string}`;
/** `/api/tenant/crm/v1/...` — the raw-payload app. */
export type CrmPath = `/api/tenant/crm/v1/${string}`;
/** `/api/tenant/trade/v1/...` — enveloped, like Core. */
export type TradePath = `/api/tenant/trade/v1/${string}`;

/**
 * Reads a Core route and returns the contents of its `data` envelope.
 *
 * Returns `unknown` deliberately: an envelope has been removed, not a shape
 * validated. Every caller still passes the result through its own runtime
 * validator before it reaches the UI (AGENTS.md, S3).
 */
export async function readCoreData(
  path: CorePath,
  config?: TenantApiRequestConfig,
): Promise<unknown> {
  const response = await axiosClient.get<unknown>(path, config);
  return unwrapCoreData<unknown>(response.data);
}

/**
 * Reads a **paginated** Core route, keeping `meta` alongside `data`.
 *
 * `readCoreData` cannot serve a list screen. Core's
 * `ResponseEnvelopeInterceptor`
 * (`../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts`)
 * sets `data` to the **items array** and moves `page`/`limit`/`total`/
 * `totalPages`/`hasNext`/`hasPrev` into a sibling `meta` object — so unwrapping
 * `data` alone throws the pagination away and leaves `DataTable` no honest
 * `PageInfo` to render. This returns both halves, still `unknown`, for the
 * caller's own validator.
 */
export async function readCorePage(
  path: CorePath,
  /**
   * The already-built `URLSearchParams` string, kept separate from the path.
   *
   * Composing it into `path` at the call site would make the argument a nested
   * template-literal type that TypeScript cannot prove is still a `CorePath`,
   * and the only way past that is a cast — which is exactly the assertion the
   * `CorePath` type exists to avoid.
   */
  query: string,
  config?: TenantApiRequestConfig,
): Promise<{ data: unknown; meta: unknown }> {
  const response = await axiosClient.get<unknown>(`${path}?${query}`, config);
  const envelope = response.data;
  return {
    data: unwrapCoreData<unknown>(envelope),
    meta:
      typeof envelope === "object" && envelope !== null
        ? (envelope as { meta?: unknown }).meta
        : undefined,
  };
}

export type CoreWriteMethod = "post" | "put" | "patch" | "delete";

/**
 * Writes to a Core route and returns the contents of its `data` envelope.
 *
 * The read helpers above are GET-only, and every Core write answers in the same
 * envelope, so without this a screen would either import `unwrapCoreData`
 * (blocked by `eslint.config.mjs` for exactly the reason stated above) or
 * hand-roll a second unwrap per feature. `204` bodies arrive as `null` and pass
 * straight through.
 */
export async function writeCoreData(
  method: CoreWriteMethod,
  path: CorePath,
  body?: unknown,
  config?: TenantApiRequestConfig,
): Promise<unknown> {
  const response =
    method === "delete"
      ? await axiosClient.delete<unknown>(path, config)
      : await axiosClient[method]<unknown>(path, body, config);
  return unwrapCoreData<unknown>(response.data);
}

/** Reads a Trade route and returns the contents of its `data` envelope. */
export async function readTradeData(
  path: TradePath,
  config?: TenantApiRequestConfig,
): Promise<unknown> {
  const response = await axiosClient.get<unknown>(path, config);
  return unwrapCoreData<unknown>(response.data);
}

/**
 * Reads a CRM route and returns the body **exactly as sent**.
 *
 * There is no unwrap here and there must never be one: CRM lists return
 * `{ items, meta }` at the top level, and stripping a `data` key off that
 * would either do nothing or destroy the response.
 */
export async function readCrmBody(
  path: CrmPath,
  config?: TenantApiRequestConfig,
): Promise<unknown> {
  const response = await axiosClient.get<unknown>(path, config);
  return response.data;
}
