"use client";

import { useEffect } from "react";
import { fetchMyProfile } from "@/app/(tenant)/core/contracts/user-subresource-contract";
import { hydrateAccountTheme } from "@/design-system";
import { hydrateAccountLanguage } from "@/i18n/useLanguage";
import { useTenantAuth } from "../AuthContext";

export function useTenantPreferenceHydration(): void {
  const { user, authState } = useTenantAuth();
  const userId = user?.id;
  const isAuthenticated = authState === "AUTHENTICATED";

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const controller = new AbortController();
    void fetchMyProfile(controller.signal)
      .then((profile) => {
        if (controller.signal.aborted || profile.tenantUserId !== userId) return;
        // Recheck the store after loading: a device choice made in flight wins.
        hydrateAccountLanguage(profile.language);
        hydrateAccountTheme(profile.themeKey);
      })
      .catch(() => {
        // Preferences are optional; keep local rendering and authentication intact.
        // Profile provides the visible error and retry path for this same read.
      });
    return () => controller.abort();
  }, [isAuthenticated, userId]);
}
