import {
  classifyAuthFailure,
  getAuthErrorCode,
  getAuthErrorStatus,
  isDefinitiveAuthFailure,
} from "../auth/sessionErrors";
import {
  publishTenantAuthEvent,
  publishTenantAuthLifecycle,
  readLatestTenantAuthEvent,
  type TenantAuthEvent,
} from "../auth/sessionCoordinator";
import { safeSessionStorage, safeStorage } from "../safeStorage";
import { generateUUIDv7 } from "../uuid";

// Cookie auth and the readable double-submit CSRF proof require same-origin
// canonical Gateway paths. Deployment ingress owns /api/*.
const API_BASE_URL = "";
const SESSION_META_KEY = "tenant_session_meta";
const REMEMBER_PREFERENCE_KEY = "tenant_auth_remember";
const TENANT_CSRF_COOKIE = "__Host-mutakamel-tenant-csrf";
const RECENT_USER_ACTIVITY_MS = 60_000;
const ACTIVITY_RETRY_MS = 15_000;
const ACTIVITY_DEBOUNCE_MS = 750;
const ACTIVITY_RESULT_EVENT = "tenant-auth-activity-checkpoint";

let lastUserInteractionAt = 0;
let lastActivityAttemptAt = 0;
let activityTrackingSubscribers = 0;
let removeActivityTracking: (() => void) | null = null;
let activityTimer: ReturnType<typeof setTimeout> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiEnvelope<T = any> {
  success: boolean;
  status?: string;
  statusCode?: number;
  code?: string;
  message?: string;
  data: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
  correlationId?: string;
  timestamp?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface TenantApiRequestConfig extends RequestInit {
  skipAuthRefresh?: boolean;
  /** Repair the session if possible, but never replay this request. */
  nonReplayable?: boolean;
  /** Allow one replay for a naturally idempotent mutation without a key. */
  replayAfterRefresh?: boolean;
  skipAutoIdempotency?: boolean;
  /** Reject the response body before JSON parsing when it exceeds this bound. */
  maxResponseBytes?: number;
}

export type AuthSessionClientType = "WEB" | "IOS" | "ANDROID" | "DESKTOP";

export interface WebAuthSession {
  id: string;
  clientId: string;
  clientType: AuthSessionClientType;
  createdAt: string;
  lastRefreshAt: string | null;
  lastUserActivityAt: string | null;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  refreshUseCount: string;
  accessIssueCount: string;
  credentialVersion: number;
  authorizationVersion: number;
  profileVersion: number;
}

export interface WebAuthSessionResponse {
  tokenType: "Bearer";
  expiresIn: number;
  sessionExpiresIn: number;
  session: WebAuthSession;
}

export interface TenantSessionMetadata {
  savedAt: number;
  expiresIn: number;
  sessionExpiresIn: number;
  tokenType: "Bearer";
  sessionId: string;
  remember: boolean;
  authorizationVersion: number;
  profileVersion: number;
  authEventId: string;
}

export class TenantApiClientError extends Error {
  readonly response: {
    status: number;
    statusText: string;
    headers: Headers;
    data: Record<string, unknown>;
  };

  constructor(message: string, response: TenantApiClientError["response"]) {
    super(message);
    this.name = "TenantApiClientError";
    this.response = response;
  }
}

interface PreparedRequest {
  endpoint: string;
  url: string;
  init: RequestInit;
  skipAuthRefresh: boolean;
  replayAfterRefresh: boolean;
  publicAuthEndpoint: boolean;
  sessionId: string | null;
  hadSessionMetadata: boolean;
  maxResponseBytes?: number;
}

let refreshInFlight: Promise<{ sessionId: string }> | null = null;
let activityTouchInFlight: Promise<void> | null = null;
let lastActivityTouchAt = 0;

export function readWebAuthSessionResponse(
  payload: unknown,
): WebAuthSessionResponse | null {
  const root = record(payload);
  if (!root) return null;
  const target = record(root.data) ?? root;
  if (containsRawCredential(root)) {
    return null;
  }

  const session = readWebAuthSession(target.session);
  if (
    target.tokenType !== "Bearer" ||
    !positiveNumber(target.expiresIn) ||
    !positiveNumber(target.sessionExpiresIn) ||
    !session
  ) {
    return null;
  }
  return {
    tokenType: "Bearer",
    expiresIn: target.expiresIn,
    sessionExpiresIn: target.sessionExpiresIn,
    session,
  };
}

export function unwrapCoreData<T>(payload: unknown): T {
  const root = record(payload);
  return (root && "data" in root ? root.data : payload) as T;
}

export async function withTenantAuthLock<T>(
  callback: () => Promise<T>,
): Promise<T> {
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.locks?.request === "function"
  ) {
    return navigator.locks.request(
      "tenant_auth_mutex",
      { mode: "exclusive" },
      callback,
    );
  }
  return callback();
}

