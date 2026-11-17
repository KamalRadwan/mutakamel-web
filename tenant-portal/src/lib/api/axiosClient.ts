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
import { SALES_DRAFT_TYPING_PREFIX, SALES_PUBLISH_RECOVERY_PREFIX, safeSessionStorage, safeStorage } from "../safeStorage";
import { generateUUIDv7 } from "../uuid";
import { getActiveDictionary, readLanguage } from "../../i18n/dictionary-store";

// Cookie auth and the readable double-submit CSRF proof require same-origin
// canonical Gateway paths. Deployment ingress owns /api/*.
const SESSION_META_KEY = "tenant_session_meta";
const REMEMBER_PREFERENCE_KEY = "tenant_auth_remember";
const TENANT_CSRF_COOKIE = "__Host-mutakamel-tenant-csrf";
const TENANT_HTTP_CSRF_COOKIE = "mutakamel-http-tenant-csrf";
const RECENT_USER_ACTIVITY_MS = 60_000;
const ACTIVITY_RETRY_MS = 15_000;
const AUTH_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

let lastUserInteractionAt = 0;
let lastActivityAttemptAt = 0;
let activityTrackingSubscribers = 0;
let removeActivityTracking: (() => void) | null = null;

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
  readonly provenance?: "http";
  readonly request?: TenantApiClientError["request"];
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface TenantApiRequestConfig extends RequestInit {
  /** Synchronous owner check at transport dispatch, auth replay and response admission. */
  assertCurrent?: () => void;
  /** Keep a write unresolved when Fetch cannot confirm the original response target. */
  requireExactResponseTarget?: boolean;
  /** Successful binary downloads still parse HTTP error bodies as JSON. */
  responseType?: "json" | "blob";
  /** Require a complete, unencoded 200 download with this exact media type. */
  expectedBinaryContentType?: string;
  /** Total deadline, including response body and any auth recovery (1..2^31-1 ms). */
  timeoutMs?: number;
  skipAuthRefresh?: boolean;
  /** Advisory reads handle denied access in their own screen state. */
  suppressForbiddenToast?: boolean;
  /** Repair the session if possible, but never replay this request. */
  nonReplayable?: boolean;
  /** Allow one replay for a naturally idempotent mutation without a key. */
  replayAfterRefresh?: boolean;
  skipAutoIdempotency?: boolean;
  /** Reject the response body before JSON parsing when it exceeds this bound. */
  maxResponseBytes?: number;
  /** Read a successful blob incrementally and cancel the stream if it exceeds this bound. */
  maxBinaryResponseBytes?: number;
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

  constructor(
    message: string,
    response: TenantApiClientError["response"],
    readonly provenance: "http" | "client" | "unknown" = "unknown",
    readonly request?: {
      readonly endpoint: string;
      readonly method: string;
      readonly origin?: string;
      readonly finalUrl?: string;
      readonly redirected?: boolean;
    },
    readonly rawData?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "TenantApiClientError";
    this.response = response;
  }
}

interface PreparedRequest {
  assertCurrent?: () => void;
  requireExactResponseTarget: boolean;
  origin?: string;
  responseType: "json" | "blob";
  expectedBinaryContentType?: string;
  maxBinaryResponseBytes?: number;
  endpoint: string;
  url: string;
  init: RequestInit;
  skipAuthRefresh: boolean;
  suppressForbiddenToast: boolean;
  replayAfterRefresh: boolean;
  publicAuthEndpoint: boolean;
  sessionId: string | null;
  hadSessionMetadata: boolean;
  maxResponseBytes?: number;
}

export interface PermissionDenialEvent {
  code: string;
  endpoint: string;
  method: string;
  branchId: string | null;
  companyId: string | null;
}

const PERMISSION_DENIED_EVENT = "tenant-permission-denied";

