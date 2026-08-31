"use client";

import Link from "next/link";
import { Button, ErrorState, ThemeProvider } from "@/design-system";
import { I18nProvider, useI18n } from "@/i18n/I18nContext";
import { useDirection, useLanguage } from "@/i18n/useLanguage";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { dmMono, readex } from "./fonts";
import "./globals.css";

// global-error REPLACES the root layout when it renders, so nothing that
// layout sets up exists here: no <html>/<body>, no font variables, no token
// stylesheet, no beforeInteractive theme bootstrap, and none of the
// providers. Every one of those is re-declared below rather than assumed —
// that is what "self-contained" means for this file. See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
//
// Two honest consequences of losing the bootstrap script: the language and
// theme are resolved by React rather than before the first paint, so a dark
// or English user sees one light/RTL frame here. On a crash screen that is
// the right trade against re-injecting an inline script that the planned CSP
// would then have to allow a second nonce for.
function GlobalErrorScreen({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const { t } = useI18n();
  const description = digest
    ? `${t.boundaries.appErrorDescription} — ${t.errors.reference}: ${digest}`
    : t.boundaries.appErrorDescription;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <title>{t.boundaries.appErrorTitle}</title>
      <section className="flex w-full max-w-md flex-col items-center gap-2">
        <ErrorState
          title={t.boundaries.appErrorTitle}
          description={description}
          onRetry={onRetry}
          retryLabel={t.boundaries.retry}
        />
        <Button variant="primary" asChild>
          <Link href={TENANT_ROUTES.home}>{t.boundaries.notFoundBack}</Link>
        </Button>
      </section>
    </main>
  );
}

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const lang = useLanguage();
  const dir = useDirection();

  return (
    <html lang={lang} dir={dir} className="h-full" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${readex.variable} ${dmMono.variable} h-full antialiased`}
      >
        <ThemeProvider>
          <I18nProvider>
            <GlobalErrorScreen digest={error.digest} onRetry={unstable_retry} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
