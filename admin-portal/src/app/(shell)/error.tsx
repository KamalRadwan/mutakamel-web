"use client";

import { Button } from "@/design-system";

// Minimal placeholder — Phase 12 of the design-system migration
// (docs/design-system/migration.md) replaces this body with the real
// ErrorState pattern. Deliberately has no dependency on I18nContext or any
// other provider: an error boundary must not be able to fail itself.
export default function ShellError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      aria-labelledby="shell-error-title"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 id="shell-error-title" className="text-lg font-semibold text-foreground">
        تعذر تحميل الصفحة · Page unavailable
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        حدث خطأ غير متوقع. يمكنك إعادة المحاولة.
        <br />
        Something went wrong. You can try again.
      </p>
      <Button type="button" variant="primary" onClick={reset}>
        إعادة المحاولة · Retry
      </Button>
    </section>
  );
}
