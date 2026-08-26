"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { CreateDatabaseServerWizard } from "@/features/admin/database-servers/components/CreateDatabaseServerWizard";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useI18n } from "@/i18n/I18nContext";

const NEW_DATABASE_SERVER_PAGE_COPY = {
  ar: {
    backToServers: "العودة إلى خوادم قواعد البيانات",
    backToDashboard: "العودة إلى لوحة التحكم",
    checkingPermissions: "جارٍ التحقق من صلاحيات خادم قاعدة البيانات…",
    unavailable: "تسجيل خادم قاعدة البيانات غير متاح",
    permissionRequired: "يلزم التصريح",
    permissionRequiredTail: "لتسجيل خادم قاعدة بيانات.",
  },
  en: {
    backToServers: "Back to Database Servers",
    backToDashboard: "Back to dashboard",
    checkingPermissions: "Checking database-server permissions…",
    unavailable: "Database Server registration is unavailable",
    permissionRequired: "Permission",
    permissionRequiredTail: "is required to register a Database Server.",
  },
} as const;

export default function NewDatabaseServerPage() {
  const { user, isLoading } = useAuth();
  const { lang, dir } = useI18n();
  const copy = NEW_DATABASE_SERVER_PAGE_COPY[lang];
  const canCreate = adminCanAll(user, ["admin.database_servers.create"]);
  const canReadDetails = adminCan(user, "admin.database_servers.read");
  const canActivate = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_UPDATE);
  const canRetrySetup = adminCanAll(
    user,
    ADMIN_RBAC_CRITICAL.DB_SERVERS_BOOTSTRAP_INITIAL,
  );

  return (
    <div
      dir={dir}
      className="min-h-screen bg-slate-50 dark:bg-canvas text-slate-900 dark:text-slate-100 flex flex-col"
    >
      <Navbar />

      <main className="flex-1 space-y-6 w-full px-4 py-4 sm:py-6">
        <Link
          href={canReadDetails ? "/database-servers" : "/dashboard"}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
        >
          {lang === "ar" ? (
            <ArrowRight className="w-4 h-4 me-1" aria-hidden="true" />
          ) : (
            <ArrowLeft className="w-4 h-4 me-1" aria-hidden="true" />
          )}
          {canReadDetails ? copy.backToServers : copy.backToDashboard}
        </Link>

        {isLoading ? (
          <section
            role="status"
            className="mx-auto grid min-h-72 max-w-3xl place-items-center rounded-xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
          >
            {copy.checkingPermissions}
          </section>
        ) : canCreate ? (
          <CreateDatabaseServerWizard
            activateAfterRegistration={canActivate}
            canReadDetails={canReadDetails}
            canRetrySetup={canRetrySetup}
          />
        ) : (
          <section
            role="alert"
            className="mx-auto flex min-h-72 max-w-3xl flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <ShieldAlert className="h-10 w-10" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-semibold">{copy.unavailable}</h1>
            <p className="mt-2 max-w-md text-sm leading-6">
              {copy.permissionRequired}{" "}
              <code dir="ltr">admin.database_servers.create</code>{" "}
              {copy.permissionRequiredTail}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
