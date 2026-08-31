import {
  classifyAuthFailure,
  getAdminAuthRetryDelayMs,
  getAuthErrorCode,
  getAuthErrorStatus,
  isAdminRefreshDue,
  isDefinitiveAuthFailure,
} from "../auth/sessionRefresh";
import {
  publishAdminAuthEvent,
  publishAdminAuthLifecycle,
  readLatestAdminAuthEvent,
  type AdminAuthEvent,
  type AdminAuthEventTiming,
} from "../auth/sessionCoordinator";
import { safeSessionStorage, safeStorage } from "../safeStorage";
import { generateUUIDv7 } from "../utils/uuid";

// Cookie auth and the readable double-submit CSRF proof require the canonical
// Gateway path to remain on the portal origin. Deployment ingress owns /api/*.
const API_BASE_URL = "";
const SESSION_META_KEY = "admin_session_meta";
const REMEMBER_PREFERENCE_KEY = "admin_auth_remember";
const ADMIN_CSRF_COOKIE = "__Host-mutakamel-admin-csrf";
const ADMIN_COOKIE_QUARANTINE_KEY = "admin_auth_cookie_quarantine";
const ADMIN_COOKIE_QUARANTINE_COOKIE = "mutakamel_admin_cookie_quarantine";
const ADMIN_COOKIE_QUARANTINE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_COOKIE_QUARANTINE_MAX_AGE_MS =
  ADMIN_COOKIE_QUARANTINE_MAX_AGE_SECONDS * 1_000;
const ADMIN_COOKIE_CLEANUP_LEASE_KEY_PREFIX =
  "admin_auth_cookie_cleanup_lease:";
const ADMIN_COOKIE_CLEANUP_LEASE_COOKIE_PREFIX =
  "mutakamel_admin_cookie_cleanup_lease_";
const ADMIN_AUTH_MUTEX_ENTRY_KEY_PREFIX = "admin_auth_mutex_entry:";
const ADMIN_AUTH_MUTEX_ENTRY_COOKIE_PREFIX = "mutakamel_admin_mutex_entry_";
const ADMIN_AUTH_INTENT_KEY = "admin_auth_intent";
const ADMIN_AUTH_INTENT_COOKIE = "mutakamel_admin_auth_intent";
const RECENT_USER_ACTIVITY_MS = 60_000;
export const ADMIN_VISIBLE_PRESENCE_MAX_INTERVAL_MS = 5 * 60_000;
const ADMIN_ACTIVITY_TOUCH_TIMEOUT_MS = 5_000;
const ADMIN_ACTIVITY_RETRY_COOLDOWN_MS = 5_000;
const ADMIN_PRESENCE_CHECKPOINT_TIMEOUT_MS = 5_000;
const ADMIN_PRESENCE_RETRY_MIN_MS = 5_000;
const ADMIN_PRESENCE_RETRY_MAX_MS = 30_000;
const ADMIN_COOKIE_CLEANUP_TIMEOUT_MS = 5_000;
// Gateway bounds non-streaming auth upstream work to at most 30 seconds.
// Four times that horizon covers a late browser-delivered response while
// allowing an orphaned tab lease to retire without blocking login for days.
const ADMIN_COOKIE_CLEANUP_LEASE_TTL_MS = 120_000;
const ADMIN_COOKIE_CLEANUP_LEASE_POLL_MS = 100;
const ADMIN_AUTH_MUTEX_WAITING_LEASE_TTL_MS = 60_000;
const ADMIN_AUTH_MUTEX_ACTIVE_LEASE_TTL_MS = 13 * 60 * 60 * 1_000;
const ADMIN_AUTH_MUTEX_POLL_MS = 25;
const ADMIN_SHARED_REFRESH_TIMEOUT_MS = 30_000;
const ADMIN_REFRESH_WAITER_TIMEOUT_MS = 35_000;
// Keep replay-safe user work pending through a normal rolling restart window
// (1+2+4+8+16+30+30+30 = 121 seconds) without retrying the business request.
const ADMIN_REQUEST_REFRESH_MAX_RETRIES = 8;

let lastUserInteractionAt = 0;
let activityTrackingInstalled = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface ApiRequestConfig extends RequestInit {
  /** Do not repair an expired access cookie for this request. */
  skipAuthRefresh?: boolean;
  /**
   * Bypass client-side session identity binding for an unauthenticated
   * handshake or best-effort cleanup. Never use for business operations.
   */
  skipSessionBinding?: boolean;
  /**
   * Refresh may still repair the browser session, but the original request is
   * never replayed because its server-side outcome can be ambiguous.
   */
  nonReplayable?: boolean;
  /**
   * Explicitly allow one replay after refresh for a naturally idempotent
   * mutation that does not use a caller-owned idempotency key.
   */
  replayAfterRefresh?: boolean;
  /** The Gateway route explicitly does not participate in idempotency. */
  skipAutoIdempotency?: boolean;
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

export interface SessionTokenMetadata {
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

export type AdminAuthHandling =
  | "session-ended"
  | "permission-denied"
  | "repair-degraded";

export type ApiRequestOutcome = "settled-before-session-change";

export class ApiClientError extends Error {
  adminAuthHandling?: AdminAuthHandling;
  requestOutcome?: ApiRequestOutcome;

  readonly response: {
    status: number;
    statusText: string;
    headers: Headers;
    data: Record<string, unknown>;
  };

  constructor(
    message: string,
    response: ApiClientError["response"],
  ) {
    super(message);
    this.name = "ApiClientError";
    this.response = response;
  }
}

export function getAdminAuthHandling(
  error: unknown,
): AdminAuthHandling | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const handling = (error as { adminAuthHandling?: unknown }).adminAuthHandling;
  return handling === "session-ended" ||
    handling === "permission-denied" ||
    handling === "repair-degraded"
    ? handling
    : undefined;
}

export function getApiRequestOutcome(
  error: unknown,
): ApiRequestOutcome | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as { requestOutcome?: unknown }).requestOutcome ===
    "settled-before-session-change"
    ? "settled-before-session-change"
    : undefined;
}

interface PreparedRequest {
  endpoint: string;
  url: string;
  init: RequestInit;
  skipAuthRefresh: boolean;
  replayAfterRefresh: boolean;
  publicAuthEndpoint: boolean;
  sessionBindingExempt: boolean;
}

interface AdminRefreshEpoch {
  eventId?: string;
  sessionId?: string;
}

interface SharedAdminRefreshOperation {
  epoch: AdminRefreshEpoch | null;
  promise: Promise<void>;
}

interface AdminActivityTouchOperation {
  sessionId: string;
  promise: Promise<void>;
}

interface AdminActivityTouchState {
  sessionId: string;
  lastAttemptAt: number;
  lastSuccessAt: number;
}

