"use client";

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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        حدث خطأ غير متوقع. يمكنك إعادة المحاولة.
        <br />
        Something went wrong. You can try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
      >
        إعادة المحاولة · Retry
      </button>
    </div>
  );
}
