"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/design-system";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import type { TenantHostStatus } from "@/shared/tenancy/tenant-host-admission.server";

// This boundary sits ABOVE the app's own I18nProvider — TenantHostAdmission
// wraps TenantPortalRuntime, not the other way round — so its chrome brings
// its own provider rather than reordering the runtime tree. I18nProvider
// holds no state of its own (it reads the useLanguage external store), so
// the nesting on the /login path costs nothing and both instances always
// agree on the language.
function SuspendedBanner() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      // `top-16` was 64px hand-fitted under a single 48px topbar. The shell
      // is two bars now, so this clears the token rather than a number.
      className="fixed inset-x-4 top-(--size-chrome) z-(--z-topbar) mx-auto mt-2 max-w-md rounded-md border border-caution-200 bg-caution-100 px-4 py-3 text-center text-xs font-medium text-caution-800 shadow-pop dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300"
    >
      {t.hostState.suspendedBanner}
    </div>
  );
}

function SuspendedScreen() {
  const { t } = useI18n();
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="flex max-w-prose flex-col items-center gap-3 rounded-md border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">{t.hostState.suspendedTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.hostState.suspendedDescription}</p>
        <Button asChild variant="primary" size="sm">
          <Link href="/login">{t.hostState.goToLogin}</Link>
        </Button>
      </div>
    </main>
  );
}

// Presentation-only conversion of a Tier-1 file, permitted by the 2026-08-31
// amendment in docs/build/HANDOFF.md. The admission decision itself is
// unchanged and still lives in TenantHostAdmission.
export function TenantHostStateBoundary({
  children,
  status,
}: {
  children: React.ReactNode;
  status: TenantHostStatus;
}) {
  const pathname = usePathname();

  if (status === "ACTIVE") return children;

  if (pathname === "/login") {
    return (
      <>
        <I18nProvider>
          <SuspendedBanner />
        </I18nProvider>
        {children}
      </>
    );
  }

  return (
    <I18nProvider>
      <SuspendedScreen />
    </I18nProvider>
  );
}
