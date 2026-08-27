"use client";

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
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
