import Link from "next/link";

// Root-level 404 for a path that matches no route in either (auth) or
// (shell) at all.
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-sm text-muted-foreground">
        الصفحة غير موجودة.
        <br />
        Page not found.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
      >
        لوحة التحكم · Dashboard
      </Link>
    </div>
  );
}
