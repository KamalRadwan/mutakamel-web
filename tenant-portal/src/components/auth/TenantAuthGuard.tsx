"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { isSessionEndingAuthCode } from "@/lib/auth/sessionErrors";
import { useI18n } from "@/i18n/I18nContext";

// Every screen a visitor may reach with no session: the sign-in form, the two
// single-use-token screens the invite and reset emails link to, and the four
// terminal fences. A fence that bounced to /login could never be read.
const PUBLIC_PATHS = new Set([
  "/login",
  "/tenant/accept-invite",
  "/tenant/reset-password",
  "/session-expired",
  "/account-suspended",
  "/maintenance",
  "/entitlement-blocked",
]);

/**
 * The destination is unchanged — only the reason is added to it.
 *
 * `/session-expired` validates `?reason=` again before it renders anything.
 * It is validated here as well, so a code the transport never produces can
 * never reach a URL in the first place: the guard hands over one of the seven
 * `SESSION_ENDING_AUTH_CODES` or nothing at all.
 */
function sessionExpiredHref(endedReason: string | null): string {
  if (endedReason === null || !isSessionEndingAuthCode(endedReason)) {
    return "/session-expired";
  }
  return `/session-expired?reason=${encodeURIComponent(endedReason)}`;
}

// Presentation-only conversion of a Tier-1 file, permitted by the 2026-08-31
// amendment in docs/build/HANDOFF.md; the reason parameter is permitted by the
// second amendment of the same date.
export function TenantAuthGuard({ children }: { children: React.ReactNode }) {
  const {
    authState,
    endedReason,
    isAuthenticated,
    isLoading,
    retryBootstrap,
  } = useTenantAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isLoading || authState === "DEGRADED") return;
    if (!isAuthenticated && !isPublic) {
      // MASTER-PLAN 4.24: an ENDED state is a session that was terminated, not
      // a visitor who never signed in, and collapsing the two into one silent
      // /login bounce is why nobody was ever told why they were logged out.
      //
      // MASTER-PLAN 13.7 closed the first half of Q18: the code now rides the
      // context value, so the screen can say which of the four terminal reasons
      // applied instead of an honest but generic headline. The second half is
      // still open — `AuthContext` redirects to /login itself when a session
      // ends mid-work, so this path is reached on bootstrap, not on every end.
      router.replace(
        authState === "ENDED" ? sessionExpiredHref(endedReason) : "/login",
      );
    }
    if (isAuthenticated && pathname === "/login") router.replace("/");
  }, [authState, endedReason, isAuthenticated, isLoading, isPublic, pathname, router]);

  if (isLoading) {
    return (
      // role="status" + aria-busy is the spinner's reduced-motion fallback —
      // the ring stops turning, so the announced text is what carries the
      // state. docs/design/motion.md#reduced-motion.
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas text-foreground"
      >
        <Loader2 className="size-8 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{t.sessionGuard.verifying}</span>
      </div>
    );
  }

  if (authState === "DEGRADED" && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div
          role="alert"
          className="flex max-w-prose flex-col items-center gap-3 rounded-md border border-border bg-card p-8 text-center"
        >
          <p className="text-sm font-medium text-foreground">{t.sessionGuard.degradedTitle}</p>
          <p className="text-xs text-muted-foreground">{t.sessionGuard.degradedDescription}</p>
          <Button variant="primary" size="sm" onClick={() => void retryBootstrap()}>
            {t.common.retry}
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isPublic) return null;
  return <>{children}</>;
}
