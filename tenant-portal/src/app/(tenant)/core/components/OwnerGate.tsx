"use client";

import { ShieldAlert } from "lucide-react";
import { cn, proseMeasure } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";

/**
 * The in-body 403 for a screen behind `TenantOwnerGuard` (MASTER-PLAN 6.20).
 *
 * Billing and subscription carry **no permission strings** — both controllers
 * are `@UseGuards(TenantGuard, TenantOwnerGuard)` with no `@RequirePermissions`
 * anywhere, so access is `tenant_users.is_tenant_owner` and nothing else. That
 * is why this cannot be `PermissionGate`: there is no permission to name, and a
 * gate that invented one would either lock the owner out or admit everybody.
 *
 * It renders the same surface `PermissionGate` does, and for the same reason —
 * "there is nothing here" and "this is not yours" are different sentences. The
 * copy differs because the remedy differs: no role grant can substitute for
 * ownership, so "ask your admin for the permission" would be false.
 *
 * Advisory only. `TenantOwnerGuard` re-checks the tenant database on every
 * request and is the authority.
 */
export function OwnerGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { user } = useTenantAuth();

  if (user?.isTenantOwner) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <ShieldAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{t.coreBilling.ownerOnlyTitle}</p>
      <p className={cn("text-xs text-muted-foreground", proseMeasure)}>
        {t.coreBilling.ownerOnlyDescription}
      </p>
    </div>
  );
}
