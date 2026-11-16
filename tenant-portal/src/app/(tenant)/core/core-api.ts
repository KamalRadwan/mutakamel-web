import { axiosClient, type TenantApiRequestConfig } from "@/lib/api/axiosClient";
import type { CorePath } from "@/lib/api/envelope";

// Every Core call this route group makes goes through here.
//
// `@/lib/api/envelope`'s `readCoreData` is the sanctioned reader for a plain
// GET, but it returns only the unwrapped body. The email-config screen has to
// read the `ETag` response header to build its `If-Match` precondition
// (core-app/src/tenant/email-config/tenant-email-config.controller.ts), and
// every Core write returns an envelope with no reader at all. Feature code may
// not import `unwrapCoreData` (eslint.config.mjs) and `src/lib/api/` is a
// closed boundary, so the unwrap is restated here once, for one route group,
// rather than in each of the six screens.

export interface CoreResult {
  readonly data: unknown;
  readonly headers: Headers;
  readonly status: number;
}

/** Core answers `{ success, data, meta?, correlationId }`; screens want `data`. */
function coreEnvelopeData(payload: unknown): unknown {
  return payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload
    ? (payload as { data: unknown }).data
    : payload;
}

export async function coreGet(
  path: CorePath,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await coreGetResponse(path, config);
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

export async function corePost(
  path: CorePath,
  body?: unknown,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await corePostResponse(path, body, config);
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

export async function corePatch(
  path: CorePath,
  body: unknown,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await corePatchResponse(path, body, config);
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

export async function corePut(
  path: CorePath,
  body: unknown,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await axiosClient.put<unknown>(path, body, { cache: "no-store", ...config });
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

export async function coreDelete(
  path: CorePath,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await axiosClient.delete<unknown>(path, { cache: "no-store", ...config });
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

/** Preserve raw transport evidence for writes requiring a coherent owner receipt. */
export function corePatchResponse(path: CorePath, body: unknown, config?: TenantApiRequestConfig) {
  return axiosClient.patch<unknown>(path, body, { cache: "no-store", ...config });
}

/** Preserve the raw owner read response until its runtime validator admits it. */
export function coreGetResponse(path: CorePath, config?: TenantApiRequestConfig) {
  return axiosClient.get<unknown>(path, { cache: "no-store", ...config });
}

/** The owner also exposes read-like POSTs (for example template search). */
export function corePostResponse(path: CorePath, body?: unknown, config?: TenantApiRequestConfig) {
  return axiosClient.post<unknown>(path, body, { cache: "no-store", ...config });
}
