// Production Admin Portal Native HTTP Client with Web Locks Mutex & Single-Retry 401 Queue

import {
  getAuthErrorStatus,
  isDefinitiveAuthFailure,
} from "../auth/sessionRefresh";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface ApiRequestConfig extends RequestInit {
  /** The caller already owns the auth lock and must handle a 401 directly. */
  skipAuthRefresh?: boolean;
  /**
   * Never replay this request automatically. A 401 is returned to the caller
   * without refreshing the session because the first write may have succeeded
   * even when its response is not usable.
   */
  nonReplayable?: boolean;
  /**
   * Some write endpoints are explicitly non-idempotent and reject replay
   * semantics. Set this only when the route contract declares
   * `idempotent: false`; ordinary mutations keep the automatic key.
   */
  skipAutoIdempotency?: boolean;
}

export interface SessionTokenMetadata {
  savedAt: number;
  expiresIn: number;
  tokenType: string;
  loginGeneration: string;
  remember: boolean;
  cookieRevision?: number;
}

export interface AdminAuthTokenResponse {
  accessToken?: string;
  expiresIn?: number;
  tokenType?: string;
  refreshExpiresIn?: number;
}

/**
 * Core returns the token fields directly. Some same-origin proxy layers wrap
 * successful JSON in `{ data: ... }`, so accept that one explicit envelope
 * without accepting arbitrary response shapes.
 */
export function readAdminAuthTokenResponse(
  payload: unknown,
): AdminAuthTokenResponse | null {
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  const root = record(parsed);
  if (!root) return null;
  const firstEnvelope = record(root.data) ?? root;
  const target = record(firstEnvelope.data) ?? firstEnvelope;

  const rawToken =
    target.accessToken ??
    target.access_token ??
    target.token ??
    root.accessToken ??
    root.access_token ??
    root.token;

  const expiresIn =
    target.expiresIn ?? target.expires_in ?? root.expiresIn ?? root.expires_in;
  const tokenType =
    target.tokenType ?? target.token_type ?? root.tokenType ?? root.token_type;
  const refreshExpiresIn =
    target.refreshExpiresIn ??
    target.refresh_expires_in ??
    root.refreshExpiresIn ??
    root.refresh_expires_in;

  const normalizedExpiresIn = optionalPositiveNumber(expiresIn);
  const normalizedTokenType = optionalString(tokenType);
  if (!normalizedExpiresIn || !normalizedTokenType) return null;

  return {
    accessToken: optionalString(rawToken),
    expiresIn: normalizedExpiresIn,
    tokenType: normalizedTokenType,
    refreshExpiresIn: optionalPositiveNumber(refreshExpiresIn),
  };
}

/** Unwrap the canonical Core success envelope while retaining direct payload compatibility. */
export function unwrapCoreData<T>(payload: unknown): T {
  const root = record(payload);
  return (root && "data" in root ? root.data : payload) as T;
}

// -------------------------------------------------------------
// WEB LOCKS MUTEX & CONCURRENCY DEDUPLICATION QUEUE
// -------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (err: any) => void;
}> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processQueue = (error?: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

/** Acquire exclusive cross-tab Web Lock if available */
export async function withAuthLock<T>(callback: () => Promise<T>): Promise<T> {
  if (typeof window !== "undefined" && "locks" in navigator) {
    return navigator.locks.request("admin_auth_mutex", { mode: "exclusive" }, async () => {
      return callback();
    });
  }
  // Fallback for browsers without Web Locks API
  return callback();
}

/** Utility to retrieve stored session metadata */
export function getStoredSessionMeta(): SessionTokenMetadata | null {
  if (typeof window === "undefined") return null;
  try {
    sessionStorage.removeItem("access_token");
    const raw = sessionStorage.getItem("admin_session_meta");
    if (!raw) return null;

    const metadata = JSON.parse(raw) as SessionTokenMetadata & {
      accessToken?: unknown;
    };
    if ("accessToken" in metadata) {
      delete metadata.accessToken;
      sessionStorage.setItem("admin_session_meta", JSON.stringify(metadata));
    }

    return metadata;
  } catch {
    return null;
  }
}

/** Utility to safely clear all local auth data and fail closed */
export function clearLocalAuthState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("admin_session_meta");
  sessionStorage.removeItem("user_profile");
}

function removeLegacyBrowserAccessToken() {
  if (typeof window === "undefined") return;
  getStoredSessionMeta();
}