export function getStoredTenantSessionMeta(): TenantSessionMetadata | null {
  if (typeof window === "undefined") return null;
  removeLegacyBrowserTokens();
  try {
    const parsed = JSON.parse(
      safeSessionStorage.getItem(SESSION_META_KEY) ?? "null",
    ) as Partial<TenantSessionMetadata> | null;
    if (
      !parsed ||
      !positiveNumber(parsed.savedAt) ||
      !positiveNumber(parsed.expiresIn) ||
      !positiveNumber(parsed.sessionExpiresIn) ||
      parsed.tokenType !== "Bearer" ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.remember !== "boolean" ||
      !positiveInteger(parsed.authorizationVersion) ||
      !positiveInteger(parsed.profileVersion) ||
      typeof parsed.authEventId !== "string"
    ) {
      return null;
    }
    return parsed as TenantSessionMetadata;
  } catch {
    return null;
  }
}

export function storeTenantSessionMetadata(
  response: WebAuthSessionResponse,
  remember: boolean,
  authEventId: string,
  savedAt = Date.now(),
): void {
  if (typeof window === "undefined") return;
  removeLegacyBrowserTokens();
  const metadata: TenantSessionMetadata = {
    savedAt,
    expiresIn: response.expiresIn,
    sessionExpiresIn: response.sessionExpiresIn,
    tokenType: response.tokenType,
    sessionId: response.session.id,
    remember,
    authorizationVersion: response.session.authorizationVersion,
    profileVersion: response.session.profileVersion,
    authEventId,
  };
  safeSessionStorage.setItem(SESSION_META_KEY, JSON.stringify(metadata));
  safeStorage.setItem(REMEMBER_PREFERENCE_KEY, remember ? "1" : "0");
}

export function clearLocalTenantAuthState(): void {
  if (typeof window === "undefined") return;
  safeSessionStorage.removeItem(SESSION_META_KEY);
  safeStorage.removeItem(REMEMBER_PREFERENCE_KEY);
  removeLegacyBrowserTokens();
}

export function startTenantActivityTracking(): () => void {
  if (typeof window === "undefined") return () => undefined;
  activityTrackingSubscribers += 1;
  if (removeActivityTracking === null) {
    const recordInteraction = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      lastUserInteractionAt = Date.now();
      queueActivityCheckpoint();
    };
    window.addEventListener("pointerdown", recordInteraction, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", recordInteraction, { capture: true });
    window.addEventListener("touchstart", recordInteraction, {
      capture: true,
      passive: true,
    });
    removeActivityTracking = () => {
      window.removeEventListener("pointerdown", recordInteraction, true);
      window.removeEventListener("keydown", recordInteraction, true);
      window.removeEventListener("touchstart", recordInteraction, true);
      if (activityTimer !== null) clearTimeout(activityTimer);
      activityTimer = null;
    };
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    activityTrackingSubscribers = Math.max(0, activityTrackingSubscribers - 1);
    if (activityTrackingSubscribers === 0) {
      removeActivityTracking?.();
      removeActivityTracking = null;
    }
  };
}

