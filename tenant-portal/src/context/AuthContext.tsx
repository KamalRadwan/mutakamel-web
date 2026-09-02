"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  adoptTenantCookieSession,
  axiosClient,
  clearLocalTenantAuthState,
  commitTenantSessionResponse,
  coordinateTenantSessionRefresh,
  getStoredTenantSessionMeta,
  hasTenantSessionCookieHint,
  readWebAuthSessionResponse,
  startTenantActivityTracking,
  synchronizeTenantTabSession,
  TenantApiClientError,
  unwrapCoreData,
  withTenantAuthLock,
} from "@/lib/api/axiosClient";
import {
  publishTenantAuthEvent,
  readLatestTenantAuthEvent,
  subscribeToTenantAuthEvents,
  subscribeToTenantAuthLifecycle,
} from "@/lib/auth/sessionCoordinator";
import {
  classifyAuthFailure,
  getAuthErrorCode,
  getAuthErrorStatus,
  isDefinitiveAuthFailure,
  isMissingCredentialsFailure,
} from "@/lib/auth/sessionErrors";
import { startTenantSessionRefreshScheduler } from "@/lib/auth/sessionRefresh";
import {
  isAccessibleBranchCompanies,
  type AccessibleBranchCompany,
} from "@/lib/api/organization-scope";

export interface TenantTeamMembership {
  id: string;
  teamId: string;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  role: string;
  isPrimary: boolean;
}

export interface TenantUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isTenantOwner: boolean;
  status: string;
  accessibleBranches: string[];
  accessibleCompanies: string[];
  /** Absent only on older Core responses; never inferred from company order. */
  accessibleBranchCompanies?: AccessibleBranchCompany[];
  permissions: string[];
  teamMemberships: TenantTeamMembership[];
}

export type TenantAuthState =
  | "UNAUTHENTICATED"
  | "BOOTSTRAPPING"
  | "AUTHENTICATED"
  | "STALE"
  | "REFRESHING"
  | "DEGRADED"
  | "ENDED";

interface TenantLoginOptions {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface TenantAuthContextValue {
  user: TenantUserProfile | null;
  authState: TenantAuthState;
  /**
   * The wire code that ended the session, when one was observed.
   *
   * This value is the whole of OPEN-QUESTIONS.md Q18: the seven session-ending
   * codes were already classified here and then discarded, so `/session-expired`
   * could never say *why*. It is deliberately the **raw code**, not a mapped
   * message — a screen renders it through its own label table like every other
   * enum, and inventing a mapping here would make an unrecognised code
   * disappear silently.
   *
   * `null` is honest and still common: a session ended in another tab carries
   * a session id and nothing else, and a session ended because the readable
   * CSRF proof vanished was never given a code by anyone. The lifecycle
   * transition does carry the code when the transport saw one — that is what
   * closed the second half of Q18 — but it is not required to invent one.
   */
  endedReason: string | null;
  /** Non-secret, session-bound fence used only by browser connection owners. */
  realtimeAuthGeneration: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (options: TenantLoginOptions) => Promise<void>;
  logout: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
}

const TenantAuthContext = createContext<TenantAuthContextValue | undefined>(
  undefined,
);

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantUserProfile | null>(null);
  const [authState, setAuthState] = useState<TenantAuthState>("BOOTSTRAPPING");
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [realtimeAuthGeneration, setRealtimeAuthGeneration] = useState<string | null>(null);
  const authOperationGeneration = useRef(0);
  const bootstrapAbort = useRef<AbortController | null>(null);
  const router = useRouter();

  const invalidatePendingAuthWork = useCallback(() => {
    authOperationGeneration.current += 1;
    bootstrapAbort.current?.abort();
    bootstrapAbort.current = null;
    return authOperationGeneration.current;
  }, []);

