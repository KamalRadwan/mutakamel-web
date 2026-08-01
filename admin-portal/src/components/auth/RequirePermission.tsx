"use client";

import { useAuth } from "@/context/AuthContext";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan } from "@/lib/auth/rbac";

interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();

  if (isLoading) return null;

  const hasPermission = adminCan(user, permission);

  if (!hasPermission) {
    if (fallback !== undefined) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-700">
          {lang === "ar" ? "غير مصرح" : "Unauthorized"}
        </h2>
        <p className="text-sm mt-1">
          {lang === "ar" ? `تحتاج إلى صلاحية ${permission} للوصول.` : `You need the ${permission} permission to view this.`}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function useHasPermission(permission: string): boolean {
  const { user } = useAuth();
  return adminCan(user, permission);
}
