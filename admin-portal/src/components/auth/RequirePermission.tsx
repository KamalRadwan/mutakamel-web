"use client";

import { useAuth } from "@/context/AuthContext";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan, adminCanAll, adminCanAny } from "@/lib/auth/rbac";
import type { ReactNode } from "react";

type PermissionRequirement =
  | { permission: string; allOf?: never; anyOf?: never }
  | { permission?: never; allOf: readonly string[]; anyOf?: never }
  | { permission?: never; allOf?: never; anyOf: readonly string[] };

type RequirePermissionProps = PermissionRequirement & {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequirePermission(props: RequirePermissionProps) {
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();

  if (isLoading) return null;

  const hasPermission = satisfiesRequirement(user, props);

  if (!hasPermission) {
    if (props.fallback !== undefined) return <>{props.fallback}</>;

    const description = requirementDescription(props);

    return (
      <section
        role="alert"
        className="flex flex-col items-center justify-center p-12 text-slate-500"
      >
        <ShieldAlert
          className="mb-4 size-12 text-slate-300"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          {lang === "ar" ? "غير مصرح لك" : "Permission required"}
        </h2>
        <p className="mt-1 max-w-2xl break-words text-center text-sm">
          {lang === "ar"
            ? `يتطلب هذا القسم ${description}.`
            : `This section requires ${description}.`}
        </p>
      </section>
    );
  }

  return <>{props.children}</>;
}

export function useHasPermission(permission: string): boolean {
  const { user } = useAuth();
  return adminCan(user, permission);
}

function satisfiesRequirement(
  user: Parameters<typeof adminCan>[0],
  requirement: PermissionRequirement,
): boolean {
  if (typeof requirement.permission === "string") {
    return (
      Boolean(requirement.permission) && adminCan(user, requirement.permission)
    );
  }
  if (Array.isArray(requirement.allOf)) {
    return requirement.allOf.length > 0 && adminCanAll(user, requirement.allOf);
  }
  if (Array.isArray(requirement.anyOf)) {
    return requirement.anyOf.length > 0 && adminCanAny(user, requirement.anyOf);
  }
  return false;
}

function requirementDescription(requirement: PermissionRequirement): string {
  if (typeof requirement.permission === "string") return requirement.permission;
  if (Array.isArray(requirement.allOf) && requirement.allOf.length) {
    return `all of: ${requirement.allOf.join(", ")}`;
  }
  if (Array.isArray(requirement.anyOf) && requirement.anyOf.length) {
    return `any of: ${requirement.anyOf.join(", ")}`;
  }
  return "a valid permission policy";
}
