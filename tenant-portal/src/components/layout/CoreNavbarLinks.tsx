"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export function CoreNavbarLinks() {
  const pathname = usePathname();
  const { lang } = useI18n();
  const isActive = pathname === TENANT_ROUTES.coreSessions;

  return (
    <nav className="flex items-center gap-1" aria-label="Core">
      <Link
        href={TENANT_ROUTES.coreSessions}
        aria-current={isActive ? "page" : undefined}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
          isActive
            ? "border border-blue-200/80 bg-blue-50 text-blue-600 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-400"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
        }`}
      >
        <Lock className="size-3.5" aria-hidden="true" />
        <span>{lang === "ar" ? "جلسات تسجيل الدخول" : "Sign-in sessions"}</span>
      </Link>
    </nav>
  );
}
