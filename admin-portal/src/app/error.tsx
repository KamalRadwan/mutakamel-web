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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center dark:bg-slate-950">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        حدث خطأ غير متوقع. يمكنك إعادة المحاولة.
        <br />
        Something went wrong. You can try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        إعادة المحاولة · Retry
      </button>
    </div>
  );
}
