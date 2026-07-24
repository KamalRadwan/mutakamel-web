"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  axiosClient, 
  withAuthLock, 
  clearLocalAuthState, 
  getStoredSessionMeta,
  readAdminAuthTokenResponse,
  SessionTokenMetadata
} from "@/lib/api/axiosClient";

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
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

    const storedMeta = getStoredSessionMeta();
    if (!storedMeta || !storedMeta.expiresIn) return;

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - storedMeta.savedAt) / 1000);
    const timeUntilExpiry = storedMeta.expiresIn - elapsedSeconds;
    
    // Refresh 60 seconds before expiration
    const refreshDelaySeconds = Math.max(timeUntilExpiry - 60, 5);

    const timer = setTimeout(async () => {
      try {
        await withAuthLock(async () => {
          const currentMeta = getStoredSessionMeta();
          if (!currentMeta) return;

          const rememberFlag = currentMeta.cookieRevision ? "1" : "0";
          const res = await axiosClient.post(
            "/api/admin/core/v1/auth/refresh",
            {},
            {
              headers: {
                "x-auth-cookie-mode": "1",
                "x-auth-remember": rememberFlag,
              },
            }
          );

          const refreshTokens = readAdminAuthTokenResponse(res.data);
          if (refreshTokens) {
            sessionStorage.setItem("access_token", refreshTokens.accessToken);
            const updatedMeta: SessionTokenMetadata = {
              ...currentMeta,
              accessToken: refreshTokens.accessToken,
              savedAt: Date.now(),
              expiresIn: refreshTokens.expiresIn || currentMeta.expiresIn,
              cookieRevision: (currentMeta.cookieRevision || 0) + 1,
            };
            sessionStorage.setItem("admin_session_meta", JSON.stringify(updatedMeta));
          } else {
            throw new Error("INVALID_REFRESH_RESPONSE");
          }
        });
      } catch {
        // Proactive refresh failed -> fail closed safely
        clearLocalAuthState();
        setUser(null);
        router.push("/login");
      }
    }, refreshDelaySeconds * 1000);

    return () => clearTimeout(timer);
  }, [user, router]);

  // -------------------------------------------------------------
  // INITIAL AUTH VERIFICATION ON MOUNT
  // -------------------------------------------------------------
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = sessionStorage.getItem("access_token");
        const storedUser = sessionStorage.getItem("user_profile");

        if (storedToken && storedUser) {
          setUser(JSON.parse(storedUser));
        } else if (storedToken) {
          const { data } = await axiosClient.get("/api/admin/core/v1/auth/me");
          setUser(data);
          sessionStorage.setItem("user_profile", JSON.stringify(data));
        }
      } catch (err) {
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

        // Step 3: POST /login with cookie mode headers & credentials: "include"
        const rememberFlag = rememberMe ? "1" : "0";
        const loginRes = await axiosClient.post(
          "/api/admin/core/v1/auth/login",
          { email, password },
          {
            headers: {
              "x-auth-cookie-mode": "1",
              "x-auth-remember": rememberFlag,
            },
          }
        );

        // Step 4: Receive accessToken in JSON
        const loginTokens = readAdminAuthTokenResponse(loginRes.data);
        if (!loginTokens) {
          throw new Error("INVALID_AUTH_RESPONSE");
        }
        const { accessToken, expiresIn, tokenType } = loginTokens;

        // Store access token in sessionStorage for immediate /me call
        sessionStorage.setItem("access_token", accessToken);

        // Step 5: Call GET /auth/me using received access token in Authorization
        const meRes = await axiosClient.get("/api/admin/core/v1/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const userProfile = meRes.data;

        // Step 6: Store access token & validated user metadata only after /me succeeds
        const loginGeneration = "gen_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
        const sessionMeta: SessionTokenMetadata = {
          accessToken,
          savedAt: Date.now(),
          expiresIn: expiresIn || 3600,
          tokenType: tokenType || "Bearer",
          loginGeneration,
          cookieRevision: 1,
        };

        sessionStorage.setItem("admin_session_meta", JSON.stringify(sessionMeta));
        sessionStorage.setItem("user_profile", JSON.stringify(userProfile));

        // Notify other tabs of new login generation via non-secret localStorage event
        if (typeof window !== "undefined") {
          localStorage.setItem("admin_global_session_event", loginGeneration);
        }

        setUser(userProfile);
      });

      // Default route upon successful login is dashboard
      router.push("/dashboard");
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
            headers: {
              "x-auth-cookie-mode": "1",
            },
          }
        ).catch(() => {});
      });
    } finally {
      // Clear sessionStorage access token & all local session metadata in a finally block
      clearLocalAuthState();
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.setItem("admin_global_logout_event", Date.now().toString());
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
