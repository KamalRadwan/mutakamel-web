"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Phone } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export function CoreNavbarLinks() {
  const pathname = usePathname();
  const { lang } = useI18n();

  const links = [
    {
      href: TENANT_ROUTES.coreSessions,
      icon: Lock,
      label: lang === "ar" ? "جلسات تسجيل الدخول" : "Sign-in sessions",
    },
    {
      href: TENANT_ROUTES.coreWebphoneSettings,
      icon: Phone,
      label: lang === "ar" ? "إعدادات الهاتف المرئي" : "WebPhone settings",
    },
  ];

  return (
    <nav className="flex items-center gap-1" aria-label="Core">
      {links.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "border border-blue-200/80 bg-blue-50 text-blue-600 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-400"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