interface AdminPresenceTiming {
  sessionId: string;
  sessionExpiresIn: number;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

interface AdminPresenceCheckpoint {
  sessionId: string;
  requestStartedAt: number;
  timing: AdminPresenceTiming;
}

interface AdminPresenceCheckpointOperation {
  sessionId: string;
  promise: Promise<AdminPresenceCheckpoint | null>;
}

interface AdminCookieCleanupOperation {
  generation: string;
  promise: Promise<boolean>;
}

interface AdminCookieCleanupLease {
  generation: string;
  expiresAt: number;
}

interface AdminAuthMutexEntry {
  id: string;
  state: "waiting" | "active";
  createdAt: number;
  expiresAt: number;
}

interface AdminAuthIntent {
  id: string;
  createdAt: number;
}

export interface AdminTabSessionSynchronization {
  sessionChanged: boolean;
  timingAdopted: boolean;
  claimsChanged: boolean;
  ignored: boolean;
}

export interface AdminVisibleSessionPresenceScheduler {
  /** Re-arm from the latest server-issued session timing without touching Core. */
  reschedule: () => void;
  /** Reconcile the timer after visibility, focus, page-show, or online changes. */
  wake: () => void;
  /** Reconcile the timer after document visibility changes. */
  syncVisibility: () => void;
  /** Cancel future presence checkpoints. An in-flight checkpoint may settle. */
  stop: () => void;
}

let refreshInFlight: SharedAdminRefreshOperation | null = null;
let activityTouchInFlight: AdminActivityTouchOperation | null = null;
let activityTouchState: AdminActivityTouchState | null = null;
let presenceCheckpointInFlight: AdminPresenceCheckpointOperation | null = null;
let adminCookieCleanupInFlight: AdminCookieCleanupOperation | null = null;
let fallbackAdminAuthIntent: AdminAuthIntent | null = null;

export function readWebAuthSessionResponse(
  payload: unknown,
): WebAuthSessionResponse | null {
  const root = record(payload);
  if (!root) return null;
  const target = record(root.data) ?? root;

  // A browser response must never contain bearer or refresh-token material.
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

export async function withAuthLock<T>(
  callback: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.locks?.request === "function"
  ) {
    return navigator.locks.request(
      "admin_auth_mutex",
      { mode: "exclusive", ...(signal ? { signal } : {}) },
      callback,
    );
  }
  return withFallbackAdminAuthLock(callback, signal);
}

async function withFallbackAdminAuthLock<T>(
  callback: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const latestIntent = readAdminAuthIntent();
  const createdAt = Math.max(
    Date.now(),
    latestIntent ? latestIntent.createdAt + 1 : 0,
  );
  const entry: AdminAuthMutexEntry = {
    id: generateUUIDv7(),
    state: "waiting",
    createdAt,
    expiresAt: Date.now() + ADMIN_AUTH_MUTEX_WAITING_LEASE_TTL_MS,
  };
  writeAdminAuthMutexEntry(entry);
  const renewalTimer = setInterval(() => {
    entry.expiresAt = Date.now() + adminAuthMutexLeaseTtlMs(entry.state);
    writeAdminAuthMutexEntry(entry);
  }, Math.floor(ADMIN_AUTH_MUTEX_WAITING_LEASE_TTL_MS / 3));
  try {
    await acquireFallbackAdminAuthLock(entry, signal);
    fallbackAdminAuthIntent = { id: entry.id, createdAt: entry.createdAt };
    return await callback();
  } finally {
    clearInterval(renewalTimer);
    if (fallbackAdminAuthIntent?.id === entry.id) {
      fallbackAdminAuthIntent = null;
    }
    removeAdminAuthMutexEntry(entry.id);
  }
}

async function acquireFallbackAdminAuthLock(
  entry: AdminAuthMutexEntry,
  signal?: AbortSignal,
): Promise<void> {
  for (;;) {
    throwIfAborted(signal);
    assertAdminAuthIntentNotSuperseded(entry);
    const entries = [
      ...readAdminAuthMutexEntries().filter((candidate) =>
        candidate.id !== entry.id),
      entry,
    ];
    const activeOther = entries.some((candidate) =>
      candidate.id !== entry.id && candidate.state === "active");
    const firstWaiter = entries
      .filter((candidate) => candidate.state === "waiting")
      .sort(compareAdminAuthMutexEntries)[0];
    if (activeOther || firstWaiter?.id !== entry.id) {
      await waitForAdminAuthMutexPoll(signal);
      continue;
    }

    entry.state = "active";
    entry.expiresAt = Date.now() + ADMIN_AUTH_MUTEX_ACTIVE_LEASE_TTL_MS;
    writeAdminAuthMutexEntry(entry);
    writeAdminAuthIntent(entry);
    const confirmedEntries = readAdminAuthMutexEntries();
    const conflict = confirmedEntries.some((candidate) =>
      candidate.id !== entry.id && candidate.state === "active");
    if (!conflict) {
      writeAdminAuthIntent(entry);
      return;
    }

    entry.state = "waiting";
    entry.expiresAt = Date.now() + ADMIN_AUTH_MUTEX_WAITING_LEASE_TTL_MS;
    writeAdminAuthMutexEntry(entry);
    await waitForAdminAuthMutexPoll(signal);
  }
}

function compareAdminAuthMutexEntries(
  left: AdminAuthMutexEntry,
  right: AdminAuthMutexEntry,
): number {
  return left.createdAt - right.createdAt || left.id.localeCompare(right.id);
}

function writeAdminAuthIntent(entry: AdminAuthMutexEntry): void {
  const intent: AdminAuthIntent = {
    id: entry.id,
    createdAt: entry.createdAt,
  };
  const serialized = JSON.stringify(intent);
  safeStorage.setItem(ADMIN_AUTH_INTENT_KEY, serialized);
  writeBrowserCoordinationCookie(
    ADMIN_AUTH_INTENT_COOKIE,
    serialized,
    ADMIN_COOKIE_QUARANTINE_MAX_AGE_SECONDS,
  );
}

function readAdminAuthIntent(): AdminAuthIntent | null {
  const candidates: AdminAuthIntent[] = [];
  for (const value of [
    readBrowserCookie(ADMIN_AUTH_INTENT_COOKIE),
    safeStorage.getItem(ADMIN_AUTH_INTENT_KEY),
  ]) {
    if (!value) continue;
    try {
      const candidate = JSON.parse(value) as Partial<AdminAuthIntent>;
      if (
        typeof candidate.id === "string" &&
        typeof candidate.createdAt === "number" &&
        Number.isFinite(candidate.createdAt)
      ) {
        candidates.push(candidate as AdminAuthIntent);
      }
    } catch {
      // Try the other shared coordination channel.
    }
  }
  return candidates.sort((left, right) =>
    right.createdAt - left.createdAt || right.id.localeCompare(left.id))[0] ?? null;
}

function assertAdminAuthIntentNotSuperseded(
  entry: Pick<AdminAuthIntent, "id" | "createdAt">,
): void {
  const latest = readAdminAuthIntent();
  if (
    latest &&
    latest.id !== entry.id &&
    (latest.createdAt > entry.createdAt ||
      (latest.createdAt === entry.createdAt && latest.id > entry.id))
  ) {
    throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
  }
}

function assertFallbackAdminAuthIntentCurrent(): void {
  if (!fallbackAdminAuthIntent) return;
  const latest = readAdminAuthIntent();
  if (!latest || latest.id !== fallbackAdminAuthIntent.id) {
    throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
  }
}

async function assertFallbackAdminAuthIntentCurrentAfterAuthResponse(): Promise<void> {
  if (!fallbackAdminAuthIntent) return;
  const latest = readAdminAuthIntent();
  if (latest?.id === fallbackAdminAuthIntent.id) return;
  await failClosedAdminCookieSessionMismatch(
    currentAdminRefreshEpoch()?.sessionId,
  );
}

async function readResponsePayloadWithFallbackAdminAuthFence(
  response: Response,
  cookieMutation: boolean,
): Promise<unknown> {
  try {
    return await readResponsePayload(response);
  } finally {
    if (cookieMutation) {
      await assertFallbackAdminAuthIntentCurrentAfterAuthResponse();
    } else {
      assertFallbackAdminAuthIntentCurrent();
    }
  }
}

function adminAuthMutexLeaseTtlMs(
  state: AdminAuthMutexEntry["state"],
): number {
  return state === "active"
    ? ADMIN_AUTH_MUTEX_ACTIVE_LEASE_TTL_MS
    : ADMIN_AUTH_MUTEX_WAITING_LEASE_TTL_MS;
}

function writeAdminAuthMutexEntry(entry: AdminAuthMutexEntry): void {
  const serialized = JSON.stringify(entry);
  safeStorage.setItem(
    `${ADMIN_AUTH_MUTEX_ENTRY_KEY_PREFIX}${entry.id}`,
    serialized,
  );
  writeBrowserCoordinationCookie(
    `${ADMIN_AUTH_MUTEX_ENTRY_COOKIE_PREFIX}${entry.id}`,
    serialized,
    Math.ceil(Math.max(1, entry.expiresAt - Date.now()) / 1_000),
  );
}

function removeAdminAuthMutexEntry(id: string): void {
  safeStorage.removeItem(`${ADMIN_AUTH_MUTEX_ENTRY_KEY_PREFIX}${id}`);
  writeBrowserCoordinationCookie(
    `${ADMIN_AUTH_MUTEX_ENTRY_COOKIE_PREFIX}${id}`,
    "",
    0,
  );
}

function readAdminAuthMutexEntries(now = Date.now()): AdminAuthMutexEntry[] {
  const entries = new Map<string, AdminAuthMutexEntry>();
  const accept = (candidate: AdminAuthMutexEntry | null) => {
    if (!candidate) return;
    if (candidate.expiresAt <= now) {
      removeAdminAuthMutexEntry(candidate.id);
      return;
    }
    const existing = entries.get(candidate.id);
    if (
      !existing ||
      (candidate.state === "active" && existing.state !== "active") ||
      candidate.expiresAt > existing.expiresAt
    ) {
      entries.set(candidate.id, candidate);
    }
  };

  try {
    if (typeof window !== "undefined") {
      const storage = window.localStorage;
      const keys = Array.from(
        { length: storage.length },
        (_, index) => storage.key(index),
      ).filter((key): key is string => key !== null);
      for (const key of keys) {
        if (!key.startsWith(ADMIN_AUTH_MUTEX_ENTRY_KEY_PREFIX)) continue;
        accept(parseAdminAuthMutexEntry(storage.getItem(key)));
      }
    }
  } catch {
    // The same-site mutex cookies remain the fallback coordination channel.
  }

  if (typeof document !== "undefined") {
    for (const pair of document.cookie.split(";")) {
      const [rawName, rawValue = ""] = pair.trim().split("=", 2);
      if (!rawName.startsWith(ADMIN_AUTH_MUTEX_ENTRY_COOKIE_PREFIX)) continue;
      let decodedValue: string;
      try {
        decodedValue = decodeURIComponent(rawValue);
      } catch {
        decodedValue = "";
      }
      accept(parseAdminAuthMutexEntry(decodedValue));
    }
  }
  return Array.from(entries.values());
}

function parseAdminAuthMutexEntry(value: string | null): AdminAuthMutexEntry | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<AdminAuthMutexEntry>;
    if (
      typeof candidate.id !== "string" ||
      (candidate.state !== "waiting" && candidate.state !== "active") ||
      typeof candidate.createdAt !== "number" ||
      !Number.isFinite(candidate.createdAt) ||
      typeof candidate.expiresAt !== "number" ||
      !Number.isFinite(candidate.expiresAt)
    ) {
      return null;
    }
    return candidate as AdminAuthMutexEntry;
  } catch {
    return null;
  }
}

