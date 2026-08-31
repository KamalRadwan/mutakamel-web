"use client";

import Link from "next/link";
import { Button } from "@/design-system";
import { SegmentErrorScreen } from "@/components/tenant/SegmentErrorScreen";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

// The boundary for every route OUTSIDE (tenant): /login, /tenant/accept-invite,
// /tenant/reset-password and the (fence) screens. Those segments had no
// error.tsx of their own, so anything they threw unwound all the way to
// global-error.tsx — which REPLACES the root layout, and with it the token
// stylesheet, the font variables and the pre-paint theme bootstrap. A failed
// render on the login screen does not warrant losing the document.
//
// Unlike the four (tenant)/**/error.tsx boundaries, this one cannot assume
// I18nProvider: that provider is mounted by TenantPortalRuntime inside
// (tenant)/layout.tsx and login/layout.tsx, NOT in the root layout. A root
// boundary renders as a child of the root layout alone, so calling useI18n()
// here would throw and escalate this error into global-error — turning one
// failure into two. not-found.tsx carries the same note for the same reason.
function RootErrorScreen({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const { t } = useI18n();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section className="flex w-full max-w-md flex-col items-center gap-2">
        <SegmentErrorScreen
          description={t.boundaries.appErrorDescription}
          digest={digest}
          onRetry={onRetry}
        />
        <Button variant="primary" asChild>
          <Link href={TENANT_ROUTES.home}>{t.boundaries.notFoundBack}</Link>
        </Button>
      </section>
    </main>
  );
}

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <I18nProvider>
      <RootErrorScreen digest={error.digest} onRetry={unstable_retry} />
    </I18nProvider>
  );
}
