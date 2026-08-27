"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isPendingAuthState, useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authState, isAuthenticated, isLoading, retryBootstrap } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicAuthPage = isPublicAdminAuthPath(pathname);
  const isPendingAuthentication =
    !isAuthenticated && (isLoading || isPendingAuthState(authState));

  useEffect(() => {
    if (isPublicAuthPage) {
      if (isAuthenticated && pathname === "/login") {
        router.push("/dashboard");
      }
      return;
    }
    if (isPendingAuthentication || authState === "DEGRADED") return;

    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [authState, isAuthenticated, isPendingAuthentication, isPublicAuthPage, pathname, router]);

  if (!isPublicAuthPage && isPendingAuthentication) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3 select-none">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-xs font-mono text-muted-foreground">جاري التحقق من الجلسة...</span>
      </div>
    );
  }

  if (!isPublicAuthPage && authState === "DEGRADED" && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          تعذر التحقق من الجلسة حاليًا. لم يتم تسجيل خروجك.
        </p>
        <button
          type="button"
          onClick={() => void retryBootstrap()}
          className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-ink-950 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // Prevent protected children from mounting before unauthenticated redirect
  if (!isAuthenticated && !isPublicAuthPage) {
    return null;
  }

  return <>{children}</>;
}

const PUBLIC_ADMIN_AUTH_PATHS = new Set([
  "/login",
  "/admin/accept-invite",
  "/admin/reset-password",
]);

export function isPublicAdminAuthPath(pathname: string): boolean {
  const normalized = pathname.length > 1
    ? pathname.replace(/\/+$/, "")
    : pathname;
  return PUBLIC_ADMIN_AUTH_PATHS.has(normalized);
}
