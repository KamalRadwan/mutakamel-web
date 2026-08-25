"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  axiosClient,
  clearLocalTenantAuthState,
  getStoredTenantSessionMeta,
  readWebAuthSessionResponse,
  storeTenantSessionMetadata,
  synchronizeTenantTabSession,
  unwrapCoreData,
  withTenantAuthLock,
} from "@/lib/api/axiosClient";
import {
  publishTenantAuthEvent,
  subscribeToTenantAuthEvents,
  subscribeToTenantAuthLifecycle,
} from "@/lib/auth/sessionCoordinator";
import {
  classifyAuthFailure,
  getAuthErrorCode,
  getAuthErrorStatus,
} from "@/lib/auth/sessionErrors";

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
  const [realtimeAuthGeneration, setRealtimeAuthGeneration] = useState<string | null>(null);
  const router = useRouter();

  const bootstrap = useCallback(async (markPending = true) => {
    if (markPending) {
      setAuthState((current) =>
        current === "AUTHENTICATED" || current === "DEGRADED"
          ? "STALE"
          : "BOOTSTRAPPING",
      );
    }
    try {
      const response = await axiosClient.get(
        "/api/tenant/core/v1/auth/me",
        { cache: "no-store" },
      );
      const profile = readTenantUserProfile(response.data);
      setUser(profile);
      setRealtimeAuthGeneration(readRealtimeAuthGeneration(profile.id));
      setAuthState("AUTHENTICATED");
    } catch (error) {
      const disposition = classifyAuthFailure(
        getAuthErrorStatus(error),
        getAuthErrorCode(error),
      );
      if (disposition === "retain") {
        setAuthState("DEGRADED");
        return;
      }
      clearLocalTenantAuthState();
      setUser(null);
      setRealtimeAuthGeneration(null);
      setAuthState(disposition === "end" ? "ENDED" : "UNAUTHENTICATED");
    }
  }, []);

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
    subscribeToTenantAuthEvents((event) => {
      if (event.kind === "session-ended") {
        clearLocalTenantAuthState();
        setUser(null);
        setRealtimeAuthGeneration(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      if (getStoredTenantSessionMeta()?.sessionId !== event.sessionId) {
        setRealtimeAuthGeneration(null);
      }
      synchronizeTenantTabSession(event.sessionId);
      void bootstrap();
    }), [bootstrap, router]);

  useEffect(() =>
    subscribeToTenantAuthLifecycle((state) => {
      if (state === "ENDED") {
        setUser(null);
        setRealtimeAuthGeneration(null);
        setAuthState("ENDED");
        router.replace("/login");
        return;
      }
      setAuthState(state);
    }), [router]);

  const login = useCallback(async ({
    email,
    password,
    rememberMe = false,
  }: TenantLoginOptions) => {
    let sessionCommitted = false;
    setRealtimeAuthGeneration(null);
    setAuthState("BOOTSTRAPPING");
    try {
      const profile = await withTenantAuthLock(async () => {
        clearLocalTenantAuthState();
        const loginResponse = await axiosClient.post(
          "/api/tenant/core/v1/auth/login",
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
          await bestEffortTenantSessionRollback();
          publishTenantAuthEvent("session-ended", undefined, false);
          throw invalidResponse;
        }

        sessionCommitted = true;
        const event = publishTenantAuthEvent(
          "session-updated",
          auth.session.id,
          false,
        );
        storeTenantSessionMetadata(auth, rememberMe, event.eventId);

        try {
          const meResponse = await axiosClient.get(
            "/api/tenant/core/v1/auth/me",
            { skipAuthRefresh: true, cache: "no-store" },
          );
          return readTenantUserProfile(meResponse.data);
        } catch (error) {
          if (!shouldRetainCommittedTenantSession(error)) {
            await bestEffortTenantSessionRollback();
            clearLocalTenantAuthState();
            publishTenantAuthEvent(
              "session-ended",
              auth.session.id,
              false,
            );
          }
          throw error;
        }
      });

      setUser(profile);
      setRealtimeAuthGeneration(readRealtimeAuthGeneration(profile.id));
      setAuthState("AUTHENTICATED");
      router.push("/");
    } catch (error) {
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
      setAuthState(disposition === "end" ? "ENDED" : "UNAUTHENTICATED");
      throw error;
    }
  }, [router]);

  const logout = useCallback(async () => {
    const sessionId = getStoredTenantSessionMeta()?.sessionId;
    setRealtimeAuthGeneration(null);
    try {
      await withTenantAuthLock(async () => {
        await axiosClient.post(
          "/api/tenant/core/v1/auth/logout",
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
      setRealtimeAuthGeneration(
        user ? readRealtimeAuthGeneration(user.id) : null,
      );
      throw error;
    }
    clearLocalTenantAuthState();
    publishTenantAuthEvent("session-ended", sessionId, false);
    setUser(null);
    setRealtimeAuthGeneration(null);
    setAuthState("ENDED");
    router.replace("/login");
  }, [router, user]);

  const value = useMemo<TenantAuthContextValue>(() => ({
    user,
    authState,
    realtimeAuthGeneration,
    isAuthenticated: user !== null,
    isLoading: authState === "BOOTSTRAPPING" && user === null,
    login,
    logout,
    retryBootstrap: () => bootstrap(true),
  }), [authState, bootstrap, login, logout, realtimeAuthGeneration, user]);

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
  if (error instanceof Error && error.message === "INVALID_AUTH_PROFILE") {
    return false;
  }
  return classifyAuthFailure(
    getAuthErrorStatus(error),
    getAuthErrorCode(error),
  ) === "retain";
}

async function bestEffortTenantSessionRollback(): Promise<void> {
  try {
    await axiosClient.post(
      "/api/tenant/core/v1/auth/logout",
      undefined,
      {
        skipAuthRefresh: true,
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
