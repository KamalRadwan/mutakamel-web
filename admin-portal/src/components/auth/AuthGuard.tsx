"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isPendingAuthState, useAuth, type BootstrapFailure } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { authState, bootstrapFailure, isAuthenticated, isLoading, retryBootstrap } =
    useAuth();
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
      <div role="status" className="flex min-h-dvh select-none flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="size-8 animate-spin text-info motion-reduce:animate-none" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{t.common.sessionChecking}</span>
      </div>
    );
  }

  if (!isPublicAuthPage && authState === "DEGRADED" && !isAuthenticated) {
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <p className="text-sm font-medium">
          {describeBootstrapFailure(bootstrapFailure, t.common)}
        </p>
        <p className="text-sm text-muted-foreground">
          {t.common.sessionUnavailable}
        </p>
        {bootstrapFailure?.code ? (
          <p className="font-mono text-xs text-muted-foreground">
            <bdi dir="ltr">{bootstrapFailure.code}</bdi>
          </p>
        ) : null}
        <Button
          type="button"
          onClick={() => void retryBootstrap()}
          variant="primary"
        >
          {t.common.retry}
        </Button>
      </div>
    );
  }

  // Prevent protected children from mounting before unauthenticated redirect
  if (!isAuthenticated && !isPublicAuthPage) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Names the fault, so the operator knows this is the server and not their
 * account. A bare "could not be checked" reads like a sign-out; a status does
 * not.
 */
function describeBootstrapFailure(
  failure: BootstrapFailure | null,
  copy: { serverErrorTitle: string; serviceUnavailableTitle: string; networkUnreachableTitle: string },
): string {
  if (!failure || failure.status === 0) return copy.networkUnreachableTitle;
  if (failure.status === 503 || failure.status === 504) {
    return copy.serviceUnavailableTitle;
  }
  if (failure.status >= 500) return copy.serverErrorTitle;
  return copy.serviceUnavailableTitle;
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
