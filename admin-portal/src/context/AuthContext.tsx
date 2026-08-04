"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { safeStorage } from "@/lib/safeStorage";
import {
  axiosClient,
  withAuthLock,
  clearLocalAuthState,
  getStoredSessionMeta,
  readAdminAuthTokenResponse,
  refreshAdminCookieSession,
  unwrapCoreData,
  SessionTokenMetadata
} from "@/lib/api/axiosClient";
import { startAdminSessionRefreshScheduler } from "@/lib/auth/sessionRefresh";

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isSuperAdmin: boolean;
  roleId?: string;
  role?: { name: string; description?: string };
  status?: string;
  permissions: string[];
}

interface LoginOptions {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (options: LoginOptions) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readUserProfile(payload: unknown): UserProfile {
  const profile = unwrapCoreData<unknown>(payload);
  if (
    !profile ||
    typeof profile !== "object" ||
    typeof (profile as UserProfile).id !== "string" ||
    typeof (profile as UserProfile).email !== "string" ||
    !Array.isArray((profile as UserProfile).permissions)
  ) {
    throw new Error("INVALID_AUTH_PROFILE");
  }

  // Ensure permissions are strictly a string array of keys
  const rawPerms = (profile as UserProfile).permissions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stringPerms = rawPerms.map((p: any) => typeof p === "string" ? p : p.key || p.id).filter(Boolean);
  (profile as UserProfile).permissions = stringPerms;

  return profile as UserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // -------------------------------------------------------------
  // CROSS-TAB SESSION SYNCHRONIZATION LISTENER
  // -------------------------------------------------------------
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "admin_global_session_event") {
        const storedMeta = getStoredSessionMeta();
        if (storedMeta && e.newValue !== storedMeta.loginGeneration) {
          // Another tab logged in or session generation changed -> fail closed
          clearLocalAuthState();
          setUser(null);
          router.push("/login");
        }
      } else if (e.key === "admin_global_logout_event") {
        // Another tab logged out -> clear local state & redirect
        clearLocalAuthState();
        setUser(null);
        router.push("/login");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageChange);
      }
    };
  }, [router]);

  // -------------------------------------------------------------
  // PROACTIVE SKEW TOKEN REFRESH SCHEDULER (60s SKEW)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    return startAdminSessionRefreshScheduler({
      getMetadata: getStoredSessionMeta,
      refresh: async () => {
        await withAuthLock(async () => {
          const currentMeta = getStoredSessionMeta();
          if (!currentMeta) return;
          await refreshAdminCookieSession(currentMeta.remember);
        });
      },
      onDefinitiveFailure: () => {
        clearLocalAuthState();
        setUser(null);
        router.push("/login");
      },
    });
  }, [user, router]);

  // -------------------------------------------------------------
  // INITIAL AUTH VERIFICATION ON MOUNT
  // -------------------------------------------------------------
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = sessionStorage.getItem("admin_session_meta");
        const storedUser = sessionStorage.getItem("user_profile");

        if (storedToken && storedUser) {
          setUser(readUserProfile(JSON.parse(storedUser)));
        } else if (storedToken) {
          const { data } = await axiosClient.get("/api/admin/core/v1/auth/me");
          const userProfile = readUserProfile(data);
          setUser(userProfile);
          sessionStorage.setItem("user_profile", JSON.stringify(userProfile));
        } else {
          setUser(null);
        }
      } catch {
        clearLocalAuthState();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // -------------------------------------------------------------
  // ATOMIC LOGIN SEQUENCE (7 SPECIFICATION STEPS)
  // -------------------------------------------------------------
  const login = async ({ email, password, rememberMe = false }: LoginOptions) => {
    setIsLoading(true);

    try {
      await withAuthLock(async () => {
        // Step 2: Clear stale local auth generation safely
        clearLocalAuthState();

        // Step 3: POST /login with remember flag & credentials: "include"
        const rememberFlag = rememberMe ? "1" : "0";
        const loginRes = await axiosClient.post(
          "/api/admin/core/v1/auth/login",
          { email, password },
          {
            headers: {
              "x-auth-remember": rememberFlag,
            },
          }
        );

        // Step 4: Validate the session metadata & tokens.
        const loginTokens = readAdminAuthTokenResponse(loginRes.data);
        if (!loginTokens) {
          throw new Error("INVALID_AUTH_RESPONSE");
        }
        const { expiresIn, tokenType } = loginTokens;

        // Step 5: Validate the new cookie session through GET /auth/me.
        const meRes = await axiosClient.get("/api/admin/core/v1/auth/me", {
          skipAuthRefresh: true,
        });

        const userProfile = readUserProfile(meRes.data);

        // Step 6: Store validated user metadata only after /me succeeds
        const loginGeneration = "gen_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
        const sessionMeta: SessionTokenMetadata = {
          savedAt: Date.now(),
          expiresIn: expiresIn || 3600,
          tokenType: tokenType || "Bearer",
          loginGeneration,
          remember: rememberMe,
          cookieRevision: 1,
        };

        sessionStorage.setItem("admin_session_meta", JSON.stringify(sessionMeta));
        sessionStorage.setItem("user_profile", JSON.stringify(userProfile));

        // Notify other tabs of new login generation via non-secret localStorage event
        if (typeof window !== "undefined") {
          safeStorage.setItem("admin_global_session_event", loginGeneration);
        }

        setUser(userProfile);
      });

      // Default route upon successful login is dashboard
      router.push("/dashboard");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Step 7: Clear local auth state and fail closed on any ambiguity or failure
      clearLocalAuthState();
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ATOMIC LOGOUT SEQUENCE (6 SPECIFICATION STEPS)
  // -------------------------------------------------------------
  const logout = async () => {
    try {
      await withAuthLock(async () => {
        // POST /api/admin/core/v1/auth/logout with credentials: "include" and cookie mode
        await axiosClient.post(
          "/api/admin/core/v1/auth/logout",
          {},
          {
            headers: {},
          }
        ).catch(() => {});
      });
    } finally {
      // Clear sessionStorage access token & all local session metadata in a finally block
      clearLocalAuthState();
      setUser(null);
      if (typeof window !== "undefined") {
        safeStorage.setItem("admin_global_logout_event", Date.now().toString());
      }
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
