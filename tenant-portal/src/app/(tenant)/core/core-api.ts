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
  const response = await axiosClient.get<unknown>(path, { cache: "no-store", ...config });
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

export async function corePost(
  path: CorePath,
  body?: unknown,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await axiosClient.post<unknown>(path, body, { cache: "no-store", ...config });
  return { data: coreEnvelopeData(response.data), headers: response.headers, status: response.status };
}

export async function corePatch(
  path: CorePath,
  body: unknown,
  config?: TenantApiRequestConfig,
): Promise<CoreResult> {
  const response = await axiosClient.patch<unknown>(path, body, { cache: "no-store", ...config });
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