function waitForAdminAuthMutexPoll(signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, ADMIN_AUTH_MUTEX_POLL_MS);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortedRequestError(signal));
    };
    function finish() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export function getStoredSessionMeta(): SessionTokenMetadata | null {
  if (typeof window === "undefined") return null;
  removeLegacyBrowserTokens();
  try {
    const parsed = JSON.parse(
      safeSessionStorage.getItem(SESSION_META_KEY) ?? "null",
    ) as Partial<SessionTokenMetadata> | null;
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
    return parsed as SessionTokenMetadata;
  } catch {
    return null;
  }
}

export function storeAdminSessionMetadata(
  response: WebAuthSessionResponse,
  remember: boolean,
  authEventId: string,
  savedAt = Date.now(),
): void {
  if (typeof window === "undefined") return;
  removeLegacyBrowserTokens();
  if (activityTouchState?.sessionId !== response.session.id) {
    resetAdminActivityState();
  }
  const metadata: SessionTokenMetadata = {
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
  clearAdminCookieQuarantine();
}

export function clearLocalAuthState(): void {
  if (typeof window === "undefined") return;
  safeSessionStorage.removeItem(SESSION_META_KEY);
  safeSessionStorage.removeItem("user_profile");
  safeStorage.removeItem(REMEMBER_PREFERENCE_KEY);
  resetAdminActivityState();
  removeLegacyBrowserTokens();
}

export async function refreshAdminCookieSession(
  rememberOverride?: boolean,
  signal?: AbortSignal,
  boundSession?: AdminRefreshEpoch | null,
): Promise<WebAuthSessionResponse> {
  await enforceAdminCookieQuarantine(false, signal);
  const storedMeta = getStoredSessionMeta();
  const remember =
    rememberOverride ??
    storedMeta?.remember ??
    safeStorage.getItem(REMEMBER_PREFERENCE_KEY) === "1";
  const csrfToken = readBrowserCookie(ADMIN_CSRF_COOKIE);
  assertFallbackAdminAuthIntentCurrent();
  const response = await fetch(
    `${API_BASE_URL}/api/admin/core/v1/auth/refresh`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      credentials: "include",
      cache: "no-store",
      ...(signal ? { signal } : {}),
    },
  );
  const payload = await readResponsePayloadWithFallbackAdminAuthFence(
    response,
    true,
  );

  if (!response.ok) throw normalizeApiError(response, payload);

  const auth = readWebAuthSessionResponse(payload);
  if (!auth) {
    throw createLocalApiError(500, "INVALID_REFRESH_RESPONSE");
  }

  if (boundSession !== undefined) {
    let currentSession: AdminRefreshEpoch | null;
    try {
      currentSession = advanceAdminRefreshEpoch(boundSession, false);
    } catch (error) {
      const expectedSessionId =
        currentAdminRefreshEpoch()?.sessionId ?? boundSession?.sessionId;
      if (expectedSessionId && auth.session.id !== expectedSessionId) {
        await failClosedAdminCookieSessionMismatch(expectedSessionId);
      }
      throw error;
    }
    if (currentSession?.sessionId && auth.session.id !== currentSession.sessionId) {
      await failClosedAdminCookieSessionMismatch(currentSession.sessionId);
    }
  }

  const event = publishAdminAuthEvent(
    "session-updated",
    auth.session.id,
    true,
    sessionEventTiming(auth),
  );
  storeAdminSessionMetadata(auth, remember, event.eventId, event.issuedAt);
  publishAdminAuthLifecycle("AUTHENTICATED");
  return auth;
}

/**
 * Refreshes through the same single-flight/Web-Lock path used by reactive 401
 * repair. Safe session metadata is used only as a coordination epoch; the
 * HttpOnly cookie and Core remain authoritative.
 */