export async function refreshTenantCookieSession(
  rememberOverride?: boolean,
  expectedSessionId?: string,
): Promise<WebAuthSessionResponse> {
  const storedMeta = getStoredTenantSessionMeta();
  const remember =
    rememberOverride ??
    storedMeta?.remember ??
    safeStorage.getItem(REMEMBER_PREFERENCE_KEY) === "1";
  const csrfToken = readBrowserCookie(TENANT_CSRF_COOKIE);
  const response = await fetch(
    `${API_BASE_URL}/api/tenant/core/v1/auth/refresh`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      credentials: "include",
      cache: "no-store",
    },
  );
  const payload = await readResponsePayload(response);
  if (!response.ok) throw normalizeApiError(response, payload);

  const auth = readWebAuthSessionResponse(payload);
  if (!auth) throw createLocalApiError(500, "INVALID_REFRESH_RESPONSE");

  const savedAt = Date.now();
  const event = publishTenantAuthEvent(
    "session-updated",
    auth.session.id,
    true,
    {
      savedAt,
      expiresIn: auth.expiresIn,
      sessionExpiresIn: auth.sessionExpiresIn,
      authorizationVersion: auth.session.authorizationVersion,
      profileVersion: auth.session.profileVersion,
    },
  );
  storeTenantSessionMetadata(auth, remember, event.eventId, savedAt);
  if (expectedSessionId && auth.session.id !== expectedSessionId) {
    publishTenantAuthLifecycle("STALE");
    throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
  }
  publishTenantAuthLifecycle("AUTHENTICATED");
  return auth;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function customTenantFetch<T = any>(
  endpoint: string,
  options: TenantApiRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const eventBeforeRequest = readLatestTenantAuthEvent();
  const prepared = prepareRequest(endpoint, options, eventBeforeRequest);
  return sendPreparedRequest<T>(prepared, eventBeforeRequest, false);
}

