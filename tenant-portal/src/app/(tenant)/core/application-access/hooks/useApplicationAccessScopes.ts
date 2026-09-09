"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { applicationAccessSchemas } from "../application-access-contract";

export function useApplicationAccessScopes() {
  const { user, isAuthenticated } = useTenantAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.some((permission) =>
    permission === "applications.activation.read" || permission === "applications.activation.manage"));
  const companies = [...new Set(user?.accessibleCompanies ?? [])].filter((id) => applicationAccessSchemas.uuid.safeParse(id).success);
  const branches = [...new Set(user?.accessibleBranches ?? [])].filter((id) => applicationAccessSchemas.uuid.safeParse(id).success);
  const open = useCallback((value: string) => {
    if (!allowed) return;
    const [scope, id, extra] = value.split(":");
    if (extra !== undefined || !applicationAccessSchemas.uuid.safeParse(id).success
      || (scope === "companies" ? !user?.accessibleCompanies.includes(id) : scope === "branches" ? !user?.accessibleBranches.includes(id) : true)) return;
    startTransition(() => router.push(`/core/application-access/${scope}/${id}`));
  }, [allowed, router, user]);
  return { t, allowed, companies, branches, open, pending };
}
