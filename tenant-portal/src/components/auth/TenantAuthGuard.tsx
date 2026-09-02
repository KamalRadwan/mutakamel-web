"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { tenantSessionEndedHref } from "@/lib/auth/sessionDestination";
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
      // MASTER-PLAN 13.7 closed the first half of Q18: the code rides the
      // context value, so the screen can say which terminal reason applied
      // instead of an honest but generic headline. The second half is closed
      // too — `AuthContext` no longer redirects to /login when a session ends
      // mid-work, so this is now the only place a terminal state picks a
      // destination, for a bootstrap failure and a mid-session end alike.
      router.replace(
        authState === "ENDED" ? tenantSessionEndedHref(endedReason) : "/login",
      );
    }
    if (isAuthenticated && pathname === "/login") router.replace("/");
  }, [authState, endedReason, isAuthenticated, isLoading, isPublic, pathname, router]);

  // `!isPublic` is load-bearing, not a tidy-up. A public page owns interactive
  // state, and this branch REPLACES it — React unmounts the subtree and every
  // useState in it is destroyed.
  //
  // That is what made a failed sign-in do nothing at all. `login()` sets
  // BOOTSTRAPPING before the request, so pressing "تسجيل الدخول" swapped the
  // form for this spinner and unmounted it; the 401 then set `failure` on a
  // component that no longer existed, and when the state settled the form came
  // back freshly mounted with `failure` null. Measured: the POST returns 401
  // and not one character changes on screen.
  //
  // A public page has its own in-place affordance for this — the submit button
  // already shows `isSubmitting` — so the global spinner was never the right
  // thing to show over it, and showing the login form during the initial
  // session check is better than a spinner that resolves into that same form.
  if (isLoading && !isPublic) {
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