  const bootstrap = useCallback(async (markPending = true) => {
    const generation = invalidatePendingAuthWork();
    const controller = new AbortController();
    bootstrapAbort.current = controller;
    if (markPending) {
      setAuthState((current) =>
        current === "AUTHENTICATED"
          ? "STALE"
          : "BOOTSTRAPPING",
      );
    }
    try {
      // Core pairs this readable proof with the HttpOnly session cookie.
      // Stored metadata can outlive the cookies and cannot restore a session.
      if (!hasTenantSessionCookieHint()) {
        clearLocalTenantAuthState();
        setUser(null);
        setEndedReason(null);
        setRealtimeAuthGeneration(null);
        setAuthState("UNAUTHENTICATED");
        return;
      }
      // Before /me, not after: a tab holding only the cookies has no metadata,
      // and /me answering 200 would leave it that way — signed in, with no
      // refresh timing, no session id for the 401 retry to name, and no
      // realtime generation. It works until the access cookie expires and then
      // strands the user on a session that is still perfectly valid.
      if (getStoredTenantSessionMeta() === null) {
        try {
          await adoptTenantCookieSession();
        } catch (error) {
          // A refresh that failed definitively ends the session, and the catch
          // below reports which code did it. Anything else — offline, a 5xx, a
          // lock that timed out — must not stop a still-valid access cookie
          // from proving the session, so /me is still asked.
          if (isDefinitiveAuthFailure(error)) throw error;
        }
        if (
          controller.signal.aborted ||
          generation !== authOperationGeneration.current
        ) {
          return;
        }
      }
      const response = await axiosClient.get(
        "/api/tenant/core/v1/auth/me",
        { cache: "no-store", signal: controller.signal },
      );
      if (controller.signal.aborted || generation !== authOperationGeneration.current) {
        return;
      }
      const profile = readTenantUserProfile(response.data);
      setUser(profile);
      setEndedReason(null);
      setRealtimeAuthGeneration(readRealtimeAuthGeneration(profile.id));
      setAuthState("AUTHENTICATED");
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== authOperationGeneration.current ||
        isAbortError(error)
      ) {
        return;
      }
      // A 401 that says "no credentials were sent" is not a degraded server —
      // it is a signed-out visitor, and they belong on the login form. Only a
      // genuinely inconclusive failure earns the degraded retry screen.
      if (
        !isInvalidAuthProfile(error) &&
        !isDefinitiveAuthFailure(error) &&
        !isMissingCredentialsFailure(error)
      ) {
        setAuthState("DEGRADED");
        return;
      }
      clearLocalTenantAuthState();
      setUser(null);
      setEndedReason(
        isDefinitiveAuthFailure(error) ? getAuthErrorCode(error) ?? null : null,
      );
      setRealtimeAuthGeneration(null);
      setAuthState(isDefinitiveAuthFailure(error) ? "ENDED" : "UNAUTHENTICATED");
    } finally {
      if (bootstrapAbort.current === controller) bootstrapAbort.current = null;
    }
  }, [invalidatePendingAuthWork]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void bootstrap(false);
    });
    return () => {
      cancelled = true;
      bootstrapAbort.current?.abort();
    };
  }, [bootstrap]);

  useEffect(() =>
    subscribeToTenantAuthEvents((event) => {
      if (event.kind === "session-ended") {
        if (getStoredTenantSessionMeta()?.sessionId !== event.sessionId) return;
        invalidatePendingAuthWork();
        clearLocalTenantAuthState();
        setUser(null);
        // A cross-tab session-ended event carries a session id and nothing
        // else. There is no code to report and none is invented.
        setEndedReason(null);
        setRealtimeAuthGeneration(null);
        setAuthState("ENDED");
        // No redirect here. This used to send the tab to /login, which is why
        // a session that ended while the user was working never reached
        // `/session-expired` and never said why: the state and its reason were
        // set correctly and then overtaken. `TenantAuthGuard` owns terminal
        // destinations, and it is the only place that can also tell whether
        // the current screen is one a signed-out visitor may stay on.
        return;
      }
      const previousSessionId = getStoredTenantSessionMeta()?.sessionId;
      if (!synchronizeTenantTabSession(event)) {
        const current = getStoredTenantSessionMeta();
        if (
          current?.sessionId === event.sessionId &&
          current.authEventId === event.eventId
        ) {
          void bootstrap();
        }
        return;
      }
      const sessionChanged = previousSessionId !== event.sessionId;
      if (sessionChanged) {
        setUser(null);
        setRealtimeAuthGeneration(null);
        setAuthState("BOOTSTRAPPING");
      }
      void bootstrap(!sessionChanged);
    }), [bootstrap, invalidatePendingAuthWork]);

  useEffect(() =>
    subscribeToTenantAuthLifecycle(({ state, reason }) => {
      if (state === "ENDED") {
        invalidatePendingAuthWork();
        setUser(null);
        // Invalidating the pending work is exactly what stops `bootstrap`'s
        // own catch from recording the code, so the transport hands it over
        // here instead. `undefined` stays honest: the proof cookie vanishing
        // and an idle checkpoint finding nothing to check both end a session
        // without the server ever saying why.
        setEndedReason(reason ?? null);
        setRealtimeAuthGeneration(null);
        setAuthState("ENDED");
        return;
      }
      setAuthState((current) =>
        current === "BOOTSTRAPPING" && state !== "DEGRADED"
          ? current
          : state,
      );
    }), [invalidatePendingAuthWork]);

  useEffect(() => {
    // Public and bootstrapping screens can still have stale tab metadata. Do
    // not let a click on /login race the session check and start an obsolete
    // activity/refresh chain.
    if (authState !== "AUTHENTICATED" || user === null) return;
    return startTenantActivityTracking();
  }, [authState, user]);

  useEffect(() => {
    if (!user && !getStoredTenantSessionMeta()) return;
    const scheduler = startTenantSessionRefreshScheduler({
      getTiming: readStoredRefreshTiming,
      canRefresh: canRefreshTenantSession,
      refresh: async () => {
        const sessionId = getStoredTenantSessionMeta()?.sessionId;
        if (!sessionId) return;
        await coordinateTenantSessionRefresh(sessionId);
      },
    });
    const wake = () => scheduler.wake();
    const wakeWhenVisible = () => {
      if (document.visibilityState === "visible") scheduler.wake();
    };
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wakeWhenVisible);
    return () => {
      scheduler.stop();
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wakeWhenVisible);
    };
  }, [user]);

  const login = useCallback(async ({
    email,
    password,
    rememberMe = false,
  }: TenantLoginOptions) => {
    const generation = invalidatePendingAuthWork();
    let sessionCommitted = false;
    setRealtimeAuthGeneration(null);
    setAuthState("BOOTSTRAPPING");
    try {
      const profile = await withTenantAuthLock(async (signal) => {
        if (generation !== authOperationGeneration.current) {
          throw sessionChangedError();
        }
        clearLocalTenantAuthState();
        const loginResponse = await axiosClient.post(
          "/api/tenant/core/v1/auth/login",
          { email, password },
          {
            headers: { "x-auth-remember": rememberMe ? "1" : "0" },
            skipAuthRefresh: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            signal,
          },
        );
        const auth = readWebAuthSessionResponse(loginResponse.data);
        if (!auth) {
          const invalidResponse = new Error("INVALID_AUTH_RESPONSE");
          await bestEffortTenantSessionRollback(signal);
          throw invalidResponse;
        }

        commitTenantSessionResponse(auth, {
          remember: rememberMe,
          notifyCurrentTab: false,
        });
        sessionCommitted = true;

        try {
          const meResponse = await axiosClient.get(
            "/api/tenant/core/v1/auth/me",
            { skipAuthRefresh: true, cache: "no-store", signal },
          );
          const profile = readTenantUserProfile(meResponse.data);
          if (
            generation !== authOperationGeneration.current ||
            getStoredTenantSessionMeta()?.sessionId !== auth.session.id
          ) {
            throw sessionChangedError();
          }
          return profile;
        } catch (error) {
          if (!shouldRetainCommittedTenantSession(error)) {
            const sessionEnded = isDefinitiveAuthFailure(error) ||
              await bestEffortTenantSessionRollback(signal);
            const cleared = clearTenantSessionIfCurrent(auth.session.id);
            if (sessionEnded && cleared) publishSessionEndOnce(auth.session.id);
          }
          throw error;
        }
      });

      if (generation !== authOperationGeneration.current) {
        throw sessionChangedError();
      }
      setUser(profile);
      setEndedReason(null);
      setRealtimeAuthGeneration(readRealtimeAuthGeneration(profile.id));
      setAuthState("AUTHENTICATED");
      router.push("/");
    } catch (error) {
      if (generation !== authOperationGeneration.current) throw error;
      if (sessionCommitted && shouldRetainCommittedTenantSession(error)) {
        setUser(null);
        setAuthState("DEGRADED");
        throw error;
      }
      clearLocalTenantAuthState();
      setUser(null);
      setRealtimeAuthGeneration(null);
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      setEndedReason(
        disposition === "end" ? getAuthErrorCode(error) ?? null : null,
      );
      setAuthState(disposition === "end" ? "ENDED" : "UNAUTHENTICATED");
      throw error;
    }
  }, [invalidatePendingAuthWork, router]);

  const logout = useCallback(async () => {
    const generation = invalidatePendingAuthWork();
    let sessionId: string | undefined;
    setRealtimeAuthGeneration(null);
    try {
      const endedCurrentSession = await withTenantAuthLock(async (signal) => {
        if (generation !== authOperationGeneration.current) {
          throw sessionChangedError();
        }
        sessionId = getStoredTenantSessionMeta()?.sessionId;
        await axiosClient.post(
          "/api/tenant/core/v1/auth/logout",
          undefined,
          {
            skipAuthRefresh: true,
            nonReplayable: true,
            skipAutoIdempotency: true,
            signal,
          },
        );
        if (generation !== authOperationGeneration.current) return false;
        if (!sessionId) {
          clearLocalTenantAuthState();
          return true;
        }
        if (!clearTenantSessionIfCurrent(sessionId)) return false;
        publishSessionEndOnce(sessionId);
        return true;
      });
      if (!endedCurrentSession) return;
    } catch (error) {
      if (isDefinitiveAuthFailure(error)) {
        const latest = readLatestTenantAuthEvent();
        if (latest?.kind === "session-ended" && latest.sessionId === sessionId) {
          return;
        }
        if (generation !== authOperationGeneration.current) throw error;
        setUser(null);
        setEndedReason(getAuthErrorCode(error) ?? null);
        setRealtimeAuthGeneration(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      if (generation !== authOperationGeneration.current) throw error;
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      setAuthState(
        disposition === "retain" || disposition === "refresh"
          ? "DEGRADED"
          : "AUTHENTICATED",
      );
      setRealtimeAuthGeneration(
        user ? readRealtimeAuthGeneration(user.id) : null,
      );
      throw error;
    }
    if (generation !== authOperationGeneration.current) return;
    setUser(null);
    // A deliberate sign-out is not a session that expired, so it carries no
    // reason to report — and it is not ENDED either. ENDED is now the guard's
    // cue to route to a terminal screen, and a completed sign-out that claimed
    // it was answered by "your session expired": this replace to /login and
    // the guard's replace to /session-expired both fired, and the guard's won.
    setEndedReason(null);
    setRealtimeAuthGeneration(null);
    setAuthState("UNAUTHENTICATED");
    router.replace("/login");
  }, [invalidatePendingAuthWork, router, user]);

  const value = useMemo<TenantAuthContextValue>(() => ({
    user,
    authState,
    endedReason,
    realtimeAuthGeneration,
    isAuthenticated: user !== null,
    isLoading: authState === "BOOTSTRAPPING" && user === null,
    login,
    logout,
    retryBootstrap: () => bootstrap(true),
  }), [authState, bootstrap, endedReason, login, logout, realtimeAuthGeneration, user]);

  return (
    <TenantAuthContext.Provider value={value}>
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth(): TenantAuthContextValue {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error("useTenantAuth must be used within TenantAuthProvider");
  }
  return context;
}

function readTenantUserProfile(payload: unknown): TenantUserProfile {
  const profile = unwrapCoreData<unknown>(payload);
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("INVALID_AUTH_PROFILE");
  }
  const candidate = profile as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.firstName !== "string" ||
    typeof candidate.lastName !== "string" ||
    typeof candidate.isTenantOwner !== "boolean" ||
    typeof candidate.status !== "string" ||
    !stringArray(candidate.accessibleBranches) ||
    !stringArray(candidate.accessibleCompanies) ||
    !stringArray(candidate.permissions) ||
    !Array.isArray(candidate.teamMemberships) ||
    !candidate.teamMemberships.every(isTenantTeamMembership)
  ) {
    throw new Error("INVALID_AUTH_PROFILE");
  }
  const accessScope = candidate.accessScope;
  const companiesTruncated =
    accessScope !== null &&
    typeof accessScope === "object" &&
    !Array.isArray(accessScope) &&
    "companiesTruncated" in accessScope &&
    accessScope.companiesTruncated === true;
  if (
    "accessibleBranchCompanies" in candidate &&
    !isAccessibleBranchCompanies(
      candidate.accessibleBranchCompanies,
      candidate.accessibleBranches,
      companiesTruncated ? null : candidate.accessibleCompanies,
    )
  ) {
    throw new Error("INVALID_AUTH_PROFILE");
  }
  return candidate as unknown as TenantUserProfile;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTenantTeamMembership(value: unknown): value is TenantTeamMembership {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.teamId === "string" &&
    typeof item.companyId === "string" &&
    nullableString(item.branchId) &&
    nullableString(item.departmentId) &&
    typeof item.role === "string" &&
    typeof item.isPrimary === "boolean"
  );
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function readRealtimeAuthGeneration(userId: string): string | null {
  const sessionId = getStoredTenantSessionMeta()?.sessionId;
  if (!sessionId || sessionId.length > 128 || userId.length > 128) return null;
  const generation = `tenant:${sessionId}:${userId}`;
  return generation.length <= 256 ? generation : null;
}

function shouldRetainCommittedTenantSession(error: unknown): boolean {
  return !isInvalidAuthProfile(error) && !isDefinitiveAuthFailure(error);
}

async function bestEffortTenantSessionRollback(
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    await axiosClient.post(
      "/api/tenant/core/v1/auth/logout",
      undefined,
      {
        skipAuthRefresh: true,
        nonReplayable: true,
        skipAutoIdempotency: true,
        cache: "no-store",
        signal,
      },
    );
    return true;
  } catch {
    // Preserve the original login/bootstrap failure. The server session will
    // still expire under its idle/absolute bounds if this cleanup cannot run.
    return false;
  }
}