export async function ensureAdminCookieSessionFresh(): Promise<void> {
  await coordinateAdminRefresh(currentAdminRefreshEpoch());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function customFetch<T = any>(
  endpoint: string,
  options: ApiRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const prepared = prepareRequest(endpoint, options);
  return sendPreparedRequest<T>(prepared, false);
}

async function sendPreparedRequest<T>(
  request: PreparedRequest,
  isRetry: boolean,
  boundSession?: AdminRefreshEpoch | null,
): Promise<AxiosResponse<T>> {
  if (!isAdminCookieQuarantineExemptEndpoint(request.endpoint)) {
    await enforceAdminCookieQuarantine(
      isAdminSessionEstablishingEndpoint(request.endpoint),
      request.init.signal,
    );
  }
  let requestSession = request.sessionBindingExempt
    ? null
    : boundSession === undefined
      ? currentAdminRefreshEpoch()
      : boundSession;
  await preflightAdminAccess(request, requestSession);
  if (!request.sessionBindingExempt) {
    requestSession = advanceAdminRefreshEpoch(requestSession, true);
    await touchCoreSessionForCrossAppActivity(request);
    requestSession = advanceAdminRefreshEpoch(requestSession, true);
  }
  const eventBeforeRequest = requestSession;
  assertFallbackAdminAuthIntentCurrent();
  const response = await fetch(request.url, request.init);
  const payload = await readResponsePayloadWithFallbackAdminAuthFence(
    response,
    isAdminAuthCookieMutationEndpoint(request.endpoint),
  );

  if (response.ok && isAdminLogoutEndpoint(request.endpoint)) {
    clearAdminCookieQuarantine();
  }

  if (!request.sessionBindingExempt) {
    try {
      requestSession = advanceAdminRefreshEpoch(requestSession, false);
    } catch (error) {
      markApiRequestOutcome(error, "settled-before-session-change");
      throw error;
    }
  }

  if (!response.ok) {
    const error = normalizeApiError(response, payload);
    const code = getAuthErrorCode(error);
    const disposition = classifyAuthFailure(response.status, code);

    if (disposition === "end" && !request.publicAuthEndpoint) {
      if (isAdminSessionSuperseded(eventBeforeRequest)) {
        throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
      }
      markAdminAuthHandling(error, "session-ended");
      endAdminBrowserSession();
      throw error;
    }

    if (
      response.status === 401 &&
      disposition === "refresh" &&
      !isRetry &&
      !request.skipAuthRefresh &&
      !request.publicAuthEndpoint
    ) {
      publishAdminAuthLifecycle("STALE");
      try {
        publishAdminAuthLifecycle("REFRESHING");
        requestSession = await coordinateAdminRefreshWithRetry(
          eventBeforeRequest,
          request.init.signal,
          request.replayAfterRefresh,
        );
      } catch (refreshError) {
        if (request.init.signal?.aborted || isAbortError(refreshError)) {
          throw refreshError;
        }
        if (getAdminAuthHandling(refreshError) === "session-ended") {
          throw refreshError;
        }
        if (isDefinitiveAuthFailure(refreshError)) {
          markAdminAuthHandling(refreshError, "session-ended");
          endAdminBrowserSession();
        } else {
          markAdminAuthHandling(refreshError, "repair-degraded");
          publishAdminAuthLifecycle("DEGRADED");
        }
        throw refreshError;
      }

      // Repairing authentication and replaying a business command are two
      // separate decisions. Ambiguous/non-idempotent writes stop here.
      if (!request.replayAfterRefresh) throw error;

      return sendPreparedRequest<T>(
        request,
        true,
        requestSession,
      );
    }

    if (
      response.status === 401 &&
      disposition === "refresh" &&
      isRetry &&
      !request.publicAuthEndpoint
    ) {
      markAdminAuthHandling(error, "repair-degraded");
      publishAdminAuthLifecycle("DEGRADED");
      throw error;
    }

    if (response.status === 403 && !request.publicAuthEndpoint) {
      markAdminAuthHandling(error, "permission-denied");
      dispatchForbiddenToast();
    }
    throw error;
  }

  return {
    data: payload as T,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
}

async function preflightAdminAccess(
  request: PreparedRequest,
  boundSession: AdminRefreshEpoch | null,
): Promise<void> {
  const metadata = getStoredSessionMeta();
  if (
    request.publicAuthEndpoint ||
    request.skipAuthRefresh ||
    !metadata ||
    !isAdminRefreshDue(metadata)
  ) {
    return;
  }

  try {
    await coordinateAdminRefreshWithRetry(
      boundSession,
      request.init.signal,
      isStoredAccessExpired(metadata),
    );
  } catch (error) {
    const code = getAuthErrorCode(error);
    if (isDefinitiveAuthFailure(error)) {
      markAdminAuthHandling(error, "session-ended");
      endAdminBrowserSession();
      throw error;
    }
    if (code === "AUTH_SESSION_CHANGED") throw error;

    // A proactive attempt is deliberately invisible. If the existing access
    // cookie is still valid, let the protected request proceed while the
    // background scheduler retries. Once it is expired, fail with the actual
    // refresh error instead of manufacturing another guaranteed 401.
    const current = getStoredSessionMeta();
    if (!current || isStoredAccessExpired(current)) {
      markAdminAuthHandling(error, "repair-degraded");
      publishAdminAuthLifecycle("DEGRADED");
      throw error;
    }
  }
}

async function touchCoreSessionForCrossAppActivity(
  request: PreparedRequest,
): Promise<void> {
  const headers = new Headers(request.init.headers ?? {});
  const metadata = getStoredSessionMeta();
  if (
    request.publicAuthEndpoint ||
    headers.get("x-auth-user-activity") !== "1" ||
    isAdminCoreEndpoint(request.endpoint) ||
    !metadata ||
    wasAdminActivityRecentlyCheckpointed(metadata.sessionId)
  ) {
    return;
  }
  const operation = getOrStartAdminActivityTouch();
  if (!operation) return;
  await waitForAdminActivityTouch(operation, request.init.signal);
}

function getOrStartAdminActivityTouch(now = Date.now()): Promise<void> | null {
  const metadata = getStoredSessionMeta();
  if (!metadata) return null;

  if (activityTouchInFlight?.sessionId === metadata.sessionId) {
    return activityTouchInFlight.promise;
  }

  const state = activityTouchState?.sessionId === metadata.sessionId
    ? activityTouchState
    : null;
  if (
    state &&
    (now - state.lastSuccessAt < RECENT_USER_ACTIVITY_MS ||
      now - state.lastAttemptAt < ADMIN_ACTIVITY_RETRY_COOLDOWN_MS)
  ) {
    return null;
  }

  activityTouchState = {
    sessionId: metadata.sessionId,
    lastAttemptAt: now,
    lastSuccessAt: state?.lastSuccessAt ?? 0,
  };
  return startAdminActivityTouch(metadata.sessionId);
}

function startAdminActivityTouch(sessionId: string): Promise<void> {
  const controller = new AbortController();
  const promise = boundAdminActivityTouch(
    runAdminActivityTouch(sessionId, controller.signal),
    controller,
  );
  const operation = { sessionId, promise };
  activityTouchInFlight = operation;
  const clear = () => {
    if (activityTouchInFlight === operation) activityTouchInFlight = null;
  };
  void promise.then(clear, clear);
  return promise;
}

async function runAdminActivityTouch(
  sessionId: string,
  signal: AbortSignal,
): Promise<void> {
  const metadata = getStoredSessionMeta();
  if (!metadata || metadata.sessionId !== sessionId) return;

  let epoch: AdminRefreshEpoch | null = {
    eventId: metadata.authEventId,
    sessionId,
  };
  if (isAdminRefreshDue(metadata)) {
    try {
      epoch = await coordinateAdminRefresh(epoch, signal);
    } catch (error) {
      honorTerminalAdminMaintenanceFailure(error, epoch, sessionId);
      const current = getStoredSessionMeta();
      if (
        !current ||
        current.sessionId !== sessionId ||
        isStoredAccessExpired(current)
      ) {
        return;
      }
      try {
        epoch = advanceAdminRefreshEpoch(epoch, false);
      } catch {
        return;
      }
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const csrfToken = readBrowserCookie(ADMIN_CSRF_COOKIE);
    if (!csrfToken) return;

    let response: Response;
    let payload: unknown;
    try {
      epoch = advanceAdminRefreshEpoch(epoch, false);
      assertFallbackAdminAuthIntentCurrent();
      response = await fetch(
        `${API_BASE_URL}/api/admin/core/v1/auth/activity`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "x-auth-user-activity": "1",
            "x-csrf-token": csrfToken,
          },
          credentials: "include",
          cache: "no-store",
          signal,
        },
      );
      payload = await readResponsePayloadWithFallbackAdminAuthFence(
        response,
        false,
      );
      epoch = advanceAdminRefreshEpoch(epoch, false);
    } catch (error) {
      honorTerminalAdminMaintenanceFailure(error, epoch, sessionId);
      return;
    }

    if (response.ok) {
      markAdminActivityCheckpointed(sessionId);
      return;
    }

    const error = normalizeApiError(response, payload);
    if (
      attempt === 0 &&
      classifyAuthFailure(response.status, getAuthErrorCode(error)) === "refresh"
    ) {
      try {
        epoch = await coordinateAdminRefresh(epoch, signal);
        continue;
      } catch (refreshError) {
        honorTerminalAdminMaintenanceFailure(refreshError, epoch, sessionId);
        return;
      }
    }

    honorTerminalAdminMaintenanceFailure(error, epoch, sessionId);
    return;
  }
}

function honorTerminalAdminMaintenanceFailure(
  error: unknown,
  epoch: AdminRefreshEpoch | null,
  sessionId: string,
): void {
  if (!isDefinitiveAuthFailure(error)) return;
  try {
    advanceAdminRefreshEpoch(epoch, false);
  } catch {
    return;
  }
  endAdminBrowserSession(sessionId);
}

function markAdminActivityCheckpointed(
  sessionId: string,
  now = Date.now(),
): void {
  if (activityTouchState?.sessionId !== sessionId) return;
  activityTouchState.lastSuccessAt = now;
}

function wasAdminActivityRecentlyCheckpointed(
  sessionId: string,
  now = Date.now(),
): boolean {
  return activityTouchState?.sessionId === sessionId &&
    now - activityTouchState.lastSuccessAt < RECENT_USER_ACTIVITY_MS;
}

function resetAdminActivityState(): void {
  lastUserInteractionAt = 0;
  activityTouchState = null;
}

function getOrStartAdminPresenceCheckpoint(
  sessionId: string,
): Promise<AdminPresenceCheckpoint | null> {
  if (presenceCheckpointInFlight?.sessionId === sessionId) {
    return presenceCheckpointInFlight.promise;
  }

  const controller = new AbortController();
  const requestStartedAt = Date.now();
  const task = runAdminPresenceCheckpoint(sessionId, controller.signal).then(
    (timing): AdminPresenceCheckpoint | null => timing
      ? { sessionId, requestStartedAt, timing }
      : null,
  );
  const promise = boundAdminPresenceCheckpoint(task, controller);
  const operation = { sessionId, promise };
  presenceCheckpointInFlight = operation;
  const clear = () => {
    if (presenceCheckpointInFlight === operation) {
      presenceCheckpointInFlight = null;
    }
  };
  void promise.then(clear, clear);
  return promise;
}

async function runAdminPresenceCheckpoint(
  sessionId: string,
  signal: AbortSignal,
): Promise<AdminPresenceTiming | null> {
  const metadata = getStoredSessionMeta();
  if (!metadata || metadata.sessionId !== sessionId) return null;

  let epoch: AdminRefreshEpoch | null = {
    eventId: metadata.authEventId,
    sessionId,
  };
  if (isAdminRefreshDue(metadata)) {
    try {
      epoch = await coordinateAdminRefresh(epoch, signal);
    } catch (error) {
      honorTerminalAdminMaintenanceFailure(error, epoch, sessionId);
      const current = getStoredSessionMeta();
      if (
        !current ||
        current.sessionId !== sessionId ||
        isStoredAccessExpired(current)
      ) {
        return null;
      }
      try {
        epoch = advanceAdminRefreshEpoch(epoch, false);
      } catch {
        return null;
      }
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const csrfToken = readBrowserCookie(ADMIN_CSRF_COOKIE);
    if (!csrfToken) return null;

    let response: Response;
    let payload: unknown;
    try {
      epoch = advanceAdminRefreshEpoch(epoch, false);
      assertFallbackAdminAuthIntentCurrent();
      response = await fetch(
        `${API_BASE_URL}/api/admin/core/v1/auth/presence`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "x-csrf-token": csrfToken,
          },
          credentials: "include",
          cache: "no-store",
          signal,
        },
      );
      payload = await readResponsePayloadWithFallbackAdminAuthFence(
        response,
        false,
      );
      epoch = advanceAdminRefreshEpoch(epoch, false);
    } catch (error) {
      honorTerminalAdminMaintenanceFailure(error, epoch, sessionId);
      return null;
    }

    if (response.ok) {
      const timing = readAdminPresenceTiming(payload);
      return timing?.sessionId === sessionId ? timing : null;
    }

    const error = normalizeApiError(response, payload);
    if (
      attempt === 0 &&
      classifyAuthFailure(response.status, getAuthErrorCode(error)) === "refresh"
    ) {
      try {
        epoch = await coordinateAdminRefresh(epoch, signal);
        continue;
      } catch (refreshError) {
        honorTerminalAdminMaintenanceFailure(refreshError, epoch, sessionId);
        return null;
      }
    }

    honorTerminalAdminMaintenanceFailure(error, epoch, sessionId);
    return null;
  }

  return null;
}

