"use client";

import { Button } from "@/design-system";

// Root-level fallback for segments outside both (auth) and (shell) — in
// practice just the "/" redirect page.tsx. Deliberately dependency-free,
// same reasoning as (shell)/error.tsx.
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      aria-labelledby="root-error-title"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center"
    >
      <h1 id="root-error-title" className="text-lg font-semibold text-foreground">
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