function readStoredRefreshTiming() {
  const metadata = getStoredTenantSessionMeta();
  return metadata
    ? {
        savedAt: metadata.savedAt,
        expiresIn: metadata.expiresIn,
        eventId: metadata.authEventId,
      }
    : null;
}

function canRefreshTenantSession(): boolean {
  return (
    document.visibilityState === "visible" &&
    navigator.onLine &&
    hasTenantSessionCookieHint() &&
    getStoredTenantSessionMeta() !== null
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isInvalidAuthProfile(error: unknown): boolean {
  return error instanceof Error && error.message === "INVALID_AUTH_PROFILE";
}

function sessionChangedError(): TenantApiClientError {
  return new TenantApiClientError("AUTH_SESSION_CHANGED", {
    status: 409,
    statusText: "Conflict",
    headers: new Headers({ "content-type": "application/json" }),
    data: { code: "AUTH_SESSION_CHANGED" },
  });
}

function clearTenantSessionIfCurrent(sessionId: string): boolean {
  if (getStoredTenantSessionMeta()?.sessionId !== sessionId) return false;
  clearLocalTenantAuthState();
  return true;
}

function publishSessionEndOnce(sessionId: string): void {
  const latest = readLatestTenantAuthEvent();
  if (latest?.kind === "session-ended" && latest.sessionId === sessionId) return;
  publishTenantAuthEvent("session-ended", sessionId, false);
}
