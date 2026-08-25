"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";

const PUBLIC_PATHS = new Set(["/login"]);

export function TenantAuthGuard({ children }: { children: React.ReactNode }) {
  const {
    authState,
    isAuthenticated,
    isLoading,
    retryBootstrap,
  } = useTenantAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isLoading || authState === "DEGRADED") return;
    if (!isAuthenticated && !isPublic) router.replace("/login");
    if (isAuthenticated && pathname === "/login") router.replace("/");
  }, [authState, isAuthenticated, isLoading, isPublic, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <Loader2 className="size-8 animate-spin text-blue-500" />
        <span className="text-xs text-slate-400">جاري التحقق من الجلسة...</span>
      </div>
    );
  }

  if (authState === "DEGRADED" && !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
        <p className="text-sm text-slate-300">
          تعذر التحقق من الجلسة حاليًا. لم يتم تسجيل خروجك.
        </p>
        <button
          type="button"
          onClick={() => void retryBootstrap()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold hover:bg-blue-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!isAuthenticated && !isPublic) return null;
  return <>{children}</>;
}
