"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, EmptyState } from "@/design-system";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

// I18nProvider lives in TenantPortalRuntime, inside (tenant)/layout.tsx and
// login/layout.tsx — NOT in the root layout. A root not-found renders as a
// child of the root layout alone, so useI18n() would throw here and escalate
// a 404 into global-error. The provider is mounted locally instead; it needs
// no server data, only the language store.
//
// This file also answers every unmatched URL, and it is what
// TenantHostAdmission's notFound() reaches: that call happens inside
// (tenant)/layout.tsx's own render, so it unwinds past AppShell to the root
// boundary. The screen therefore has to stand on its own rather than assume
// the shell around it.
function NotFoundScreen() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <section className="flex w-full max-w-md flex-col items-center gap-2">
        <EmptyState
          icon={SearchX}
          title={t.boundaries.notFoundTitle}
          description={t.boundaries.notFoundDescription}
        />
        <Button variant="primary" asChild>
          <Link href={TENANT_ROUTES.home}>{t.boundaries.notFoundBack}</Link>
        </Button>
      </section>
    </main>
  );
}

export default function NotFound() {
  return (
    <I18nProvider>
      <NotFoundScreen />
    </I18nProvider>
  );
}