export async function refreshAdminCookieSession(
  rememberOverride?: boolean,
): Promise<AdminAuthTokenResponse> {
  const storedMeta = getStoredSessionMeta();
  const remember = rememberOverride ?? storedMeta?.remember ?? false;
  const refreshRes = await fetch(
    `${API_BASE_URL}/api/admin/core/v1/auth/refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-cookie-mode": "1",
        "x-auth-remember": remember ? "1" : "0",
      },
      body: JSON.stringify({}),
      credentials: "include",
    },
  );

  if (!refreshRes.ok) {
    const refreshError = Object.assign(new Error("REFRESH_REJECTED"), {
      status: refreshRes.status,
    });
    throw refreshError;
  }

  const refreshTokens = readAdminAuthTokenResponse(await refreshRes.json());
  if (!refreshTokens || typeof window === "undefined") {
    throw Object.assign(new Error("INVALID_REFRESH_RESPONSE"), { status: 500 });
  }

  removeLegacyBrowserAccessToken();

  if (storedMeta) {
    const updatedMeta: SessionTokenMetadata = {
      ...storedMeta,
      savedAt: Date.now(),
      expiresIn: refreshTokens.expiresIn || storedMeta.expiresIn,
      cookieRevision: (storedMeta.cookieRevision || 0) + 1,
    };
    sessionStorage.setItem("admin_session_meta", JSON.stringify(updatedMeta));
  }

  return refreshTokens;
}

export function generateUUIDv7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const ms = Date.now();
  const high = Math.floor(ms / 0x100000000);
  const low = ms % 0x100000000;

  bytes[0] = (high >> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >> 24) & 0xff;
  bytes[3] = (low >> 16) & 0xff;
  bytes[4] = (low >> 8) & 0xff;
  bytes[5] = low & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  let uuid = "";
  for (let i = 0; i < 16; i++) {
    uuid += bytes[i].toString(16).padStart(2, "0");
    if (i === 3 || i === 5 || i === 7 || i === 9) uuid += "-";
  }
  return uuid;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function customFetch<T = any>(
  endpoint: string,
  options: ApiRequestConfig = {},
  isRetry = false
): Promise<AxiosResponse<T>> {
  const {
    skipAuthRefresh = false,
    nonReplayable = false,
    skipAutoIdempotency = false,
    ...requestOptions
  } = options;

  // Always relative same-origin URL unless an absolute URL is explicitly passed
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(requestOptions.headers || {});
  if (!headers.has("Content-Type") && !(requestOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Automatically attach x-idempotency-key for mutating requests if not present
  const method = (options.method || "GET").toUpperCase();
  if (
    !skipAutoIdempotency &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    !headers.has("x-idempotency-key")
  ) {
    headers.set("x-idempotency-key", generateUUIDv7());
  }



  const isPublicAuthEndpoint = isPublicAdminAuthEndpoint(endpoint);

  // Browser authentication is cookie-only in development and production.
  headers.set("x-auth-cookie-mode", "1");
  removeLegacyBrowserAccessToken();

  const fetchOptions: RequestInit = {
    ...requestOptions,
    headers,
    credentials: "include", // Required for browser-managed HttpOnly cookies
  };

  try {
    const response = await fetch(url, fetchOptions);

    // -------------------------------------------------------------
    // 401 BEHAVIOR: COORDINATED REFRESH UNDER WEB LOCK MUTEX
    // -------------------------------------------------------------
    if (
      response.status === 401 &&
      !isRetry &&
      !skipAuthRefresh &&
      !nonReplayable &&
      !isPublicAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise<AxiosResponse<T>>((resolve, reject) => {
          failedQueue.push({
            resolve: () => {
              resolve(customFetch<T>(endpoint, options, true));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        await withAuthLock(async () => {
          const storedMeta = getStoredSessionMeta();
          const requestRemember = new Headers(requestOptions.headers).get("x-auth-remember");
          const remember =
            requestRemember === null
              ? storedMeta?.remember
              : requestRemember === "1" ||
                requestRemember.toLowerCase() === "true";

          await refreshAdminCookieSession(remember);
        });

        processQueue();

        // Retry original request exactly once
        return customFetch<T>(endpoint, options, true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (refreshErr: any) {
        processQueue(refreshErr);

        // Do NOT remove access token or redirect to login if refresh failed due to 5XX server error or network issue
        const status = getAuthErrorStatus(refreshErr);

        if (isDefinitiveAuthFailure(refreshErr)) {
          clearLocalAuthState();
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("global-toast", {
                detail: {
                  type: "error",
                  title: "Session Expired",
                  message: "Your session has expired. Please log in again.",
                },
              })
            );
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          }
        } else if (status === undefined || status >= 500) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("global-toast", {
                detail: {
                  type: "error",
                  title: "Server Error",
                  message: "An internal server error occurred while refreshing your session.",
                },
              })
            );
          }
        }
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      // Normalize CoreErrorResponse and GatewayProblemDetails
      const message = data?.message ?? data?.title ?? data?.detail ?? response.statusText ?? "HTTP Error";
      const code = data?.errorCode ?? data?.code ?? "UNKNOWN_ERROR";
      const correlationId = data?.correlationId ?? "";
      const details = data?.details ?? data?.errors ?? undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err: any = new Error(message);
      err.response = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: {
          ...data,
          message,
          errorCode: code,
          correlationId,
          details
        }
      };

      // -------------------------------------------------------------
      // 403 FORBIDDEN BEHAVIOR
      // -------------------------------------------------------------
      if (response.status === 403 && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("global-toast", {
            detail: {
              type: "error",
              title: "Access Denied",
              message: "You do not have permission to perform this action.",
            },
          })
        );
      }

      throw err;
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
  } catch (error) {
    throw error;
  }
}

export const axiosClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: <T = any>(url: string, config?: ApiRequestConfig) =>
    customFetch<T>(url, { ...config, method: "GET" }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T = any>(url: string, body?: any, config?: ApiRequestConfig) =>
    customFetch<T>(url, {
      ...config,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: <T = any>(url: string, body?: any, config?: ApiRequestConfig) =>
    customFetch<T>(url, {
      ...config,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: <T = any>(url: string, body?: any, config?: ApiRequestConfig) =>
    customFetch<T>(url, {
      ...config,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: <T = any>(url: string, config?: ApiRequestConfig) =>
    customFetch<T>(url, { ...config, method: "DELETE" }),
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isPublicAdminAuthEndpoint(endpoint: string): boolean {
  const requestPath = endpoint.split("?")[0].replace(/\/+$/, "");
  const authStart = requestPath.indexOf("/auth/");
  if (authStart < 0) return false;

  return [
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/auth/accept-invite",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].includes(requestPath.slice(authStart));
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
