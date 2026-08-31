"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { permittedCoreSettingsRoutes, TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export interface SettingsHubSection {
  href: string;
  title: string;
  description: string;
}

/**
 * The hub lists only the sections the caller may actually open, using the same
 * predicate the sidebar and `SubNav` apply — a card that leads straight to a
 * `PermissionGate` is worse than no card.
 */
export function useSettingsHub() {
  const { t } = useI18n();
  const { user } = useTenantAuth();

  const sections = useMemo<SettingsHubSection[]>(() => {
    const copy: Record<string, { title: string; description: string }> = {
      [TENANT_ROUTES.coreSettingsWorkspace]: {
        title: t.coreSettings.workspaceTitle,
        description: t.coreSettings.workspaceSubtitle,
      },
      [TENANT_ROUTES.coreSettingsCurrencies]: {
        title: t.coreSettings.currenciesTitle,
        description: t.coreSettings.currenciesSubtitle,
      },
      [TENANT_ROUTES.coreSettingsTaxes]: {
        title: t.coreSettings.taxesTitle,
        description: t.coreSettings.taxesSubtitle,
      },
      [TENANT_ROUTES.coreSettingsNumbering]: {
        title: t.coreSettings.numberingTitle,
        description: t.coreSettings.numberingSubtitle,
      },
      [TENANT_ROUTES.coreSettingsEmail]: {
        title: t.coreSettings.emailTitle,
        description: t.coreSettings.emailSubtitle,
      },
      [TENANT_ROUTES.coreSettingsBranding]: {
        title: t.coreBilling.brandingTitle,
        description: t.coreBilling.brandingSubtitle,
      },
    };

    return permittedCoreSettingsRoutes(user?.permissions ?? []).flatMap((href) => {
      const entry = copy[href];
      return entry ? [{ href, ...entry }] : [];
    });
  }, [t, user]);

  return { t, sections };
}
