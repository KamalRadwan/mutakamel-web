"use client";

import Link from "next/link";
import { Lock, TrendingUp } from "lucide-react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  TENANT_ROUTES,
  getFirstPermittedCrmRoute,
} from "@/lib/navigation/tenant-routes";

export default function DashboardPage() {
  const { lang } = useI18n();
  const { user } = useTenantAuth();
  const crmEntryRoute = getFirstPermittedCrmRoute(user?.permissions ?? []);
  const destinations = [
    {
      href: TENANT_ROUTES.coreSessions,
      icon: Lock,
      title: lang === "ar" ? "جلسات تسجيل الدخول" : "Sign-in sessions",
      description:
        lang === "ar"
          ? "راجع جلسات حسابك وألغِ الأجهزة غير المعروفة."
          : "Review your account sessions and revoke unknown devices.",
    },
    ...(crmEntryRoute
      ? [
          {
            href: crmEntryRoute,
            icon: TrendingUp,
            title: lang === "ar" ? "إدارة علاقات العملاء" : "CRM",
            description:
              lang === "ar"
                ? "انتقل إلى أول مساحة CRM متاحة وفق صلاحيات حسابك."
                : "Open the first CRM workspace allowed by your account permissions.",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {lang === "ar" ? "مساحة عمل متكامل" : "Mutakamel workspace"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {lang === "ar"
            ? "اختر إحدى الإمكانات المتصلة حاليًا بالخادم."
            : "Choose one of the capabilities currently connected to the server."}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {destinations.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
          >
            <Icon className="size-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
