import Link from "next/link";

// Root-level 404 for a path that matches no route in either (auth) or
// (shell) at all.
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center dark:bg-slate-950">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        الصفحة غير موجودة.
        <br />
        Page not found.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        لوحة التحكم · Dashboard
      </Link>
    </div>
  );
}
