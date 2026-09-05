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
  axiosClient,
  clearLocalAuthState,
  endAdminBrowserSession,
  ensureAdminCookieSessionFresh,
  getStoredSessionMeta,
  readWebAuthSessionResponse,
  startAdminVisibleSessionPresenceScheduler,
  storeAdminSessionMetadata,
  synchronizeAdminTabSession,
  shouldHonorSessionEndedEvent,
  unwrapCoreData,
  withAuthLock,
} from "@/lib/api/axiosClient";
import {
  publishAdminAuthEvent,
  subscribeToAdminAuthEvents,
  subscribeToAdminAuthLifecycle,
} from "@/lib/auth/sessionCoordinator";
import { isSupersededAdminBootstrap } from "@/lib/auth/bootstrap-supersession";
import {
  classifyAuthFailure,
  getAdminAuthRetryDelayMs,
  getAuthErrorCode,
  getAuthErrorStatus,
  startAdminSessionRefreshScheduler,
  type AdminSessionRefreshScheduler,
} from "@/lib/auth/sessionRefresh";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  role: { id: string; name: string };
  status: string;
  permissions: string[];
}

export type AuthState =
  | "UNAUTHENTICATED"
  | "BOOTSTRAPPING"
  | "AUTHENTICATED"
  | "STALE"
  | "REFRESHING"
  | "DEGRADED"
  | "ENDED";

export function isPendingAuthState(state: AuthState): boolean {
  return (
    state === "BOOTSTRAPPING" || state === "STALE" || state === "REFRESHING"
  );
}

interface LoginOptions {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface AdminPasswordActionOptions {
  token: string;
  newPassword: string;
}

interface AuthContextType {
  user: UserProfile | null;
  authState: AuthState;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (options: LoginOptions) => Promise<void>;
  acceptInvite: (options: AdminPasswordActionOptions) => Promise<void>;
  resetPassword: (options: AdminPasswordActionOptions) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
  /**
   * Counts credential sign-ins completed in this document. Only `login()`
   * bumps it: bootstrap, proactive refresh, and cross-tab session adoption
   * all reach AUTHENTICATED without a human having just typed a password,
   * and a full page load starts a new provider back at 0. A consumer that
   * must run once per *fresh* sign-in — not once per authenticated
   * session — reacts to this changing rather than to `authState`.
   */
  freshLoginCount: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authState, setAuthState] = useState<AuthState>("BOOTSTRAPPING");
  const [freshLoginCount, setFreshLoginCount] = useState(0);
  const router = useRouter();

  const bootstrapInFlightRef = useRef<Promise<void> | null>(null);
  const bootstrapRunnerRef = useRef<
    ((markPending?: boolean) => Promise<void>) | null
  >(null);
  const bootstrapRerunRequestedRef = useRef(false);
  const sessionCommitRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const proactiveSchedulerRef = useRef<AdminSessionRefreshScheduler | null>(
    null,
  );
  const visiblePresenceSchedulerRef = useRef<ReturnType<
    typeof startAdminVisibleSessionPresenceScheduler
  > | null>(null);
  const mountedRef = useRef(true);

  const stopSessionMaintenance = useCallback(() => {
    proactiveSchedulerRef.current?.stop();
    proactiveSchedulerRef.current = null;
    visiblePresenceSchedulerRef.current?.stop();
    visiblePresenceSchedulerRef.current = null;
  }, []);

