import Link from "next/link";

// Minimal placeholder — Phase 12 of the design-system migration replaces
// this body with the real EmptyState pattern.
export default function ShellNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
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