function readAdminPresenceTiming(payload: unknown): AdminPresenceTiming | null {
  const root = record(payload);
  if (!root || containsRawCredential(root)) return null;
  const target = record(root.data) ?? root;
  if (
    typeof target.sessionId !== "string" ||
    target.sessionId.length === 0 ||
    !positiveNumber(target.sessionExpiresIn) ||
    typeof target.idleExpiresAt !== "string" ||
    typeof target.absoluteExpiresAt !== "string"
  ) {
    return null;
  }
  const idleDeadline = Date.parse(target.idleExpiresAt);
  const absoluteDeadline = Date.parse(target.absoluteExpiresAt);
  if (
    !Number.isFinite(idleDeadline) ||
    !Number.isFinite(absoluteDeadline) ||
    idleDeadline > absoluteDeadline
  ) {
    return null;
  }
  return {
    sessionId: target.sessionId,
    sessionExpiresIn: target.sessionExpiresIn,
    idleExpiresAt: target.idleExpiresAt,
    absoluteExpiresAt: target.absoluteExpiresAt,
  };
}

function boundAdminPresenceCheckpoint(
  task: Promise<AdminPresenceCheckpoint | null>,
  controller: AbortController,
): Promise<AdminPresenceCheckpoint | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: AdminPresenceCheckpoint | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      controller.abort(new Error("AUTH_PRESENCE_TIMEOUT"));
      finish(null);
    }, ADMIN_PRESENCE_CHECKPOINT_TIMEOUT_MS);
    void task.then(finish, () => finish(null));
  });
}

/**
 * Keeps an authenticated Admin Portal session present only while this tab is
 * visible. Presence is a distinct Core contract: it never manufactures the
 * trusted-human marker or mutates the access-token timing stored in session
 * metadata. Hidden or closed tabs do not schedule presence work, and Core's
 * absolute deadline remains authoritative.
 */
export function startAdminVisibleSessionPresenceScheduler(): AdminVisibleSessionPresenceScheduler {
  let stopped = false;
  let checkpointRunning = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerDueAt: number | null = null;
  let timerSessionId: string | null = null;
  let absoluteBoundSessionId: string | null = null;
  let currentSessionId: string | null = null;
  let failedCheckpointCount = 0;
  let knownSessionDeadlineAt: number | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    timerDueAt = null;
    timerSessionId = null;
  };

  const isVisible = () =>
    !stopped &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible";

  const adoptSession = (sessionId: string) => {
    if (currentSessionId === sessionId) return;
    currentSessionId = sessionId;
    failedCheckpointCount = 0;
    absoluteBoundSessionId = null;
    knownSessionDeadlineAt = null;
    if (timerSessionId !== null && timerSessionId !== sessionId) {
      clearTimer();
    }
  };

  const recordKnownDeadline = (
    sessionId: string,
    sessionExpiresIn: number,
    anchoredAt: number,
  ) => {
    adoptSession(sessionId);
    if (
      !Number.isFinite(sessionExpiresIn) ||
      sessionExpiresIn <= 0 ||
      !Number.isFinite(anchoredAt)
    ) {
      return;
    }
    const candidate = anchoredAt + sessionExpiresIn * 1_000;
    knownSessionDeadlineAt = knownSessionDeadlineAt === null
      ? candidate
      : Math.max(knownSessionDeadlineAt, candidate);
  };

  const armTimer = (
    sessionId: string,
    delayMs: number,
    preserveEarlier = true,
  ) => {
    if (!isVisible() || absoluteBoundSessionId === sessionId) return;
    const dueAt = Date.now() + Math.max(0, delayMs);
    if (
      preserveEarlier &&
      timer !== null &&
      timerSessionId === sessionId &&
      timerDueAt !== null &&
      timerDueAt <= dueAt
    ) {
      return;
    }
    clearTimer();
    timerSessionId = sessionId;
    timerDueAt = dueAt;
    timer = setTimeout(() => {
      timer = null;
      timerDueAt = null;
      timerSessionId = null;
      void runCheckpoint();
    }, Math.max(0, dueAt - Date.now()));
  };

  const scheduleFromStoredTiming = () => {
    if (!isVisible()) return;
    const metadata = getStoredSessionMeta();
    if (!metadata) {
      clearTimer();
      currentSessionId = null;
      failedCheckpointCount = 0;
      absoluteBoundSessionId = null;
      knownSessionDeadlineAt = null;
      return;
    }
    adoptSession(metadata.sessionId);
    recordKnownDeadline(
      metadata.sessionId,
      metadata.sessionExpiresIn,
      metadata.savedAt,
    );
    armTimer(
      metadata.sessionId,
      getAdminVisiblePresenceDelayMs(
        metadata.sessionExpiresIn,
        metadata.savedAt,
      ),
    );
  };

  const runCheckpoint = async () => {
    if (!isVisible() || checkpointRunning) return;
    const sessionId = getStoredSessionMeta()?.sessionId;
    if (!sessionId || absoluteBoundSessionId === sessionId) return;
    adoptSession(sessionId);

    checkpointRunning = true;
    let checkpoint: AdminPresenceCheckpoint | null = null;
    try {
      checkpoint = await getOrStartAdminPresenceCheckpoint(sessionId);
    } catch {
      // Presence is best effort. Availability failures retain the authenticated
      // UI and use the bounded retry below.
    } finally {
      checkpointRunning = false;
    }

    if (!isVisible()) return;
    const current = getStoredSessionMeta();
    if (!current || current.sessionId !== sessionId) return;
    if (
      !checkpoint ||
      checkpoint.sessionId !== sessionId ||
      checkpoint.timing.sessionId !== sessionId
    ) {
      const retryDelay = Math.min(
        ADMIN_PRESENCE_RETRY_MAX_MS,
        Math.max(
          ADMIN_PRESENCE_RETRY_MIN_MS,
          getAdminAuthRetryDelayMs(failedCheckpointCount),
        ),
      );
      failedCheckpointCount += 1;
      const remainingMs = knownSessionDeadlineAt === null
        ? null
        : knownSessionDeadlineAt - Date.now();
      armTimer(
        sessionId,
        remainingMs !== null && remainingMs > 0
          ? Math.min(retryDelay, Math.floor(remainingMs / 2))
          : retryDelay,
      );
      return;
    }

    failedCheckpointCount = 0;
    recordKnownDeadline(
      sessionId,
      checkpoint.timing.sessionExpiresIn,
      checkpoint.requestStartedAt,
    );

    if (
      checkpoint.timing.idleExpiresAt ===
        checkpoint.timing.absoluteExpiresAt
    ) {
      absoluteBoundSessionId = sessionId;
      clearTimer();
      return;
    }

    armTimer(
      sessionId,
      getAdminVisiblePresenceDelayMs(
        checkpoint.timing.sessionExpiresIn,
        checkpoint.requestStartedAt,
      ),
    );
  };

  const wake = () => {
    if (stopped) return;
    clearTimer();
    if (!isVisible() || checkpointRunning) return;
    const sessionId = getStoredSessionMeta()?.sessionId;
    if (!sessionId || absoluteBoundSessionId === sessionId) return;
    adoptSession(sessionId);
    void runCheckpoint();
  };

  const syncVisibility = () => {
    if (stopped) return;
    if (!isVisible()) {
      clearTimer();
      return;
    }
    wake();
  };

  // Mounting an authenticated visible tab arms one bounded timer. Visibility
  // restoration uses `wake` for an immediate server-authoritative checkpoint.
  scheduleFromStoredTiming();

  return {
    reschedule: scheduleFromStoredTiming,
    wake,
    syncVisibility,
    stop: () => {
      stopped = true;
      clearTimer();
    },
  };
}

export function getAdminVisiblePresenceDelayMs(
  sessionExpiresIn: number,
  savedAt = Date.now(),
  now = Date.now(),
): number {
  if (!Number.isFinite(sessionExpiresIn) || sessionExpiresIn <= 0) return 0;
  const elapsedMs = Number.isFinite(savedAt)
    ? Math.max(0, now - savedAt)
    : 0;
  const remainingMs = Math.max(0, sessionExpiresIn * 1_000 - elapsedMs);
  return Math.min(
    ADMIN_VISIBLE_PRESENCE_MAX_INTERVAL_MS,
    Math.floor(remainingMs / 2),
  );
}

function boundAdminActivityTouch(
  task: Promise<void>,
  controller: AbortController,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      controller.abort(new Error("AUTH_ACTIVITY_TIMEOUT"));
      finish();
    }, ADMIN_ACTIVITY_TOUCH_TIMEOUT_MS);
    void task.then(finish, finish);
  });
}

function waitForAdminActivityTouch(
  operation: Promise<void>,
  signal: AbortSignal | null | undefined,
): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(abortedRequestError(signal)));
    signal?.addEventListener("abort", onAbort, { once: true });
    void operation.then(
      () => finish(resolve),
      () => finish(resolve),
    );
  });
}

function isAdminCoreEndpoint(endpoint: string): boolean {
  try {
    const path = endpoint.startsWith("http")
      ? new URL(endpoint).pathname
      : endpoint;
    return path.startsWith("/api/admin/core/v1/");
  } catch {
    return false;
  }
}

