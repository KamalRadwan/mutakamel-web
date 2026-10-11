"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePause, Hourglass, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button, LanguageToggle, ThemeToggle, cn, proseMeasure } from "@/design-system";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import type { TenantHostStatus } from "@/shared/tenancy/tenant-host-admission.server";
import { useHostStatusRecheck } from "./useHostStatusRecheck";

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

const ICON_TONE = {
  caution: "text-warning",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

/**
 * The full-screen chrome of a host that does not admit the product, laid out
 * like the fence screens (`src/app/(fence)/components/FenceScreen.tsx`, which
 * this Tier-1 file may not import). Nothing around it can change the language
 * or the theme, so it carries both toggles itself.
 */
function HostStateScreen({
  icon: Icon,
  tone,
  title,
  description,
  isAlert = false,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof ICON_TONE;
  title: string;
  description: string;
  /** A blocked host is announced at once; one still being prepared is not. */
  isAlert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas p-4">
      <div className="flex justify-end gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center py-8">
        <div
          role={isAlert ? "alert" : undefined}
          className="flex w-full max-w-prose flex-col items-center gap-3 rounded-md border border-border bg-card p-8 text-center"
        >
          <Icon className={cn("size-8", ICON_TONE[tone])} aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className={cn("text-sm text-muted-foreground", proseMeasure)}>{description}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

function CheckAgainButton({ isChecking, onClick }: { isChecking: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant="outline" size="sm" className="mt-2" loading={isChecking} onClick={onClick}>
      {isChecking ? t.hostState.checking : t.hostState.checkAgain}
    </Button>
  );
}

function SuspendedScreen() {
  const { t } = useI18n();
  return (
    <HostStateScreen
      icon={CirclePause}
      tone="caution"
      isAlert
      title={t.hostState.suspendedTitle}
      description={t.hostState.suspendedDescription}
    >
      <Button asChild variant="primary" size="sm" className="mt-2">
        <Link href="/login">{t.hostState.goToLogin}</Link>
      </Button>
    </HostStateScreen>
  );
}

// PROVISIONING. Waiting is the only thing to do, so the screen asks admission
// again on a bounded schedule and the requested page opens in place once Core
// reports the tenant ACTIVE.
function PreparingScreen() {
  const { t } = useI18n();
  const { isChecking, isAutoChecking, checkNow } = useHostStatusRecheck({ automatic: true });
  return (
    <HostStateScreen
      icon={Hourglass}
      tone="neutral"
      title={t.hostState.preparingTitle}
      description={t.hostState.preparingDescription}
    >
      <p role="status" className="text-xs text-muted-foreground">
        {isAutoChecking ? t.hostState.preparingAutoCheck : t.hostState.preparingAutoCheckStopped}
      </p>
      <CheckAgainButton isChecking={isChecking} onClick={checkNow} />
    </HostStateScreen>
  );
}

// PROVISIONING_FAILED. Only an operator's retry can resume the setup, so
// nothing is checked automatically; the user checks again once support has
// answered.
function SetupFailedScreen() {
  const { t } = useI18n();
  const { isChecking, checkNow } = useHostStatusRecheck({ automatic: false });
  return (
    <HostStateScreen
      icon={TriangleAlert}
      tone="negative"
      isAlert
      title={t.hostState.setupFailedTitle}
      description={t.hostState.setupFailedDescription}
    >
      <p className="text-xs text-muted-foreground">{t.hostState.setupFailedNextStep}</p>
      <CheckAgainButton isChecking={isChecking} onClick={checkNow} />
    </HostStateScreen>
  );
}

// The rendered chrome for the status TenantHostAdmission decides; the
// admission decision itself still lives there. Permitted by two amendments in
// docs/build/HANDOFF.md: the presentation-only conversion (2026-08-31) and the
// two pre-activation states with their bounded re-check (2026-10-11).
export function TenantHostStateBoundary({
  children,
  status,
}: {
  children: React.ReactNode;
  status: TenantHostStatus;
}) {
  const pathname = usePathname();

  if (status === "ACTIVE") return children;

  // Until the first setup finishes, Core refuses every tenant route, sign-in
  // included (TENANT_INACTIVE), so these replace every page, /login too.
  if (status === "PROVISIONING") {
    return (
      <I18nProvider>
        <PreparingScreen />
      </I18nProvider>
    );
  }
  if (status === "PROVISIONING_FAILED") {
    return (
      <I18nProvider>
        <SetupFailedScreen />
      </I18nProvider>
    );
  }

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
