"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CORE_SETTINGS_NAV_ITEMS } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";

export function useCoreSettingsEntryRedirect(): void {
  const router = useRouter();
  const { user, isLoading } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const isTenantOwner = user?.isTenantOwner === true;
  const featureEntitlements = user?.featureEntitlements;

  const destination =
    CORE_SETTINGS_NAV_ITEMS.find((item) =>
      item.requiresTenantOwner
        ? isTenantOwner
        : item.hasAccess(permissions, isTenantOwner, featureEntitlements),
    )?.href ?? "/unavailable";

  useEffect(() => {
    if (isLoading) return;
    router.replace(destination);
  }, [destination, isLoading, router]);
}