export function subscribePermissionDenials(listener: (event: PermissionDenialEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const receive = (event: Event) => listener((event as CustomEvent<PermissionDenialEvent>).detail);
  window.addEventListener(PERMISSION_DENIED_EVENT, receive);
  return () => window.removeEventListener(PERMISSION_DENIED_EVENT, receive);
}

let refreshInFlight: {
  sessionId: string;
  promise: Promise<{ sessionId: string }>;
} | null = null;
let activityTouchInFlight: {
  sessionId: string;
  promise: Promise<void>;
} | null = null;
let lastActivityTouchAt = 0;
let fallbackTenantAuthQueue: Promise<void> = Promise.resolve();

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
  callback: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined"
  ) {
    throw createLocalApiError(503, "AUTH_SESSION_COORDINATION_UNAVAILABLE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    if (typeof navigator.locks?.request !== "function") {
      return await withFallbackTenantAuthLock(callback, controller.signal);
    }
    return await navigator.locks.request(
      "tenant_auth_mutex",
      { mode: "exclusive", signal: controller.signal },
      () => callback(controller.signal),
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw createLocalApiError(503, "AUTH_SESSION_COORDINATION_UNAVAILABLE");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function withFallbackTenantAuthLock<T>(
  callback: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  // HTTP has no Web Locks. Keep mutations serialized within this tab while
  // the existing auth events and generation fences continue coordinating tabs.
  const operation = fallbackTenantAuthQueue.then(() => {
    signal.throwIfAborted();
    return callback(signal);
  });
  // A timed-out caller must not release an operation that is still settling.
  fallbackTenantAuthQueue = operation.then(() => undefined, () => undefined);
  return waitForOperation(operation, signal);
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
  try {
    // Clear retained quotation authoring content on sign-out.
    const handoffKey = "trade:quotation:composer-handoff";
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key === handoffKey || key?.startsWith(`${handoffKey}:`) || key?.startsWith(SALES_DRAFT_TYPING_PREFIX) ||
        key?.startsWith(SALES_PUBLISH_RECOVERY_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be unavailable; auth teardown must still complete.
  }
  lastUserInteractionAt = 0;
  lastActivityAttemptAt = 0;
  lastActivityTouchAt = 0;
  removeLegacyBrowserTokens();
}

export function startTenantActivityTracking(): () => void {
  if (typeof window === "undefined") return () => undefined;
  activityTrackingSubscribers += 1;
  if (removeActivityTracking === null) {
    const recordInteraction = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      lastUserInteractionAt = Date.now();
      checkpointTenantActivityIfDue();
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

async function requestTenantSessionRefresh(
  signal?: AbortSignal,
): Promise<WebAuthSessionResponse> {
  const csrfToken = readTenantCsrfCookie();
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(
      "/api/tenant/core/v1/auth/refresh",
      {
        method: "POST",
        headers: createRequestHeaders({
          Accept: "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        }),
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      },
    );
    payload = await readResponsePayload(response);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
  if (!response.ok) throw await normalizeApiError(response, payload);

  const auth = readWebAuthSessionResponse(payload);
  if (!auth) throw createLocalApiError(500, "INVALID_REFRESH_RESPONSE");
  return auth;
}

/**
 * Commits a freshly issued session to this tab: one `session-updated` event and
 * the metadata keyed to its id, written in that order so the two can never
 * disagree about which event the stored timing came from.
 *
 * `notifyCurrentTab` is the whole reason this is one function and not two
 * call sites. A caller that goes on to set its own auth state — sign-in, the
 * bootstrap adoption below — must not also re-enter this tab's cross-tab
 * handler, which would abort the very work that is committing the session. A
 * caller that has no such state to set — accepting an invite, which then
 * navigates — needs exactly that handler to run, because it is what tells the
 * provider a session now exists.
 */
export function commitTenantSessionResponse(
  auth: WebAuthSessionResponse,
  { remember, notifyCurrentTab }: {
    remember: boolean;
    notifyCurrentTab: boolean;
  },
): void {
  const savedAt = Date.now();
  const event = publishTenantAuthEvent(
    "session-updated",
    auth.session.id,
    notifyCurrentTab,
    {
      savedAt,
      expiresIn: auth.expiresIn,
      sessionExpiresIn: auth.sessionExpiresIn,
      authorizationVersion: auth.session.authorizationVersion,
      profileVersion: auth.session.profileVersion,
    },
  );
  storeTenantSessionMetadata(auth, remember, event.eventId, savedAt);
}

export async function refreshTenantCookieSession(
  rememberOverride?: boolean,
  expectedSessionId?: string,
  signal?: AbortSignal,
): Promise<WebAuthSessionResponse> {
  const storedMeta = getStoredTenantSessionMeta();
  const eventBeforeRefresh = readLatestTenantAuthEvent();
  const remember =
    rememberOverride ??
    storedMeta?.remember ??
    safeStorage.getItem(REMEMBER_PREFERENCE_KEY) === "1";
  const auth = await requestTenantSessionRefresh(signal);

  const latestEvent = readLatestTenantAuthEvent();
  const currentMeta = getStoredTenantSessionMeta();
  if (
    (expectedSessionId && auth.session.id !== expectedSessionId) ||
    (storedMeta && currentMeta?.sessionId !== storedMeta.sessionId) ||
    (latestEvent && latestEvent.eventId !== eventBeforeRefresh?.eventId)
  ) {
    if (
      latestEvent?.kind === "session-ended" &&
      latestEvent.sessionId === expectedSessionId
    ) {
      throw createLocalApiError(401, "AUTH_SESSION_ENDED");
    }
    throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
  }

  commitTenantSessionResponse(auth, { remember, notifyCurrentTab: true });
  publishTenantAuthLifecycle("AUTHENTICATED");
  return auth;
}

/**
 * Rebuilds this tab's session metadata from the cookies alone.
 *
 * `tenant_session_meta` lives in sessionStorage, so it belongs to the one tab
 * that signed in. A second tab, a restored window, and the redirect after an
 * accepted invite all hold the same HttpOnly credentials and none of it — and
 * everything that keeps a session alive is keyed to that metadata: the refresh
 * scheduler reads its timing, the 401 retry only refreshes when the request
 * carried it, and the realtime generation is built from its session id. A tab
 * without it is signed in until the access cookie expires and then simply
 * stops working.
 *
 * So the tab adopts the session the only way a browser can: by spending one
 * refresh. `POST /auth/refresh` answers from the session-credential cookie
 * alone (`tenant-auth.controller.ts`), so no client-known session id is needed
 * to ask, and the response is the same shape sign-in commits.
 *
 * Returns `null` when there is nothing to adopt, which is the common case.
 */
export async function adoptTenantCookieSession(): Promise<
  WebAuthSessionResponse | null
> {
  if (typeof window === "undefined") return null;
  if (!hasTenantSessionCookieHint() || getStoredTenantSessionMeta() !== null) {
    return null;
  }
  return withTenantAuthLock(async (signal) => {
    if (getStoredTenantSessionMeta() !== null) return null;
    const auth = await requestTenantSessionRefresh(signal);
    const latestEvent = readLatestTenantAuthEvent();
    if (
      latestEvent?.kind === "session-ended" &&
      latestEvent.sessionId === auth.session.id
    ) {
      throw createLocalApiError(401, "AUTH_SESSION_ENDED");
    }
    commitTenantSessionResponse(auth, {
      remember: safeStorage.getItem(REMEMBER_PREFERENCE_KEY) === "1",
      notifyCurrentTab: false,
    });
    return auth;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function customTenantFetch<T = any>(
  endpoint: string,
  options: TenantApiRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const eventBeforeRequest = readLatestTenantAuthEvent();
  const sessionMetadata = getStoredTenantSessionMeta();
  const prepared = prepareRequest(
    endpoint,
    options,
    eventBeforeRequest,
    sessionMetadata,
  );
  if (!prepared.publicAuthEndpoint) {
    assertAuthSnapshotIsCurrent(sessionMetadata, eventBeforeRequest);
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new RangeError("timeoutMs must be a positive timer-safe integer");
  }
  const controller = new AbortController();
  const callerSignal = prepared.init.signal;
  const cancel = () => controller.abort();
  callerSignal?.addEventListener("abort", cancel, { once: true });
  if (callerSignal?.aborted) cancel();
  let timedOut = false;
  const timer = setTimeout(() => {
    if (controller.signal.aborted) return;
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  prepared.init.signal = controller.signal;
  try {
    controller.signal.throwIfAborted();
    return await waitForOperation(
      sendPreparedRequest<T>(prepared, eventBeforeRequest, false),
      controller.signal,
    );
  } catch (error) {
    if (!timedOut) throw error;
    const write = !isSafeMethod(prepared.init.method ?? "GET");
    // The provider-seeded copy resolves at once; a standalone caller loads
    // only its active language. If that download fails, the stable code is
    // still a truthful message and the timeout must not be masked.
    const copy = await getActiveDictionary().catch(() => null);
    const message = copy
      ? (write ? copy.errors.writeTimedOut : copy.errors.requestTimedOut)
      : "CLIENT_REQUEST_TIMEOUT";
    const idempotencyKey = new Headers(prepared.init.headers).get("x-idempotency-key");
    // A client deadline cannot prove that the server rolled back a write.
    // Keep its exact key as recovery evidence; never replay on timeout.
    throw new TenantApiClientError(message, {
      status: 504,
      statusText: "",
      headers: new Headers(),
      data: {
        errorCode: "CLIENT_REQUEST_TIMEOUT",
        message,
        ...(write && idempotencyKey ? { idempotencyKey } : {}),
      },
    }, "client");
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancel);
  }
}

async function sendPreparedRequest<T>(
  request: PreparedRequest,
  eventBeforeRequest: TenantAuthEvent | null,
  isRetry: boolean,
): Promise<AxiosResponse<T>> {
  request.init.signal?.throwIfAborted();
  assertRequestFenceIsCurrent(request, eventBeforeRequest);
  await touchCoreSessionForCrossAppActivity(request);
  request.init.signal?.throwIfAborted();
  assertRequestFenceIsCurrent(request, eventBeforeRequest);
  const assertOutcomeCurrent = () => {
    if (!request.assertCurrent) return;
    request.init.signal?.throwIfAborted();
    assertRequestFenceIsCurrent(request, eventBeforeRequest);
  };
  const scopedBinary = request.responseType === "blob" && request.requireExactResponseTarget &&
    request.expectedBinaryContentType !== undefined;
  const checkTargetBeforeRead = scopedBinary || request.maxBinaryResponseBytes !== undefined;
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(request.url, request.init);
    if (scopedBinary) {
      try {
        request.init.signal?.throwIfAborted();
        assertRequestFenceIsCurrent(request, eventBeforeRequest);
      } catch (error) {
        void response.body?.cancel().catch(() => undefined);
        throw error;
      }
    }
    if (checkTargetBeforeRead) assertExactResponseTarget(request, response, true);
    payload = await readResponsePayload(response, request);
  } catch (error) {
    assertOutcomeCurrent();
    throw error;
  }
  request.init.signal?.throwIfAborted();
  assertRequestFenceIsCurrent(request, eventBeforeRequest);
  if (!response.ok) {
    let error: TenantApiClientError;
    try {
      error = await normalizeApiError(response, payload, request.endpoint, request.init.method, request.origin);
    } catch (error) {
      assertOutcomeCurrent();
      throw error;
    }
    assertOutcomeCurrent();
    const code = getAuthErrorCode(error);
    const disposition = classifyAuthFailure(response.status, code);

    if (disposition === "end") {
      endTenantBrowserSession(request.sessionId, code);
      throw error;
    }
    if (
      response.status === 401 &&
      disposition === "refresh" &&
      request.hadSessionMetadata &&
      !hasTenantSessionCookieHint()
    ) {
      // The readable CSRF proof and HttpOnly session credential are one web
      // channel. If the proof disappeared while this request was in flight,
      // refresh cannot succeed and stale tab metadata must not cause a second
      // guaranteed 401.
      endTenantBrowserSession(request.sessionId);
      throw error;
    }
    if (
      response.status === 401 &&
      disposition === "refresh" &&
      !isRetry &&
      !request.skipAuthRefresh &&
      !request.publicAuthEndpoint &&
      // Only refresh when there was a session to refresh. A visitor who has
      // never signed in also gets a 401, and refreshing on their behalf
      // replaces the honest "you are signed out" error with whatever the
      // refresh attempt fails with — a coordination error, which reads as
      // "the server is degraded" and left the login form unreachable.
      request.hadSessionMetadata
    ) {
      publishTenantAuthLifecycle("STALE");
      try {
        assertOutcomeCurrent();
        publishTenantAuthLifecycle("REFRESHING");
        assertOutcomeCurrent();
        await coordinateTenantSessionRefresh(
          request.sessionId ?? undefined,
          eventBeforeRequest,
          request.init.signal ?? undefined,
        );
      } catch (refreshError) {
        assertOutcomeCurrent();
        throw refreshError;
      }

      assertOutcomeCurrent();
      if (!request.replayAfterRefresh) throw error;
      return sendPreparedRequest<T>(
        request,
        readLatestTenantAuthEvent(),
        true,
      );
    }

    if (
      response.status === 403 &&
      !request.publicAuthEndpoint &&
      !isTenantActivityEndpoint(request.endpoint)
    ) {
      if (!request.suppressForbiddenToast) await dispatchForbiddenToast(code, assertOutcomeCurrent);
      if (typeof window !== "undefined") {
        assertOutcomeCurrent();
        const headers = new Headers(request.init.headers);
        window.dispatchEvent(new CustomEvent<PermissionDenialEvent>(PERMISSION_DENIED_EVENT, {
          detail: {
            code: firstString(error.response.data.errorCode, error.response.data.code),
            endpoint: request.endpoint,
            method: request.init.method ?? "GET",
            branchId: headers.get("x-mutakamel-branch-id"),
            companyId: headers.get("x-mutakamel-company-id"),
          },
        }));
      }
    }
    throw error;
  }

  if (!checkTargetBeforeRead) assertExactResponseTarget(request, response);

  return {
    ...(request.requireExactResponseTarget ? {
      provenance: "http" as const,
      request: { endpoint: request.endpoint, method: request.init.method ?? "GET", origin: request.origin,
        finalUrl: response.url, redirected: response.redirected },
    } : {}),
    data: payload as T,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
}

function assertExactResponseTarget(request: PreparedRequest, response: Response, requireObservedUrl = false): void {
  if (!request.requireExactResponseTarget) return;
  let sameTarget = response.redirected === false && !!request.origin;
  if (sameTarget && (response.url || requireObservedUrl)) {
    try {
      const target = new URL(response.url);
      sameTarget = target.origin === request.origin && `${target.pathname}${target.search}` === request.endpoint &&
        !target.hash && !target.username && !target.password;
    } catch { sameTarget = false; }
  }
  if (!sameTarget) {
    void response.body?.cancel().catch(() => undefined);
    throw createLocalApiError(409, "RESPONSE_TARGET_UNCONFIRMED");
  }
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
  return waitForOperation(
    runActivityCheckpoint(),
    request.init.signal ?? undefined,
  );
}

function checkpointTenantActivityIfDue(): void {
  const sessionId = getStoredTenantSessionMeta()?.sessionId;
  if (
    !sessionId ||
    activityTouchInFlight?.sessionId === sessionId ||
    document.visibilityState !== "visible" ||
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    Date.now() - lastActivityTouchAt < RECENT_USER_ACTIVITY_MS ||
    Date.now() - lastActivityAttemptAt < ACTIVITY_RETRY_MS
  ) {
    return;
  }
  void runActivityCheckpoint();
}

function runActivityCheckpoint(): Promise<void> {
  const sessionId = getStoredTenantSessionMeta()?.sessionId;
  if (!sessionId) return Promise.resolve();
  if (!hasTenantSessionCookieHint()) {
    endTenantBrowserSession(sessionId);
    return Promise.resolve();
  }
  if (activityTouchInFlight?.sessionId === sessionId) {
    return activityTouchInFlight.promise;
  }
  if (Date.now() - lastActivityAttemptAt < ACTIVITY_RETRY_MS) {
    return Promise.resolve();
  }
  lastActivityAttemptAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  const operation = (async () => {
    try {
      await customTenantFetch(
        "/api/tenant/core/v1/auth/activity",
        {
          method: "POST",
          headers: {
            "x-auth-user-activity": "1",
          },
          cache: "no-store",
          signal: controller.signal,
          replayAfterRefresh: true,
          skipAutoIdempotency: true,
          maxResponseBytes: 65_536,
        },
      );
      lastActivityTouchAt = Date.now();
    } catch (error) {
      if (
        getStoredTenantSessionMeta()?.sessionId !== sessionId ||
        isDefinitiveAuthFailure(error) ||
        getAuthErrorCode(error) === "AUTH_SESSION_CHANGED"
      ) {
        return;
      }
      console.warn("Tenant activity checkpoint failed.", {
        status: getAuthErrorStatus(error),
        code: getAuthErrorCode(error) ?? "ACTIVITY_CHECKPOINT_UNAVAILABLE",
      });
    } finally {
      clearTimeout(timeout);
    }
  })();
  const inFlight = { sessionId, promise: operation };
  activityTouchInFlight = inFlight;
  void operation.then(
    () => {
      if (activityTouchInFlight === inFlight) activityTouchInFlight = null;
    },
    () => {
      if (activityTouchInFlight === inFlight) activityTouchInFlight = null;
    },
  );
  return operation;
}

function isTenantCoreEndpoint(endpoint: string): boolean {
  return endpoint.startsWith("/api/tenant/core/v1/");
}

export async function coordinateTenantSessionRefresh(
  expectedSessionId = getStoredTenantSessionMeta()?.sessionId,
  observedEvent = readLatestTenantAuthEvent(),
  signal?: AbortSignal,
): Promise<void> {
  const currentMetadata = getStoredTenantSessionMeta();
  const currentSessionId = currentMetadata?.sessionId;
  const targetSessionId = expectedSessionId ?? currentSessionId;
  try {
    assertAuthSnapshotIsCurrent(currentMetadata, observedEvent);
    if (!targetSessionId || currentSessionId !== targetSessionId) {
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    if (isNewerSameSessionEvent(currentMetadata, observedEvent)) {
      synchronizeTenantTabSession(observedEvent);
      publishTenantAuthLifecycle("AUTHENTICATED");
      return;
    }
    if (refreshInFlight && refreshInFlight.sessionId !== targetSessionId) {
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    const operation = refreshInFlight?.promise ?? startTenantRefresh(
      targetSessionId,
      observedEvent,
    );
    const result = await waitForOperation(operation, signal);
    if (result.sessionId !== targetSessionId) {
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
  } catch (error) {
    if (isDefinitiveAuthFailure(error)) {
      endTenantBrowserSession(targetSessionId ?? null, getAuthErrorCode(error));
    } else if (
      !isAbortError(error) &&
      getAuthErrorCode(error) !== "AUTH_SESSION_CHANGED" &&
      getStoredTenantSessionMeta()?.sessionId === targetSessionId
    ) {
      publishTenantAuthLifecycle("DEGRADED");
    }
    throw error;
  }
}

function startTenantRefresh(
  expectedSessionId: string,
  observedEvent: TenantAuthEvent | null,
): Promise<{ sessionId: string }> {
  const operation = withTenantAuthLock(async (signal) => {
    if (getStoredTenantSessionMeta()?.sessionId !== expectedSessionId) {
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    const latest = readLatestTenantAuthEvent();
    if (
      latest?.kind === "session-ended" &&
      expectedSessionId &&
      latest.sessionId === expectedSessionId
    ) {
      throw createLocalApiError(401, "AUTH_SESSION_ENDED");
    }
    if (latest && latest.eventId !== observedEvent?.eventId) {
      if (
        latest.kind === "session-updated" &&
        latest.sessionId === expectedSessionId
      ) {
        synchronizeTenantTabSession(latest);
        publishTenantAuthLifecycle("AUTHENTICATED");
        return { sessionId: latest.sessionId };
      }
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }

    const auth = await refreshTenantCookieSession(
      undefined,
      expectedSessionId,
      signal,
    );
    return { sessionId: auth.session.id };
  });
  const inFlight = { sessionId: expectedSessionId, promise: operation };
  refreshInFlight = inFlight;
  void operation.then(
    () => {
      if (refreshInFlight === inFlight) refreshInFlight = null;
    },
    () => {
      if (refreshInFlight === inFlight) refreshInFlight = null;
    },
  );
  return operation;
}

function isTenantActivityEndpoint(endpoint: string): boolean {
  return endpoint === "/api/tenant/core/v1/auth/activity";
}

function waitForOperation<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Request aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Request aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function createRequestHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has("Accept-Language")) {
    // Match useLanguage's stored selection and English default, not the browser locale.
    headers.set("Accept-Language", readLanguage());
  }
  return headers;
}

function prepareRequest(
  endpoint: string,
  options: TenantApiRequestConfig,
  eventBeforeRequest: TenantAuthEvent | null,
  capturedSessionMetadata: TenantSessionMetadata | null,
): PreparedRequest {
  assertRelativeGatewayEndpoint(endpoint);
  const {
    assertCurrent,
    requireExactResponseTarget = false,
    responseType = "json",
    expectedBinaryContentType,
    timeoutMs: _timeoutMs,
    skipAuthRefresh = false,
    suppressForbiddenToast = false,
    nonReplayable = false,
    replayAfterRefresh: replayAfterRefreshOverride = false,
    skipAutoIdempotency = false,
    maxResponseBytes,
    maxBinaryResponseBytes,
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
  // Core's template-render storage bucket and PDF result contract allow 25 MiB.
  if (maxBinaryResponseBytes !== undefined && (responseType !== "blob" ||
    !Number.isSafeInteger(maxBinaryResponseBytes) || maxBinaryResponseBytes < 1 ||
    maxBinaryResponseBytes > 25 * 1024 * 1024)) {
    throw createLocalApiError(500, "INVALID_RESPONSE_BYTE_BOUND");
  }
  const headers = createRequestHeaders(requestInit.headers);
  const method = (requestInit.method ?? "GET").toUpperCase();
  const publicAuthEndpoint = isPublicTenantAuthEndpoint(endpoint);
  const sessionMetadata = publicAuthEndpoint
    ? null
    : capturedSessionMetadata;
  const hasCallerIdempotencyKey = headers.has("x-idempotency-key");
  if (!headers.has("Accept")) {
    headers.set("Accept", responseType === "blob" ? "*/*" : "application/json");
  }
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
  const csrfToken = readTenantCsrfCookie();
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

  return {
    assertCurrent,
    requireExactResponseTarget,
    origin: typeof window === "undefined" ? undefined : window.location.origin,
    endpoint,
    url: endpoint,
    responseType,
    expectedBinaryContentType,
    maxBinaryResponseBytes,
    skipAuthRefresh,
    suppressForbiddenToast,
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
  return (
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    lastUserInteractionAt > 0 &&
    Date.now() - lastUserInteractionAt <= RECENT_USER_ACTIVITY_MS
  );
}

function assertRequestFenceIsCurrent(
  request: PreparedRequest,
  eventBeforeRequest: TenantAuthEvent | null,
): void {
  if (request.publicAuthEndpoint) return;
  const metadata = getStoredTenantSessionMeta();
  const latest = readLatestTenantAuthEvent();
  if (
    (request.hadSessionMetadata &&
      metadata?.sessionId !== request.sessionId) ||
    (metadata && request.sessionId && metadata.sessionId !== request.sessionId) ||
    (latest &&
      latest.eventId !== eventBeforeRequest?.eventId &&
      (latest.kind === "session-ended" ||
        latest.sessionId !== request.sessionId))
  ) {
    throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
  }
  request.assertCurrent?.();
}

function assertAuthSnapshotIsCurrent(
  metadata: TenantSessionMetadata | null,
  event: TenantAuthEvent | null,
): void {
  if (!metadata || !event) return;
  if (
    event.kind === "session-updated" &&
    event.sessionId === metadata.sessionId
  ) {
    return;
  }
  if (event.issuedAt < metadata.savedAt) return;
  if (event.kind === "session-ended" && event.sessionId === metadata.sessionId) {
    throw createLocalApiError(401, "AUTH_SESSION_ENDED");
  }
  throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
}

function isNewerSameSessionEvent(
  metadata: TenantSessionMetadata | null,
  event: TenantAuthEvent | null,
): event is TenantAuthEvent & { kind: "session-updated" } {
  return Boolean(
    metadata &&
    event?.kind === "session-updated" &&
    event.timing !== undefined &&
    event.sessionId === metadata.sessionId &&
    event.eventId !== metadata.authEventId &&
    event.issuedAt >= metadata.savedAt,
  );
}

export function synchronizeTenantTabSession(event: TenantAuthEvent): boolean {
  if (
    typeof window === "undefined" ||
    event.kind !== "session-updated" ||
    !event.timing
  ) {
    return false;
  }
  const metadata = getStoredTenantSessionMeta();
  if (
    metadata?.authEventId === event.eventId ||
    (metadata && event.issuedAt < metadata.savedAt)
  ) {
    return false;
  }
  if (metadata && metadata.sessionId !== event.sessionId) {
    lastUserInteractionAt = 0;
    lastActivityAttemptAt = 0;
    lastActivityTouchAt = 0;
  }
  safeSessionStorage.setItem(SESSION_META_KEY, JSON.stringify({
    savedAt: event.issuedAt,
    expiresIn: event.timing.expiresIn,
    sessionExpiresIn: event.timing.sessionExpiresIn,
    tokenType: "Bearer",
    sessionId: event.sessionId,
    remember:
      metadata?.sessionId === event.sessionId
        ? metadata.remember
        : safeStorage.getItem(REMEMBER_PREFERENCE_KEY) === "1",
    authorizationVersion: event.timing.authorizationVersion,
    profileVersion: event.timing.profileVersion,
    authEventId: event.eventId,
  } satisfies TenantSessionMetadata));
  return true;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * `reason` is the wire code the server ended the session with, when one was
 * observed. It rides the in-tab lifecycle channel rather than the cross-tab
 * event because a tombstone is read by tabs that never saw the failure, and a
 * code they cannot verify is worse than no code at all.
 */
function endTenantBrowserSession(
  expectedSessionId: string | null,
  reason?: string,
): void {
  const sessionId = getStoredTenantSessionMeta()?.sessionId ?? null;
  if (!expectedSessionId || sessionId !== expectedSessionId) return;
  clearLocalTenantAuthState();
  publishTenantAuthEvent("session-ended", sessionId, true);
  publishTenantAuthLifecycle("ENDED", reason);
}

function removeLegacyBrowserTokens(): void {
  if (typeof window === "undefined") return;
  for (const key of ["auth-token", "access_token", "refresh_token"]) {
    safeSessionStorage.removeItem(key);
    safeStorage.removeItem(key);
  }
}

/** A readable cookie permits a server check; it never proves authentication. */
export function hasTenantSessionCookieHint(): boolean {
  return Boolean(readTenantCsrfCookie());
}

function readTenantCsrfCookie(): string | undefined {
  const names = typeof window !== "undefined" && window.location?.protocol === "http:"
    ? [TENANT_HTTP_CSRF_COOKIE, TENANT_CSRF_COOKIE]
    : [TENANT_CSRF_COOKIE, TENANT_HTTP_CSRF_COOKIE];
  return readBrowserCookie(names[0]) || readBrowserCookie(names[1]);
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
  request?: PreparedRequest,
): Promise<unknown> {
  const { maxResponseBytes, maxBinaryResponseBytes } = request ?? {};
  if (response.ok && request?.responseType === "blob") {
    const { expectedBinaryContentType } = request;
    if (expectedBinaryContentType !== undefined) {
      const { signal } = request.init;
      const contentType = response.headers.get("content-type")?.trim().toLowerCase();
      const encoding = response.headers.get("content-encoding");
      if (signal?.aborted || response.status !== 200 || contentType !== expectedBinaryContentType.toLowerCase() ||
          (encoding !== null && encoding.toLowerCase() !== "identity")) {
        void response.body?.cancel().catch(() => undefined);
        signal?.throwIfAborted();
        throw createLocalApiError(502, "API_RESPONSE_INVALID_BINARY_DOWNLOAD");
      }
    }
    if (maxBinaryResponseBytes !== undefined) {
      const bytes = await readBoundedResponseBytes(response, maxBinaryResponseBytes, request.init.signal);
      return new Blob([bytes], { type: response.headers.get("content-type") ?? "" });
    }
    const blob = await response.blob();
    if (maxResponseBytes !== undefined && blob.size > maxResponseBytes) {
      throw createLocalApiError(502, "API_RESPONSE_TOO_LARGE");
    }
    return blob;
  }
  const text = maxBinaryResponseBytes !== undefined && maxResponseBytes !== undefined
    ? new TextDecoder().decode(await readBoundedResponseBytes(response, maxResponseBytes, request?.init.signal))
    : await response.text();
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

async function readBoundedResponseBytes(response: Response, limit: number, signal?: AbortSignal | null) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const bytes = new Uint8Array(limit);
  let offset = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) return bytes.subarray(0, offset);
      if (chunk.value.byteLength > limit - offset) throw createLocalApiError(502, "API_RESPONSE_TOO_LARGE");
      bytes.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

async function normalizeApiError(
  response: Response,
  payload: unknown,
  endpoint?: string,
  method?: string,
  origin?: string,
): Promise<TenantApiClientError> {
  const body = record(payload) ?? {};
  const unavailable = response.status === 503 && endpoint !== undefined &&
    /^\/api\/tenant\/core\/v1\/auth\/(login|forgot-password|reset-password|accept-invite)\/?$/u.test(endpoint);
  // Only the auth-unavailable copy is local; every other message is the
  // server's. A failed translation download falls back to that server copy.
  const copy = unavailable ? await getActiveDictionary().catch(() => null) : null;
  const message = copy ? copy.auth.temporarilyUnavailable : firstString(
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
  }, "http", endpoint && method ? {
    endpoint, method, origin, finalUrl: response.url, redirected: response.redirected,
  } : undefined, Object.freeze({ ...body }));
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
  }, "client");
}

// The one permitted i18n change inside the transport — see
// docs/architecture/data-layer.md#permitted-changes (D9 in DEFECTS.md).
// The provider seeds this getter; standalone callers load only their active
// language. A failed translation download must not mask the original 403.
async function dispatchForbiddenToast(code: string | undefined, assertOutcomeCurrent: () => void): Promise<void> {
  if (typeof window === "undefined") return;
  const t = await getActiveDictionary().catch(() => null);
  if (!t) return;
  assertOutcomeCurrent();
  const errors: Readonly<Record<string, string>> = t.coreIdentity.errors;
  const message = code && Object.prototype.hasOwnProperty.call(errors, code)
    ? errors[code]
    : t.errors.accessDeniedMessage;
  window.dispatchEvent(
    new CustomEvent("global-toast", {
      detail: {
        type: "error",
        title: t.errors.accessDenied,
        message,
        dedupeKey: `forbidden:${code ?? "UNKNOWN_ERROR"}`,
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
    "/auth/mfa/verify",
    "/auth/mfa/resend",
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
    !endpoint.startsWith("/api/tenant/") ||
    endpoint.includes("\\") ||
    Array.from(endpoint).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 32 || code === 127;
    }) ||
    !new URL(endpoint, "https://tenant.invalid").pathname.startsWith("/api/tenant/")
  ) {
    throw createLocalApiError(400, "INVALID_TENANT_ENDPOINT");
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