async function coordinateAdminRefresh(
  eventBeforeRequest: AdminRefreshEpoch | null,
  signal?: AbortSignal | null,
): Promise<AdminRefreshEpoch | null> {
  throwIfAborted(signal);
  const operation = refreshInFlight ?? startSharedAdminRefresh(eventBeforeRequest);
  assertSharedRefreshCompatible(eventBeforeRequest, operation.epoch);

  try {
    await waitForSharedAdminRefresh(operation.promise, signal);
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) throw error;
    advanceAdminRefreshEpoch(eventBeforeRequest, false);
    throw error;
  }
  return advanceAdminRefreshEpoch(eventBeforeRequest, true);
}

function startSharedAdminRefresh(
  eventBeforeRequest: AdminRefreshEpoch | null,
): SharedAdminRefreshOperation {
  const controller = new AbortController();
  const lockOperation = withAuthLock(async () => {
    throwIfAborted(controller.signal);
    await runAdminRefreshUnderLock(eventBeforeRequest, controller.signal);
  }, controller.signal);
  const promise = boundSharedAdminRefresh(lockOperation, controller);
  const operation: SharedAdminRefreshOperation = {
    epoch: eventBeforeRequest,
    promise,
  };
  refreshInFlight = operation;
  const clear = () => {
    if (refreshInFlight === operation) refreshInFlight = null;
  };
  void promise.then(clear, clear);
  return operation;
}

