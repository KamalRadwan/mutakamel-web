"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TenantHostStatus } from "@/shared/tenancy/tenant-host-admission.server";

export function TenantHostStateBoundary({
  children,
  status,
}: {
  children: React.ReactNode;
  status: TenantHostStatus;
}) {
  const pathname = usePathname();

  if (status === "ACTIVE") return children;

  if (pathname === "/login") {
    return (
      <>
        <div
          role="status"
          className="fixed inset-x-4 top-16 z-50 mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          خدمات المؤسسة معلّقة مؤقتًا. لا يزال تسجيل الدخول متاحًا لمسؤول المؤسسة.
        </div>
        {children}
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white">
      <div className="max-w-md space-y-4 rounded-2xl border border-amber-900/60 bg-slate-900 p-8">
        <h1 className="text-lg font-bold">خدمات المؤسسة غير متاحة مؤقتًا</h1>
        <p className="text-sm leading-6 text-slate-300">
          تم تعليق الوصول إلى صفحات المؤسسة. يمكن لمسؤول المؤسسة متابعة تسجيل الدخول
          للوصول إلى المسارات المسموح بها قبل المصادقة.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold hover:bg-blue-700"
        >
          الانتقال إلى تسجيل الدخول
        </Link>
      </div>
    </main>
  );
}
