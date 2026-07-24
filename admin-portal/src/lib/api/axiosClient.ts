// Production Admin Portal Native HTTP Client with Web Locks Mutex & Single-Retry 401 Queue

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface SessionTokenMetadata {
  accessToken: string;
  savedAt: number;
  expiresIn: number;
  tokenType: string;
  loginGeneration: string;
  cookieRevision?: number;
}

export interface AdminAuthTokenResponse {
  accessToken: string;
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
  const root = record(payload);
  if (!root) return null;

  const candidate = record(root.data) ?? root;
  if (typeof candidate.accessToken !== "string" || !candidate.accessToken.trim()) {
    return null;
  }

  return {
    accessToken: candidate.accessToken,
    expiresIn: optionalPositiveNumber(candidate.expiresIn),
    tokenType: optionalString(candidate.tokenType),
    refreshExpiresIn: optionalPositiveNumber(candidate.refreshExpiresIn),
  };
}

// -------------------------------------------------------------
// WEB LOCKS MUTEX & CONCURRENCY DEDUPLICATION QUEUE
// -------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
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
    const raw = sessionStorage.getItem("admin_session_meta");
    return raw ? JSON.parse(raw) : null;
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

export async function customFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<AxiosResponse<T>> {
  // Always relative same-origin URL unless an absolute URL is explicitly passed
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Mandatory cookie mode header for backend cookie mode validation
  if (!headers.has("x-auth-cookie-mode")) {
    headers.set("x-auth-cookie-mode", "1");
  }

  // Attach Bearer Access Token from sessionStorage for protected endpoints
  const isAuthEndpoint =
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/refresh") ||
    endpoint.includes("/auth/logout") ||
    endpoint.includes("/auth/forgot-password") ||
    endpoint.includes("/auth/reset-password");

  if (typeof window !== "undefined" && !isAuthEndpoint) {
    const accessToken = sessionStorage.getItem("access_token");
    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include", // Required for browser-managed HttpOnly refresh cookies
  };

  try {
    const response = await fetch(url, fetchOptions);

    // -------------------------------------------------------------
    // 401 BEHAVIOR: COORDINATED REFRESH UNDER WEB LOCK MUTEX
    // -------------------------------------------------------------
    if (response.status === 401 && !isRetry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<AxiosResponse<T>>((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              const retryHeaders = new Headers(options.headers || {});
              retryHeaders.set("Authorization", `Bearer ${newToken}`);
              resolve(customFetch<T>(endpoint, { ...options, headers: retryHeaders }, true));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const newAccessToken = await withAuthLock(async () => {
          const storedMeta = getStoredSessionMeta();
          const rememberFlag = storedMeta?.cookieRevision ? "1" : "0";

          // POST /api/admin/core/v1/auth/refresh with body {} and NO Authorization header
          const refreshRes = await fetch(`${API_BASE_URL}/api/admin/core/v1/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-auth-cookie-mode": "1",
              "x-auth-remember": rememberFlag,
            },
            body: JSON.stringify({}),
            credentials: "include",
          });

          if (!refreshRes.ok) {
            throw new Error("REFRESH_REJECTED");
          }

          const refreshTokens = readAdminAuthTokenResponse(await refreshRes.json());
          if (!refreshTokens || typeof window === "undefined") {
            throw new Error("INVALID_REFRESH_RESPONSE");
          }

          const token = refreshTokens.accessToken;

          // Update sessionStorage access token & metadata
          sessionStorage.setItem("access_token", token);
          if (storedMeta) {
            const updatedMeta: SessionTokenMetadata = {
              ...storedMeta,
              accessToken: token,
              savedAt: Date.now(),
              expiresIn: refreshTokens.expiresIn || storedMeta.expiresIn,
              cookieRevision: (storedMeta.cookieRevision || 0) + 1,
            };
            sessionStorage.setItem("admin_session_meta", JSON.stringify(updatedMeta));
          }

          return token;
        });

        processQueue(null, newAccessToken);

        // Retry original request exactly once
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);
        return customFetch<T>(endpoint, { ...options, headers: retryHeaders }, true);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearLocalAuthState();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    }

    let data: any;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const err: any = new Error(data?.message || response.statusText || "HTTP Error");
      err.response = { data, status: response.status, statusText: response.statusText, headers: response.headers };
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
  get: <T = any>(url: string, config?: RequestInit) =>
    customFetch<T>(url, { ...config, method: "GET" }),

  post: <T = any>(url: string, body?: any, config?: RequestInit) =>
    customFetch<T>(url, {
      ...config,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = any>(url: string, body?: any, config?: RequestInit) =>
    customFetch<T>(url, {
      ...config,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T = any>(url: string, body?: any, config?: RequestInit) =>
    customFetch<T>(url, {
      ...config,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T = any>(url: string, config?: RequestInit) =>
    customFetch<T>(url, { ...config, method: "DELETE" }),
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