async function runAdminRefreshUnderLock(
  eventBeforeRequest: AdminRefreshEpoch | null,
  signal: AbortSignal,
): Promise<void> {
  const boundMetadata = getStoredSessionMeta();
  if (
    boundMetadata &&
    eventBeforeRequest?.eventId &&
    boundMetadata.authEventId !== eventBeforeRequest.eventId
  ) {
    if (
      eventBeforeRequest.sessionId &&
      boundMetadata.sessionId !== eventBeforeRequest.sessionId
    ) {
      publishAdminAuthLifecycle("STALE");
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    publishAdminAuthLifecycle("AUTHENTICATED");
    return;
  }

  let latest = readLatestAdminAuthEvent();
  if (
    latest?.kind === "session-ended" &&
    shouldHonorSessionEndedEvent(latest, boundMetadata)
  ) {
    throw createLocalApiError(401, "AUTH_SESSION_ENDED");
  }
  if (
    latest &&
    boundMetadata &&
    (latest.kind === "session-ended" ||
      latest.issuedAt < boundMetadata.savedAt)
  ) {
    latest = null;
  }

  // Another tab refreshed while this request was in flight or while this
  // tab waited for the Web Lock. The shared HttpOnly cookie is already new.
  if (latest && latest.eventId !== eventBeforeRequest?.eventId) {
    const expectedSessionId =
      getStoredSessionMeta()?.sessionId ?? eventBeforeRequest?.sessionId;
    if (
      !expectedSessionId ||
      !latest.sessionId ||
      latest.sessionId !== expectedSessionId
    ) {
      synchronizeAdminTabSession(latest);
      publishAdminAuthLifecycle("STALE");
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    // A bound tab can adopt the cookie renewal performed by its sibling. A
    // cold tab still performs one refresh so server-issued session identity
    // and expiry metadata are established locally instead of trusting
    // localStorage as authentication proof.
    if (getStoredSessionMeta()) {
      synchronizeAdminTabSession(latest);
      if (getStoredSessionMeta()?.authEventId === latest.eventId) {
        publishAdminAuthLifecycle("AUTHENTICATED");
        return;
      }
    }
  }

  throwIfAborted(signal);
  await refreshAdminCookieSession(undefined, signal, eventBeforeRequest);
}

function boundSharedAdminRefresh(
  operation: Promise<void>,
  controller: AbortController,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      const error = createLocalApiError(504, "AUTH_REFRESH_TIMEOUT");
      controller.abort(error);
      finish(() => reject(error));
    }, ADMIN_SHARED_REFRESH_TIMEOUT_MS);
    void operation.then(
      () => finish(resolve),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

function waitForSharedAdminRefresh(
  operation: Promise<void>,
  signal: AbortSignal | null | undefined,
): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const timer = setTimeout(
      () => finish(() => reject(createLocalApiError(504, "AUTH_REFRESH_TIMEOUT"))),
      ADMIN_REFRESH_WAITER_TIMEOUT_MS,
    );
    const onAbort = () => finish(() => reject(abortedRequestError(signal)));
    signal?.addEventListener("abort", onAbort, { once: true });
    void operation.then(
      () => finish(resolve),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

function assertSharedRefreshCompatible(
  caller: AdminRefreshEpoch | null,
  operation: AdminRefreshEpoch | null,
): void {
  if (!caller && !operation) return;
  if (
    caller?.sessionId &&
    operation?.sessionId &&
    caller.sessionId === operation.sessionId
  ) {
    return;
  }
  if (
    caller?.eventId &&
    operation?.eventId &&
    caller.eventId === operation.eventId
  ) {
    return;
  }
  throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
}

async function coordinateAdminRefreshWithRetry(
  initialEpoch: AdminRefreshEpoch | null,
  signal: AbortSignal | null | undefined,
  retryTransient: boolean,
): Promise<AdminRefreshEpoch | null> {
  let epoch = initialEpoch;
  let failedAttemptCount = 0;

  for (;;) {
    throwIfAborted(signal);
    try {
      epoch = await coordinateAdminRefresh(epoch, signal);
      return epoch;
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      epoch = advanceAdminRefreshEpoch(epoch, false);
      if (
        !retryTransient ||
        !isRetryableAdminRefreshFailure(error) ||
        failedAttemptCount >= ADMIN_REQUEST_REFRESH_MAX_RETRIES
      ) {
        throw error;
      }

      await waitForAdminRefreshRetry(
        getAdminAuthRetryDelayMs(failedAttemptCount),
        signal,
      );
      failedAttemptCount += 1;
      epoch = advanceAdminRefreshEpoch(epoch, false);
    }
  }
}

function currentAdminRefreshEpoch(): AdminRefreshEpoch | null {
  const metadata = getStoredSessionMeta();
  if (metadata) {
    return {
      eventId: metadata.authEventId,
      sessionId: metadata.sessionId,
    };
  }
  return readLatestAdminAuthEvent();
}

function advanceAdminRefreshEpoch(
  captured: AdminRefreshEpoch | null,
  allowDiscovery: boolean,
): AdminRefreshEpoch | null {
  const metadata = getStoredSessionMeta();
  const metadataEpoch = metadata
    ? {
        eventId: metadata.authEventId,
        sessionId: metadata.sessionId,
      }
    : null;
  const latest = readLatestAdminAuthEvent();
  if (isApplicableSessionEndedEvent(latest, metadata, captured)) {
    throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
  }
  const latestUpdate =
    latest?.kind === "session-updated" &&
    (!metadata || latest.issuedAt >= metadata.savedAt)
      ? latest
      : null;
  const candidates: Array<{
    epoch: AdminRefreshEpoch;
    event: AdminAuthEvent | null;
  }> = [];
  if (metadataEpoch) candidates.push({ epoch: metadataEpoch, event: null });
  if (latestUpdate) candidates.push({ epoch: latestUpdate, event: latestUpdate });

  if (!captured) {
    const discovered = latestUpdate ?? metadataEpoch;
    if (discovered && !allowDiscovery) {
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    return discovered;
  }

  for (const { epoch: candidate, event } of candidates) {
    if (hasDifferentKnownSession(captured, candidate)) {
      if (event) synchronizeAdminTabSession(event);
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
    if (
      !captured.sessionId &&
      captured.eventId &&
      candidate.eventId &&
      captured.eventId !== candidate.eventId
    ) {
      throw createLocalApiError(409, "AUTH_SESSION_CHANGED");
    }
  }

  const advanced = latestUpdate ?? metadataEpoch;
  if (!advanced) return captured;
  return {
    eventId: advanced.eventId ?? captured.eventId,
    sessionId: advanced.sessionId ?? captured.sessionId,
  };
}

function isApplicableSessionEndedEvent(
  event: AdminAuthEvent | null,
  metadata: SessionTokenMetadata | null,
  captured: AdminRefreshEpoch | null,
): boolean {
  if (event?.kind !== "session-ended") return false;
  const expectedSessionId = metadata?.sessionId ?? captured?.sessionId;
  if (
    event.sessionId &&
    expectedSessionId &&
    event.sessionId !== expectedSessionId
  ) {
    return false;
  }
  return !metadata || event.issuedAt >= metadata.savedAt;
}

function hasDifferentKnownSession(
  first: AdminRefreshEpoch | null,
  second: AdminRefreshEpoch | null,
): boolean {
  return Boolean(
    first?.sessionId &&
      second?.sessionId &&
      first.sessionId !== second.sessionId,
  );
}

function isRetryableAdminRefreshFailure(error: unknown): boolean {
  if (isAbortError(error) || isDefinitiveAuthFailure(error)) return false;
  if (getAuthErrorCode(error) === "AUTH_SESSION_CHANGED") return false;
  const status = getAuthErrorStatus(error);
  return status === undefined ||
    status === 401 ||
    status === 403 ||
    status === 429 ||
    (status >= 500 && status <= 599);
}

function isAdminSessionSuperseded(
  captured: AdminRefreshEpoch | null,
): boolean {
  const metadata = getStoredSessionMeta();
  const metadataEpoch = metadata
    ? { eventId: metadata.authEventId, sessionId: metadata.sessionId }
    : null;
  if (hasDifferentKnownSession(captured, metadataEpoch)) {
    return true;
  }
  if (!captured && metadataEpoch) return true;

  const latest = readLatestAdminAuthEvent();
  if (
    latest?.kind !== "session-updated" ||
    (metadata && latest.issuedAt < metadata.savedAt)
  ) {
    return false;
  }
  if (hasDifferentKnownSession(captured, latest)) return true;
  if (!captured) return true;
  return Boolean(
    !captured.sessionId &&
      captured.eventId &&
      latest.eventId !== captured.eventId,
  );
}

function waitForAdminRefreshRetry(
  delayMs: number,
  signal: AbortSignal | null | undefined,
): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (signal) reject(abortedRequestError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal: AbortSignal | null | undefined): void {
  if (signal?.aborted) throw abortedRequestError(signal);
}

function abortedRequestError(
  signal: AbortSignal | null | undefined,
): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function markAdminAuthHandling(
  error: unknown,
  handling: AdminAuthHandling,
): void {
  if (typeof error !== "object" || error === null) return;
  try {
    (error as { adminAuthHandling?: AdminAuthHandling }).adminAuthHandling =
      handling;
  } catch {
    // A frozen host error remains usable; only optional UI provenance is lost.
  }
}

function markApiRequestOutcome(
  error: unknown,
  outcome: ApiRequestOutcome,
): void {
  if (typeof error !== "object" || error === null) return;
  try {
    (error as { requestOutcome?: ApiRequestOutcome }).requestOutcome = outcome;
  } catch {
    // A frozen host error remains usable; conservative caller handling applies.
  }
}

function prepareRequest(
  endpoint: string,
  options: ApiRequestConfig,
): PreparedRequest {
  assertRelativeGatewayEndpoint(endpoint);
  const {
    skipAuthRefresh = false,
    nonReplayable = false,
    replayAfterRefresh: replayAfterRefreshOverride = false,
    skipAutoIdempotency = false,
    skipSessionBinding = false,
    ...requestInit
  } = options;
  const headers = new Headers(requestInit.headers ?? {});
  const method = (requestInit.method ?? "GET").toUpperCase();
  const publicAuthEndpoint = isPublicAdminAuthEndpoint(endpoint);
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

  const csrfToken = readBrowserCookie(ADMIN_CSRF_COOKIE);
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
    sessionBindingExempt:
      skipSessionBinding || isSessionBindingExemptAdminAuthEndpoint(endpoint),
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
    document.visibilityState === "visible" &&
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
    if (
      !event.isTrusted ||
      typeof document === "undefined" ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    const recordedAt = Date.now();
    lastUserInteractionAt = recordedAt;
    const checkpoint = getOrStartAdminActivityTouch(recordedAt);
    if (checkpoint) void checkpoint;
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

export function synchronizeAdminTabSession(
  event: AdminAuthEvent,
): AdminTabSessionSynchronization {
  const unchanged: AdminTabSessionSynchronization = {
    sessionChanged: false,
    timingAdopted: false,
    claimsChanged: false,
    ignored: false,
  };
  if (
    event.kind !== "session-updated" ||
    !event.sessionId ||
    typeof window === "undefined"
  ) {
    return unchanged;
  }
  const metadata = getStoredSessionMeta();
  if (!metadata) return unchanged;
  if (event.issuedAt < metadata.savedAt) {
    return { ...unchanged, ignored: true };
  }
  if (metadata.sessionId !== event.sessionId) {
    safeSessionStorage.removeItem(SESSION_META_KEY);
    resetAdminActivityState();
    return { ...unchanged, sessionChanged: true };
  }

  const claimsChanged = event.timing
    ? metadata.authorizationVersion !== event.timing.authorizationVersion ||
      metadata.profileVersion !== event.timing.profileVersion
    : true;
  if (event.issuedAt < metadata.savedAt) {
    return { ...unchanged, claimsChanged };
  }

  const updated: SessionTokenMetadata = event.timing
    ? {
        ...metadata,
        savedAt: event.issuedAt,
        expiresIn: event.timing.expiresIn,
        sessionExpiresIn: event.timing.sessionExpiresIn,
        authorizationVersion: event.timing.authorizationVersion,
        profileVersion: event.timing.profileVersion,
        authEventId: event.eventId,
      }
    : { ...metadata, authEventId: event.eventId };
  safeSessionStorage.setItem(SESSION_META_KEY, JSON.stringify(updated));
  return {
    sessionChanged: false,
    timingAdopted: event.timing !== undefined,
    claimsChanged,
    ignored: false,
  };
}

export function shouldHonorSessionEndedEvent(
  event: AdminAuthEvent,
  metadata = getStoredSessionMeta(),
): boolean {
  if (event.kind !== "session-ended" || !metadata) {
    return event.kind === "session-ended";
  }
  if (event.sessionId && event.sessionId !== metadata.sessionId) return false;
  return event.issuedAt >= metadata.savedAt;
}

function sessionEventTiming(
  auth: WebAuthSessionResponse,
): AdminAuthEventTiming {
  return {
    expiresIn: auth.expiresIn,
    sessionExpiresIn: auth.sessionExpiresIn,
    authorizationVersion: auth.session.authorizationVersion,
    profileVersion: auth.session.profileVersion,
  };
}

function isStoredAccessExpired(
  metadata: Pick<SessionTokenMetadata, "savedAt" | "expiresIn">,
  now = Date.now(),
): boolean {
  return metadata.savedAt + metadata.expiresIn * 1_000 <= now;
}

async function failClosedAdminCookieSessionMismatch(
  expectedSessionId?: string,
): Promise<never> {
  const error = createLocalApiError(409, "AUTH_SESSION_CHANGED");
  markAdminAuthHandling(error, "session-ended");
  const quarantineGeneration = markAdminCookieQuarantined();
  endAdminBrowserSession(expectedSessionId);
  if (quarantineGeneration) {
    await bestEffortInvalidateMismatchedAdminCookie(quarantineGeneration);
  }
  throw error;
}

async function enforceAdminCookieQuarantine(
  allowRequestAfterCleanup = false,
  signal?: AbortSignal | null,
): Promise<void> {
  for (;;) {
    throwIfAborted(signal);
    const quarantineGeneration = readAdminCookieQuarantineGeneration();
    if (!quarantineGeneration) {
      await waitForAdminCookieCleanupLeases(signal);
      if (!readAdminCookieQuarantineGeneration()) return;
      continue;
    }

    // Bootstrap, refresh, and business traffic must never launch a background
    // Clear-Cookie response that could outlive this request. Only an explicit
    // session-establishing flow may clean the quarantined cookie, and production
    // login/accept flows execute that cleanup while holding the auth mutex.
    if (!allowRequestAfterCleanup) {
      const terminal = createLocalApiError(401, "AUTH_SESSION_ENDED");
      markAdminAuthHandling(terminal, "session-ended");
      endAdminBrowserSession();
      throw terminal;
    }

    await bestEffortInvalidateMismatchedAdminCookie(quarantineGeneration);
    if (readAdminCookieQuarantineGeneration()) {
      const pending = createLocalApiError(503, "AUTH_COOKIE_CLEANUP_PENDING");
      markAdminAuthHandling(pending, "repair-degraded");
      publishAdminAuthLifecycle("DEGRADED");
      throw pending;
    }

    await waitForAdminCookieCleanupLeases(signal);
    if (readAdminCookieQuarantineGeneration()) continue;
    return;
  }
}

function bestEffortInvalidateMismatchedAdminCookie(
  quarantineGeneration: string,
): Promise<boolean> {
  if (adminCookieCleanupInFlight) {
    if (adminCookieCleanupInFlight.generation === quarantineGeneration) {
      return adminCookieCleanupInFlight.promise;
    }
    return adminCookieCleanupInFlight.promise.then(() =>
      bestEffortInvalidateMismatchedAdminCookie(quarantineGeneration));
  }
  const promise = runAdminCookieCleanup(quarantineGeneration);
  const operation: AdminCookieCleanupOperation = {
    generation: quarantineGeneration,
    promise,
  };
  adminCookieCleanupInFlight = operation;
  const clear = () => {
    if (adminCookieCleanupInFlight === operation) {
      adminCookieCleanupInFlight = null;
    }
  };
  void promise.then(clear, clear);
  return promise;
}

async function runAdminCookieCleanup(
  quarantineGeneration: string,
): Promise<boolean> {
  const controller = new AbortController();
  const releaseLease = registerAdminCookieCleanupLease(quarantineGeneration);
  const abortForPageExit = () => {
    controller.abort(new Error("AUTH_COOKIE_CLEANUP_PAGE_EXIT"));
  };
  if (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    window.addEventListener("pagehide", abortForPageExit, { once: true });
  }
  const timer = setTimeout(() => {
    controller.abort(new Error("AUTH_COOKIE_CLEANUP_TIMEOUT"));
  }, ADMIN_COOKIE_CLEANUP_TIMEOUT_MS);
  try {
    if (
      readAdminCookieQuarantineGeneration() !== quarantineGeneration
    ) {
      return false;
    }
    const csrfToken = readBrowserCookie(ADMIN_CSRF_COOKIE);
    const response = await fetch(`${API_BASE_URL}/api/admin/core/v1/auth/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    clearAdminCookieQuarantine(quarantineGeneration);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    if (
      typeof window !== "undefined" &&
      typeof window.removeEventListener === "function"
    ) {
      window.removeEventListener("pagehide", abortForPageExit);
    }
    releaseLease();
  }
}

function markAdminCookieQuarantined(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const generation = readAdminCookieQuarantineGeneration() ??
    `${Date.now().toString(36)}.${generateUUIDv7()}`;
  safeStorage.setItem(ADMIN_COOKIE_QUARANTINE_KEY, generation);
  writeBrowserCoordinationCookie(
    ADMIN_COOKIE_QUARANTINE_COOKIE,
    generation,
    ADMIN_COOKIE_QUARANTINE_MAX_AGE_SECONDS,
  );
  return generation;
}

function readAdminCookieQuarantineGeneration(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const cookieGeneration = readBrowserCookie(ADMIN_COOKIE_QUARANTINE_COOKIE);
  const storedGeneration = safeStorage.getItem(ADMIN_COOKIE_QUARANTINE_KEY);
  for (const generation of [cookieGeneration, storedGeneration]) {
    if (!validAdminCookieCoordinationValue(generation)) continue;
    if (!isExpiredAdminCookieQuarantineGeneration(generation)) {
      return generation;
    }
    clearAdminCookieQuarantine(generation);
  }
  return undefined;
}

function clearAdminCookieQuarantine(generation?: string): void {
  if (typeof window === "undefined") return;
  const storedGeneration = safeStorage.getItem(ADMIN_COOKIE_QUARANTINE_KEY);
  if (!generation || storedGeneration === generation) {
    safeStorage.removeItem(ADMIN_COOKIE_QUARANTINE_KEY);
  }
  const cookieGeneration = readBrowserCookie(ADMIN_COOKIE_QUARANTINE_COOKIE);
  if (!generation || cookieGeneration === generation) {
    writeBrowserCoordinationCookie(
      ADMIN_COOKIE_QUARANTINE_COOKIE,
      "",
      0,
    );
  }
}

function registerAdminCookieCleanupLease(
  quarantineGeneration: string,
): () => void {
  const leaseId = generateUUIDv7();
  const lease: AdminCookieCleanupLease = {
    generation: quarantineGeneration,
    expiresAt: Date.now() + ADMIN_COOKIE_CLEANUP_LEASE_TTL_MS,
  };
  const storageKey = `${ADMIN_COOKIE_CLEANUP_LEASE_KEY_PREFIX}${leaseId}`;
  const cookieName = `${ADMIN_COOKIE_CLEANUP_LEASE_COOKIE_PREFIX}${leaseId}`;
  const serialized = JSON.stringify(lease);
  safeStorage.setItem(storageKey, serialized);
  writeBrowserCoordinationCookie(
    cookieName,
    serialized,
    Math.ceil(ADMIN_COOKIE_CLEANUP_LEASE_TTL_MS / 1_000),
  );
  let released = false;
  return () => {
    if (released) return;
    released = true;
    safeStorage.removeItem(storageKey);
    writeBrowserCoordinationCookie(cookieName, "", 0);
  };
}

async function waitForAdminCookieCleanupLeases(
  signal?: AbortSignal | null,
): Promise<void> {
  while (hasActiveAdminCookieCleanupLease()) {
    await waitForAdminCookieCleanupPoll(signal);
  }
}

function hasActiveAdminCookieCleanupLease(now = Date.now()): boolean {
  let active = false;
  try {
    if (typeof window !== "undefined") {
      const storage = window.localStorage;
      const keys = Array.from(
        { length: storage.length },
        (_, index) => storage.key(index),
      ).filter((key): key is string => key !== null);
      for (const key of keys) {
        if (!key.startsWith(ADMIN_COOKIE_CLEANUP_LEASE_KEY_PREFIX)) continue;
        const lease = parseAdminCookieCleanupLease(storage.getItem(key));
        if (lease && lease.expiresAt > now) {
          active = true;
        } else {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // The same-site lease cookie remains the fallback coordination channel.
  }

  if (typeof document === "undefined") return active;
  for (const pair of document.cookie.split(";")) {
    const [rawName, rawValue = ""] = pair.trim().split("=", 2);
    if (!rawName.startsWith(ADMIN_COOKIE_CLEANUP_LEASE_COOKIE_PREFIX)) continue;
    let decodedValue: string;
    try {
      decodedValue = decodeURIComponent(rawValue);
    } catch {
      decodedValue = "";
    }
    const lease = parseAdminCookieCleanupLease(decodedValue);
    if (lease && lease.expiresAt > now) {
      active = true;
    } else {
      writeBrowserCoordinationCookie(rawName, "", 0);
    }
  }
  return active;
}

function parseAdminCookieCleanupLease(
  value: string | null,
): AdminCookieCleanupLease | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<AdminCookieCleanupLease>;
    if (
      typeof candidate.generation !== "string" ||
      !validAdminCookieCoordinationValue(candidate.generation) ||
      typeof candidate.expiresAt !== "number" ||
      !Number.isFinite(candidate.expiresAt)
    ) {
      return null;
    }
    return candidate as AdminCookieCleanupLease;
  } catch {
    return null;
  }
}

function waitForAdminCookieCleanupPoll(
  signal?: AbortSignal | null,
): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, ADMIN_COOKIE_CLEANUP_LEASE_POLL_MS);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortedRequestError(signal));
    };
    function finish() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

function writeBrowserCoordinationCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" &&
    window.location?.protocol === "https:"
    ? "; Secure"
    : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict${secure}`;
}

function validAdminCookieCoordinationValue(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isExpiredAdminCookieQuarantineGeneration(
  generation: string,
  now = Date.now(),
): boolean {
  const separator = generation.indexOf(".");
  if (separator <= 0) return false;
  const createdAt = Number.parseInt(generation.slice(0, separator), 36);
  return Number.isFinite(createdAt) &&
    createdAt > 0 &&
    now - createdAt >= ADMIN_COOKIE_QUARANTINE_MAX_AGE_MS;
}

export function endAdminBrowserSession(sessionIdOverride?: string): void {
  const sessionId = sessionIdOverride ?? getStoredSessionMeta()?.sessionId;
  clearLocalAuthState();
  publishAdminAuthEvent("session-ended", sessionId, true);
  publishAdminAuthLifecycle("ENDED");
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

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
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
): ApiClientError {
  const body = record(payload) ?? {};
  const message = firstString(
    body.message,
    body.title,
    body.detail,
    response.statusText,
    "HTTP Error",
  );
  const code = firstString(body.errorCode, body.code, "UNKNOWN_ERROR");
  const correlationId = firstString(body.correlationId, "");
  const details = body.details ?? body.errors;

  return new ApiClientError(message, {
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

function createLocalApiError(status: number, code: string): ApiClientError {
  return new ApiClientError(code, {
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
        title: "Access Denied",
        message: "You do not have permission to perform this action.",
      },
    }),
  );
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

function isAdminLogoutEndpoint(endpoint: string): boolean {
  return normalizedAdminAuthPath(endpoint) === "/auth/logout";
}

function isAdminCookieQuarantineExemptEndpoint(endpoint: string): boolean {
  const authPath = normalizedAdminAuthPath(endpoint);
  return authPath === "/auth/logout" ||
    authPath === "/auth/forgot-password" ||
    authPath === "/auth/reset-password";
}

function isAdminSessionEstablishingEndpoint(endpoint: string): boolean {
  const authPath = normalizedAdminAuthPath(endpoint);
  return authPath === "/auth/login" || authPath === "/auth/accept-invite";
}

function isAdminAuthCookieMutationEndpoint(endpoint: string): boolean {
  // Gateway forwards Set-Cookie for these routes. Every source caller must hold
  // withAuthLock for the complete response/body settlement.
  const authPath = normalizedAdminAuthPath(endpoint);
  return authPath === "/auth/login" ||
    authPath === "/auth/refresh" ||
    authPath === "/auth/logout" ||
    authPath === "/auth/logout-all" ||
    authPath === "/auth/accept-invite" ||
    authPath === "/auth/reset-password" ||
    Boolean(authPath?.startsWith("/auth/sessions/"));
}

function normalizedAdminAuthPath(endpoint: string): string | undefined {
  const requestPath = endpoint.split("?")[0].replace(/\/+$/, "");
  const authStart = requestPath.indexOf("/auth/");
  return authStart < 0 ? undefined : requestPath.slice(authStart);
}

function isSessionBindingExemptAdminAuthEndpoint(endpoint: string): boolean {
  const requestPath = endpoint.split("?")[0].replace(/\/+$/, "");
  const authStart = requestPath.indexOf("/auth/");
  if (authStart < 0) return false;
  return [
    "/auth/login",
    "/auth/refresh",
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
