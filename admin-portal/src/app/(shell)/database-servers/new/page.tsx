"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { CreateDatabaseServerWizard } from "@/features/admin/database-servers/components/CreateDatabaseServerWizard";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useI18n } from "@/i18n/I18nContext";
import { Button } from "@/design-system";

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
    <div dir={dir} className="space-y-6 w-full">
      <Button variant="link" size="sm" asChild className="px-0">
        <Link href={canReadDetails ? "/database-servers" : "/dashboard"}>
          {lang === "ar" ? <ArrowRight className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
          {canReadDetails ? copy.backToServers : copy.backToDashboard}
        </Link>
      </Button>

      {isLoading ? (
        <section role="status" className="mx-auto grid min-h-72 max-w-3xl place-items-center rounded-lg border border-border bg-card p-8 text-sm font-semibold text-muted-foreground">
          {copy.checkingPermissions}
        </section>
      ) : canCreate ? (
        <CreateDatabaseServerWizard
          activateAfterRegistration={canActivate}
          canReadDetails={canReadDetails}
          canRetrySetup={canRetrySetup}
        />
      ) : (
        <section role="alert" className="mx-auto flex min-h-72 max-w-3xl flex-col items-center justify-center rounded-lg border border-warn-200 bg-warn-50 p-8 text-center text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
          <ShieldAlert className="size-10" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-semibold">{copy.unavailable}</h1>
          <p className="mt-2 max-w-md text-sm leading-6">
            {copy.permissionRequired} <code dir="ltr">admin.database_servers.create</code> {copy.permissionRequiredTail}
          </p>
        </section>
      )}
    </div>
  );
}