  const cancelScheduledBootstrapRetry = useCallback(() => {
    if (retryTimerRef.current === null) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const resetBootstrapRetry = useCallback(() => {
    cancelScheduledBootstrapRetry();
    retryAttemptRef.current = 0;
  }, [cancelScheduledBootstrapRetry]);

  /**
   * Called wherever this provider itself decides what the session now is —
   * a sign-in, an invite acceptance, a sign-out, or another tab's session
   * replacing this one. Past this point, a bootstrap that is still in flight
   * is describing a session that no longer exists, and its answer is dropped
   * instead of written.
   */
  const commitSessionDecision = useCallback(() => {
    sessionCommitRef.current += 1;
  }, []);

  const scheduleBootstrapRetry = useCallback(() => {
    if (!mountedRef.current || retryTimerRef.current !== null) return;

    const delayMs = getAdminAuthRetryDelayMs(retryAttemptRef.current);
    retryAttemptRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!mountedRef.current) return;
      void bootstrapRunnerRef.current?.(false);
    }, delayMs);
  }, []);

  const bootstrap = useCallback((markPending = true): Promise<void> => {
    if (bootstrapInFlightRef.current) return bootstrapInFlightRef.current;
    cancelScheduledBootstrapRetry();

    if (markPending) {
      setAuthState((current) =>
        current === "AUTHENTICATED" || current === "DEGRADED"
          ? "STALE"
          : "BOOTSTRAPPING",
      );
    }

    // Captured before the request goes out. `/login` renders during
    // bootstrap, so the operator can commit a whole new session while this
    // check is still in flight; a result from before that commit describes a
    // session nobody is using any more.
    const commitAtRequest = sessionCommitRef.current;
    const superseded = () =>
      isSupersededAdminBootstrap({
        commitAtRequest,
        currentCommit: sessionCommitRef.current,
      });

    const operation = (async () => {
      try {
        const response = await axiosClient.get(
          "/api/admin/core/v1/auth/me",
          { cache: "no-store" },
        );
        if (!mountedRef.current || superseded()) return;
        resetBootstrapRetry();
        setUser(readUserProfile(response.data));
        setAuthState("AUTHENTICATED");
      } catch (error) {
        if (!mountedRef.current || superseded()) return;
        const disposition = classifyAuthFailure(
          getAuthErrorStatus(error),
          getAuthErrorCode(error),
        );
        if (
          !(error instanceof Error && error.message === "INVALID_AUTH_PROFILE") &&
          disposition !== "end" &&
          disposition !== "none"
        ) {
          setAuthState("DEGRADED");
          scheduleBootstrapRetry();
          return;
        }
        resetBootstrapRetry();
        clearLocalAuthState();
        setUser(null);
        setAuthState(disposition === "end" ? "ENDED" : "UNAUTHENTICATED");
      }
    })();
    const clearInFlight = () => {
      if (bootstrapInFlightRef.current === operation) {
        bootstrapInFlightRef.current = null;
      }
    };
    bootstrapInFlightRef.current = operation;
    void operation.then(clearInFlight, clearInFlight);
    return operation;
  }, [cancelScheduledBootstrapRetry, resetBootstrapRetry, scheduleBootstrapRetry]);

  const requestAuthoritativeBootstrap = useCallback(() => {
    const current = bootstrapInFlightRef.current;
    if (!current) {
      void bootstrapRunnerRef.current?.(false);
      return;
    }
    if (bootstrapRerunRequestedRef.current) return;

    bootstrapRerunRequestedRef.current = true;
    const rerun = () => {
      bootstrapRerunRequestedRef.current = false;
      if (!mountedRef.current) return;
      void bootstrapRunnerRef.current?.(false);
    };
    void current.then(rerun, rerun);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    bootstrapRunnerRef.current = bootstrap;
    return () => {
      mountedRef.current = false;
      bootstrapRunnerRef.current = null;
      bootstrapRerunRequestedRef.current = false;
      cancelScheduledBootstrapRetry();
    };
  }, [bootstrap, cancelScheduledBootstrapRetry]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void bootstrap(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  useEffect(() =>
    subscribeToAdminAuthEvents((event) => {
      if (event.kind === "session-ended") {
        if (!shouldHonorSessionEndedEvent(event)) return;
        stopSessionMaintenance();
        resetBootstrapRetry();
        commitSessionDecision();
        clearLocalAuthState();
        setUser(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      const synchronization = synchronizeAdminTabSession(event);
      if (synchronization.ignored) return;
      if (synchronization.sessionChanged) {
        stopSessionMaintenance();
        resetBootstrapRetry();
        commitSessionDecision();
        setUser(null);
        setAuthState("STALE");
        requestAuthoritativeBootstrap();
        return;
      }
      proactiveSchedulerRef.current?.reschedule();
      visiblePresenceSchedulerRef.current?.reschedule();
      if (synchronization.claimsChanged) {
        requestAuthoritativeBootstrap();
      } else if (
        !synchronization.timingAdopted &&
        !bootstrapInFlightRef.current
      ) {
        requestAuthoritativeBootstrap();
      }
    }), [commitSessionDecision, requestAuthoritativeBootstrap, resetBootstrapRetry, router, stopSessionMaintenance]);

  useEffect(() =>
    subscribeToAdminAuthLifecycle((state) => {
      if (state === "ENDED") {
        stopSessionMaintenance();
        resetBootstrapRetry();
        setUser(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      if (state === "AUTHENTICATED") {
        // Auth lifecycle publication follows metadata persistence, so a cold
        // `/auth/me` bootstrap can re-arm from the newly seeded timing.
        visiblePresenceSchedulerRef.current?.reschedule();
      }
      if (state === "AUTHENTICATED" && user === null) {
        setAuthState((current) =>
          isPendingAuthState(current) ? current : "STALE",
        );
        if (!bootstrapInFlightRef.current) requestAuthoritativeBootstrap();
        return;
      }
      setAuthState(state);
    }), [requestAuthoritativeBootstrap, resetBootstrapRetry, router, stopSessionMaintenance, user]);

  useEffect(() => {
    if (!user) {
      stopSessionMaintenance();
      return;
    }

    const scheduler = startAdminSessionRefreshScheduler({
      getTiming: getStoredSessionMeta,
      refresh: ensureAdminCookieSessionFresh,
      onTerminal: () => endAdminBrowserSession(),
    });
    proactiveSchedulerRef.current = scheduler;
    const visiblePresenceScheduler =
      startAdminVisibleSessionPresenceScheduler();
    visiblePresenceSchedulerRef.current = visiblePresenceScheduler;

    const wake = () => {
      scheduler.wake();
      visiblePresenceScheduler.wake();
    };
    const syncVisibility = () => {
      visiblePresenceScheduler.syncVisibility();
      if (document.visibilityState !== "hidden") scheduler.wake();
    };
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pageshow", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    return () => {
      scheduler.stop();
      visiblePresenceScheduler.stop();
      if (proactiveSchedulerRef.current === scheduler) {
        proactiveSchedulerRef.current = null;
      }
      if (visiblePresenceSchedulerRef.current === visiblePresenceScheduler) {
        visiblePresenceSchedulerRef.current = null;
      }
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [stopSessionMaintenance, user]);

  const login = useCallback(async ({
    email,
    password,
    rememberMe = false,
  }: LoginOptions) => {
    let sessionCommitted = false;
    stopSessionMaintenance();
    resetBootstrapRetry();
    commitSessionDecision();
    setAuthState("BOOTSTRAPPING");
    try {
      const profile = await withAuthLock(async () => {
        clearLocalAuthState();
        const loginResponse = await axiosClient.post(
          "/api/admin/core/v1/auth/login",
          { email, password },
          {
            headers: { "x-auth-remember": rememberMe ? "1" : "0" },
            skipAuthRefresh: true,
            skipAutoIdempotency: true,
            cache: "no-store",
          },
        );
        const auth = readWebAuthSessionResponse(loginResponse.data);
        if (!auth) {
          const invalidResponse = new Error("INVALID_AUTH_RESPONSE");
          await bestEffortAdminSessionRollback();
          publishAdminAuthEvent("session-ended", undefined, false);
          throw invalidResponse;
        }

        sessionCommitted = true;
        const event = publishAdminAuthEvent(
          "session-updated",
          auth.session.id,
          false,
          {
            expiresIn: auth.expiresIn,
            sessionExpiresIn: auth.sessionExpiresIn,
            authorizationVersion: auth.session.authorizationVersion,
            profileVersion: auth.session.profileVersion,
          },
        );
        storeAdminSessionMetadata(
          auth,
          rememberMe,
          event.eventId,
          event.issuedAt,
        );

        try {
          const meResponse = await axiosClient.get(
            "/api/admin/core/v1/auth/me",
            { skipAuthRefresh: true, cache: "no-store" },
          );
          return readUserProfile(meResponse.data);
        } catch (error) {
          if (!shouldRetainCommittedSession(error)) {
            await bestEffortAdminSessionRollback();
            clearLocalAuthState();
            publishAdminAuthEvent(
              "session-ended",
              auth.session.id,
              false,
            );
          }
          throw error;
        }
      });

      setUser(profile);
      setAuthState("AUTHENTICATED");
      // Only this path — a password the operator just typed — counts as a
      // fresh sign-in. Every other route to AUTHENTICATED is a restore.
      setFreshLoginCount((count) => count + 1);
      router.push("/dashboard");
    } catch (error) {
      if (sessionCommitted && shouldRetainCommittedSession(error)) {
        setUser(null);
        setAuthState("DEGRADED");
        scheduleBootstrapRetry();
        throw error;
      }
      if (!sessionCommitted && getAuthErrorCode(error) === "AUTH_SESSION_CHANGED") {
        clearLocalAuthState();
        setUser(null);
        setAuthState("STALE");
        scheduleBootstrapRetry();
        throw error;
      }
      clearLocalAuthState();
      setUser(null);
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      setAuthState(disposition === "end" ? "ENDED" : "UNAUTHENTICATED");
      throw error;
    }
  }, [commitSessionDecision, resetBootstrapRetry, router, scheduleBootstrapRetry, stopSessionMaintenance]);

  const acceptInvite = useCallback(async ({
    token,
    newPassword,
  }: AdminPasswordActionOptions) => {
    let sessionCommitted = false;
    stopSessionMaintenance();
    resetBootstrapRetry();
    commitSessionDecision();
    setAuthState("BOOTSTRAPPING");
    try {
      const profile = await withAuthLock(async () => {
        clearLocalAuthState();
        const inviteResponse = await axiosClient.post(
          "/api/admin/core/v1/auth/accept-invite",
          { token, newPassword },
          {
            skipAuthRefresh: true,
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
          },
        );
        const auth = readWebAuthSessionResponse(inviteResponse.data);
        if (!auth) {
          const invalidResponse = new Error("INVALID_AUTH_RESPONSE");
          await bestEffortAdminSessionRollback();
          publishAdminAuthEvent("session-ended", undefined, false);
          throw invalidResponse;
        }

        sessionCommitted = true;
        const event = publishAdminAuthEvent(
          "session-updated",
          auth.session.id,
          false,
          {
            expiresIn: auth.expiresIn,
            sessionExpiresIn: auth.sessionExpiresIn,
            authorizationVersion: auth.session.authorizationVersion,
            profileVersion: auth.session.profileVersion,
          },
        );
        storeAdminSessionMetadata(
          auth,
          false,
          event.eventId,
          event.issuedAt,
        );

        try {
          const meResponse = await axiosClient.get(
            "/api/admin/core/v1/auth/me",
            { skipAuthRefresh: true, cache: "no-store" },
          );
          return readUserProfile(meResponse.data);
        } catch (error) {
          if (!shouldRetainCommittedSession(error)) {
            await bestEffortAdminSessionRollback();
            clearLocalAuthState();
            publishAdminAuthEvent(
              "session-ended",
              auth.session.id,
              false,
            );
          }
          throw error;
        }
      });

      setUser(profile);
      setAuthState("AUTHENTICATED");
      // Accepting an invite is a sign-in too, and it is the first one this
      // administrator ever makes — the moment the browser prompts matter most.
      setFreshLoginCount((count) => count + 1);
      router.push("/dashboard");
    } catch (error) {
      if (sessionCommitted && shouldRetainCommittedSession(error)) {
        setUser(null);
        setAuthState("DEGRADED");
        scheduleBootstrapRetry();
        throw error;
      }
      if (!sessionCommitted && getAuthErrorCode(error) === "AUTH_SESSION_CHANGED") {
        clearLocalAuthState();
        setUser(null);
        setAuthState("STALE");
        scheduleBootstrapRetry();
        throw error;
      }
      clearLocalAuthState();
      setUser(null);
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      setAuthState(disposition === "end" ? "ENDED" : "UNAUTHENTICATED");
      throw error;
    }
  }, [commitSessionDecision, resetBootstrapRetry, router, scheduleBootstrapRetry, stopSessionMaintenance]);

  const logout = useCallback(async () => {
    const sessionId = getStoredSessionMeta()?.sessionId;
    resetBootstrapRetry();
    commitSessionDecision();
    try {
      await withAuthLock(async () => {
        await axiosClient.post(
          "/api/admin/core/v1/auth/logout",
          undefined,
          {
            skipAuthRefresh: true,
            nonReplayable: true,
            skipAutoIdempotency: true,
          },
        );
      });
    } catch (error) {
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      if (disposition === "end") {
        setUser(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      setAuthState(disposition === "retain" ? "DEGRADED" : "AUTHENTICATED");
      throw error;
    }
    clearLocalAuthState();
    publishAdminAuthEvent("session-ended", sessionId, false);
    setUser(null);
    setAuthState("ENDED");
    router.replace("/login");
  }, [commitSessionDecision, resetBootstrapRetry, router]);

  const resetPassword = useCallback(async ({
    token,
    newPassword,
  }: AdminPasswordActionOptions) => {
    const sessionId = getStoredSessionMeta()?.sessionId;
    resetBootstrapRetry();
    commitSessionDecision();
    try {
      await withAuthLock(() =>
        axiosClient.post(
          "/api/admin/core/v1/auth/reset-password",
          { token, newPassword },
          {
            skipAuthRefresh: true,
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
          },
        ),
      );
    } catch (error) {
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      if (disposition === "end") {
        clearLocalAuthState();
        setUser(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      if (user) {
        setAuthState(disposition === "retain" ? "DEGRADED" : "AUTHENTICATED");
      }
      throw error;
    }
    stopSessionMaintenance();
    clearLocalAuthState();
    publishAdminAuthEvent("session-ended", sessionId, false);
    setUser(null);
    setAuthState("ENDED");
    router.replace("/login");
  }, [commitSessionDecision, resetBootstrapRetry, router, stopSessionMaintenance, user]);

  const logoutAll = useCallback(async () => {
    const sessionId = getStoredSessionMeta()?.sessionId;
    resetBootstrapRetry();
    commitSessionDecision();
    try {
      await ensureAdminCookieSessionFresh();
      await withAuthLock(() =>
        axiosClient.post(
          "/api/admin/core/v1/auth/logout-all",
          undefined,
          {
            skipAuthRefresh: true,
            skipAutoIdempotency: true,
            cache: "no-store",
          },
        ),
      );
    } catch (error) {
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      if (disposition === "end") {
        clearLocalAuthState();
        setUser(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      setAuthState(disposition === "retain" ? "DEGRADED" : "AUTHENTICATED");
      throw error;
    }
    stopSessionMaintenance();
    clearLocalAuthState();
    publishAdminAuthEvent("session-ended", sessionId, false);
    setUser(null);
    setAuthState("ENDED");
    router.replace("/login");
  }, [commitSessionDecision, resetBootstrapRetry, router, stopSessionMaintenance]);

  const retryBootstrap = useCallback(
    () => bootstrap(true),
    [bootstrap],
  );

  const value = useMemo<AuthContextType>(() => ({
    user,
    authState,
    isAuthenticated: user !== null,
    isLoading: user === null && isPendingAuthState(authState),
    login,
    acceptInvite,
    resetPassword,
    logout,
    logoutAll,
    retryBootstrap,
    freshLoginCount,
  }), [acceptInvite, authState, freshLoginCount, login, logout, logoutAll, resetPassword, retryBootstrap, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

function readUserProfile(payload: unknown): UserProfile {
  const profile = unwrapCoreData<unknown>(payload);
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("INVALID_AUTH_PROFILE");
  }
  const candidate = profile as Record<string, unknown>;
  const role = candidate.role;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.firstName !== "string" ||
    typeof candidate.lastName !== "string" ||
    typeof candidate.isSuperAdmin !== "boolean" ||
    typeof candidate.status !== "string" ||
    !Array.isArray(candidate.permissions) ||
    !candidate.permissions.every((permission) => typeof permission === "string") ||
    !role ||
    typeof role !== "object" ||
    Array.isArray(role) ||
    typeof (role as Record<string, unknown>).id !== "string" ||
    typeof (role as Record<string, unknown>).name !== "string"
  ) {
    throw new Error("INVALID_AUTH_PROFILE");
  }
  return candidate as unknown as UserProfile;
}

function shouldRetainCommittedSession(error: unknown): boolean {
  if (error instanceof Error && error.message === "INVALID_AUTH_PROFILE") {
    return false;
  }
  const disposition = classifyAuthFailure(
    getAuthErrorStatus(error),
    getAuthErrorCode(error),
  );
  return disposition === "retain" ||
    disposition === "refresh" ||
    disposition === "forbidden";
}

async function bestEffortAdminSessionRollback(): Promise<void> {
  try {
    await axiosClient.post(
      "/api/admin/core/v1/auth/logout",
      undefined,
      {
        skipAuthRefresh: true,
        skipSessionBinding: true,
        nonReplayable: true,
        skipAutoIdempotency: true,
        cache: "no-store",
      },
    );
  } catch {
    // Preserve the original login/bootstrap failure. The server session will
    // still expire under its idle/absolute bounds if this cleanup cannot run.
  }
}