async function sendPreparedRequest<T>(
  request: PreparedRequest,
  eventBeforeRequest: TenantAuthEvent | null,
  isRetry: boolean,
): Promise<AxiosResponse<T>> {
  await touchCoreSessionForCrossAppActivity(request);
  const response = await fetch(request.url, request.init);
  const payload = await readResponsePayload(response, request.maxResponseBytes);
  if (!response.ok) {
    const error = normalizeApiError(response, payload);
    const code = getAuthErrorCode(error);
    const disposition = classifyAuthFailure(response.status, code);

    if (disposition === "end") {
      endTenantBrowserSession(request.sessionId);
      throw error;
    }
    if (
      response.status === 401 &&
      disposition === "refresh" &&
      !isRetry &&
      !request.skipAuthRefresh &&
      !request.publicAuthEndpoint
    ) {
      publishTenantAuthLifecycle("STALE");
      try {
        publishTenantAuthLifecycle("REFRESHING");
        await coordinateTenantSessionRefresh(
          request.sessionId ?? undefined,
          eventBeforeRequest,
        );
      } catch (refreshError) {
        throw refreshError;
      }

      if (!request.replayAfterRefresh) throw error;
      return sendPreparedRequest<T>(
        request,
        readLatestTenantAuthEvent(),
        true,
      );
    }

    if (response.status === 403 && !request.publicAuthEndpoint) {
      dispatchForbiddenToast();
    }
    if (disposition === "retain" && !request.publicAuthEndpoint) {
      publishTenantAuthLifecycle("DEGRADED");
    }
    throw error;
  }

  assertRequestFenceIsCurrent(request, eventBeforeRequest);

  return {
    data: payload as T,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
}

async function touchCoreSessionForCrossAppActivity(
  request: PreparedRequest,
): Promise<void> {
  const headers = new Headers(request.init.headers ?? {});
  if (
    request.publicAuthEndpoint ||
    headers.get("x-auth-user-activity") !== "1" ||
    isTenantCoreEndpoint(request.endpoint) ||
    !getStoredTenantSessionMeta() ||
    Date.now() - lastActivityTouchAt < RECENT_USER_ACTIVITY_MS
  ) {
    return;
  }
  return runActivityCheckpoint();
}

function queueActivityCheckpoint(): void {
  if (
    activityTimer !== null ||
    activityTouchInFlight !== null ||
    !getStoredTenantSessionMeta() ||
    document.visibilityState !== "visible" ||
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    Date.now() - lastActivityTouchAt < RECENT_USER_ACTIVITY_MS ||
    Date.now() - lastActivityAttemptAt < ACTIVITY_RETRY_MS
  ) {
    return;
  }
  activityTimer = setTimeout(() => {
    activityTimer = null;
    void runActivityCheckpoint();
  }, ACTIVITY_DEBOUNCE_MS);
}

function runActivityCheckpoint(): Promise<void> {
  if (activityTouchInFlight) return activityTouchInFlight;
  const csrfToken = readBrowserCookie(TENANT_CSRF_COOKIE);
  if (!csrfToken) {
    dispatchActivityResult(false, undefined, "CSRF_PROOF_MISSING");
    return Promise.resolve();
  }

  lastActivityAttemptAt = Date.now();
  const operation = (async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tenant/core/v1/auth/activity`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "x-auth-user-activity": "1",
            "x-csrf-token": csrfToken,
            "x-idempotency-key": generateUUIDv7(),
          },
          credentials: "include",
          cache: "no-store",
        },
      );
      if (response.ok) {
        lastActivityTouchAt = Date.now();
        dispatchActivityResult(true, response.status);
        return;
      }
      const payload = await readResponsePayload(response, 65_536);
      const error = normalizeApiError(response, payload);
      dispatchActivityResult(
        false,
        response.status,
        getAuthErrorCode(error),
        error.response.data.correlationId,
      );
    } catch (error) {
      dispatchActivityResult(
        false,
        getAuthErrorStatus(error),
        getAuthErrorCode(error) ?? "ACTIVITY_CHECKPOINT_UNAVAILABLE",
      );
    }
  })();
  activityTouchInFlight = operation;
  void operation.finally(() => {
    if (activityTouchInFlight === operation) activityTouchInFlight = null;
  });
  return operation;
}

function dispatchActivityResult(
  ok: boolean,
  status?: number,
  errorCode?: string,
  correlationId?: unknown,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTIVITY_RESULT_EVENT, {
    detail: {
      ok,
      ...(status === undefined ? {} : { status }),
      ...(errorCode ? { errorCode } : {}),
      ...(typeof correlationId === "string" && correlationId
        ? { correlationId }
        : {}),
    },
  }));
}

function isTenantCoreEndpoint(endpoint: string): boolean {
  try {
    const path = endpoint.startsWith("http")
      ? new URL(endpoint).pathname
      : endpoint;
    return path.startsWith("/api/tenant/core/v1/");
  } catch {
    return false;
  }
}

export async function coordinateTenantSessionRefresh(
  expectedSessionId = getStoredTenantSessionMeta()?.sessionId,
  observedEvent = readLatestTenantAuthEvent(),
): Promise<void> {
  const operation = refreshInFlight ?? startTenantRefresh(
    expectedSessionId,
    observedEvent,
  );
  try {
    const result = await operation;
    if (expectedSessionId && result.sessionId !== expectedSessionId) {
      publishTenantAuthLifecycle("STALE");
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
  } catch (error) {
    if (isDefinitiveAuthFailure(error)) {
      endTenantBrowserSession(expectedSessionId ?? null);
    } else {
      publishTenantAuthLifecycle("DEGRADED");
    }
    throw error;
  }
}

function startTenantRefresh(
  expectedSessionId: string | undefined,
  observedEvent: TenantAuthEvent | null,
): Promise<{ sessionId: string }> {
  const operation = withTenantAuthLock(async () => {
    const latest = readLatestTenantAuthEvent();
    if (
      latest?.kind === "session-ended" &&
      expectedSessionId &&
      latest.sessionId === expectedSessionId
    ) {
      throw createLocalApiError(401, "AUTH_SESSION_ENDED");
    }
    if (latest && latest.eventId !== observedEvent?.eventId) {
      if (latest.kind === "session-updated") {
        synchronizeTenantTabSession(latest);
        if (!expectedSessionId || latest.sessionId === expectedSessionId) {
          publishTenantAuthLifecycle("AUTHENTICATED");
          return { sessionId: latest.sessionId };
        }
      }
      publishTenantAuthLifecycle("STALE");
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }

    const auth = await refreshTenantCookieSession(
      undefined,
      expectedSessionId,
    );
    return { sessionId: auth.session.id };
  });
  refreshInFlight = operation;
  void operation.finally(() => {
    if (refreshInFlight === operation) refreshInFlight = null;
  });
  return operation;
}

function prepareRequest(
  endpoint: string,
  options: TenantApiRequestConfig,
  eventBeforeRequest: TenantAuthEvent | null,
): PreparedRequest {
  assertRelativeGatewayEndpoint(endpoint);
  const {
    skipAuthRefresh = false,
    nonReplayable = false,
    replayAfterRefresh: replayAfterRefreshOverride = false,
    skipAutoIdempotency = false,
    maxResponseBytes,
    ...requestInit
  } = options;
  if (
    maxResponseBytes !== undefined &&
    (!Number.isSafeInteger(maxResponseBytes) ||
      maxResponseBytes < 1 ||
      maxResponseBytes > 10_485_760)
  ) {
    throw createLocalApiError(500, "INVALID_RESPONSE_BYTE_BOUND");
  }
  const headers = new Headers(requestInit.headers ?? {});
  const method = (requestInit.method ?? "GET").toUpperCase();
  const publicAuthEndpoint = isPublicTenantAuthEndpoint(endpoint);
  const sessionMetadata = publicAuthEndpoint
    ? null
    : getStoredTenantSessionMeta();
  const hasCallerIdempotencyKey = headers.has("x-idempotency-key");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (
    requestInit.body !== undefined &&
    !(requestInit.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (
    !skipAutoIdempotency &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    !headers.has("x-idempotency-key")
  ) {
    headers.set("x-idempotency-key", generateUUIDv7());
  }
  const csrfToken = readBrowserCookie(TENANT_CSRF_COOKIE);
  if (
    csrfToken &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    !headers.has("x-csrf-token")
  ) {
    headers.set("x-csrf-token", csrfToken);
  }
  headers.delete("x-auth-user-activity");
  if (!publicAuthEndpoint && hasRecentUserInteraction()) {
    headers.set("x-auth-user-activity", "1");
  }
  removeLegacyBrowserTokens();

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  return {
    endpoint,
    url,
    skipAuthRefresh,
    replayAfterRefresh:
      !nonReplayable &&
      (isSafeMethod(method) ||
        replayAfterRefreshOverride ||
        hasCallerIdempotencyKey),
    publicAuthEndpoint,
    sessionId: sessionMetadata?.sessionId ?? (
      eventBeforeRequest?.kind === "session-updated"
        ? eventBeforeRequest.sessionId
        : null
    ),
    hadSessionMetadata: sessionMetadata !== null,
    maxResponseBytes,
    init: {
      ...requestInit,
      method,
      headers,
      credentials: "include",
    },
  };
}

function hasRecentUserInteraction(): boolean {
  installActivityTracking();
  return (
    typeof document !== "undefined" &&
    document.visibilityState !== "hidden" &&
    lastUserInteractionAt > 0 &&
    Date.now() - lastUserInteractionAt <= RECENT_USER_ACTIVITY_MS
  );
}

function installActivityTracking(): void {
  if (
    activityTrackingInstalled ||
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function"
  ) {
    return;
  }
  activityTrackingInstalled = true;
  const recordInteraction = (event: Event) => {
    if (!event.isTrusted) return;
    lastUserInteractionAt = Date.now();
  };
  window.addEventListener("pointerdown", recordInteraction, {
    capture: true,
    passive: true,
  });
  window.addEventListener("keydown", recordInteraction, { capture: true });
  window.addEventListener("touchstart", recordInteraction, {
    capture: true,
    passive: true,
  });
}

export function synchronizeTenantTabSession(sessionId?: string): void {
  if (!sessionId || typeof window === "undefined") return;
  const metadata = getStoredTenantSessionMeta();
  if (!metadata || metadata.sessionId === sessionId) return;
  safeSessionStorage.removeItem(SESSION_META_KEY);
  lastActivityTouchAt = 0;
}

function endTenantBrowserSession(): void {
  const sessionId = getStoredTenantSessionMeta()?.sessionId;
  clearLocalTenantAuthState();
  publishTenantAuthEvent("session-ended", sessionId, true);
  publishTenantAuthLifecycle("ENDED");
}

function adoptExternalAuthEvent(eventId: string): void {
  const metadata = getStoredTenantSessionMeta();
  if (!metadata) return;
  safeSessionStorage.setItem(
    SESSION_META_KEY,
    JSON.stringify({ ...metadata, authEventId: eventId }),
  );
}

function removeLegacyBrowserTokens(): void {
  if (typeof window === "undefined") return;
  for (const key of ["auth-token", "access_token", "refresh_token"]) {
    safeSessionStorage.removeItem(key);
    safeStorage.removeItem(key);
  }
}

function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const pair = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!pair) return undefined;
  const value = pair.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

async function readResponsePayload(
  response: Response,
  maxResponseBytes?: number,
): Promise<unknown> {
  const text = await response.text();
  if (
    maxResponseBytes !== undefined &&
    new TextEncoder().encode(text).byteLength > maxResponseBytes
  ) {
    throw createLocalApiError(502, "API_RESPONSE_TOO_LARGE");
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeApiError(
  response: Response,
  payload: unknown,
): TenantApiClientError {
  const body = record(payload) ?? {};
  const message = firstString(
    body.message,
    body.title,
    body.detail,
    response.statusText,
    "API Error",
  );
  const code = firstString(body.errorCode, body.code, "UNKNOWN_ERROR");
  const correlationId = firstString(body.correlationId, "");
  const details = body.details ?? body.errors;
  return new TenantApiClientError(message, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: {
      ...body,
      message,
      errorCode: code,
      correlationId,
      ...(details === undefined ? {} : { details }),
    },
  });
}

function createLocalApiError(
  status: number,
  code: string,
): TenantApiClientError {
  return new TenantApiClientError(code, {
    status,
    statusText: "",
    headers: new Headers(),
    data: { message: code, errorCode: code, correlationId: "" },
  });
}

function dispatchForbiddenToast(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("global-toast", {
      detail: {
        type: "error",
        title: "Access denied",
        message: "You do not have permission to perform this action.",
      },
    }),
  );
}

export const axiosClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: <T = any>(url: string, config?: TenantApiRequestConfig) =>
    customTenantFetch<T>(url, { ...config, method: "GET" }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T = any>(url: string, body?: any, config?: TenantApiRequestConfig) =>
    customTenantFetch<T>(url, {
      ...config,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: <T = any>(url: string, body?: any, config?: TenantApiRequestConfig) =>
    customTenantFetch<T>(url, {
      ...config,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: <T = any>(url: string, body?: any, config?: TenantApiRequestConfig) =>
    customTenantFetch<T>(url, {
      ...config,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: <T = any>(url: string, config?: TenantApiRequestConfig) =>
    customTenantFetch<T>(url, { ...config, method: "DELETE" }),
};

function isPublicTenantAuthEndpoint(endpoint: string): boolean {
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

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function assertRelativeGatewayEndpoint(endpoint: string): void {
  if (
    !endpoint.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/iu.test(endpoint) ||
    endpoint.startsWith("//") ||
    endpoint.includes("\\")
  ) {
    throw createLocalApiError(400, "UNTRUSTED_API_ORIGIN");
  }
}

function readWebAuthSession(value: unknown): WebAuthSession | null {
  const session = record(value);
  if (
    !session ||
    typeof session.id !== "string" ||
    !isClientId(session.clientId) ||
    !isAuthSessionClientType(session.clientType) ||
    typeof session.createdAt !== "string" ||
    !nullableString(session.lastRefreshAt) ||
    !nullableString(session.lastUserActivityAt) ||
    typeof session.idleExpiresAt !== "string" ||
    typeof session.absoluteExpiresAt !== "string" ||
    !decimalCounter(session.refreshUseCount) ||
    !decimalCounter(session.accessIssueCount) ||
    !positiveInteger(session.credentialVersion) ||
    !positiveInteger(session.authorizationVersion) ||
    !positiveInteger(session.profileVersion)
  ) {
    return null;
  }
  return {
    id: session.id,
    clientId: session.clientId,
    clientType: session.clientType,
    createdAt: session.createdAt,
    lastRefreshAt: session.lastRefreshAt as string | null,
    lastUserActivityAt: session.lastUserActivityAt as string | null,
    idleExpiresAt: session.idleExpiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    refreshUseCount: session.refreshUseCount,
    accessIssueCount: session.accessIssueCount,
    credentialVersion: session.credentialVersion,
    authorizationVersion: session.authorizationVersion,
    profileVersion: session.profileVersion,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function containsRawCredential(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): boolean {
  if (!value || typeof value !== "object" || depth > 8) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsRawCredential(item, depth + 1, seen));
  }
  const candidate = value as Record<string, unknown>;
  if (
    "accessToken" in candidate ||
    "access_token" in candidate ||
    "refreshToken" in candidate ||
    "refresh_token" in candidate ||
    "sessionCredential" in candidate ||
    "session_credential" in candidate
  ) {
    return true;
  }
  return Object.values(candidate).some((item) =>
    containsRawCredential(item, depth + 1, seen),
  );
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function decimalCounter(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
}

function isClientId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(value)
  );
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isAuthSessionClientType(
  value: unknown,
): value is AuthSessionClientType {
  return (
    value === "WEB" ||
    value === "IOS" ||
    value === "ANDROID" ||
    value === "DESKTOP"
  );
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
  }
  return "";
}
