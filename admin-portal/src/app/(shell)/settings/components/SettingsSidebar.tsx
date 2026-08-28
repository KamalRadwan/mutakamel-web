"use client";

import { Settings } from "lucide-react";
import { SubNav, SETTINGS_SUBNAV } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function SettingsSidebar() {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Settings className="h-4.5 w-4.5 text-muted-foreground" aria-hidden="true" />
        {t.settings.pageTitle}
      </h2>
      <SubNav
        items={SETTINGS_SUBNAV.map((item) => ({ href: item.href, labelKey: item.labelKey }))}
        ariaLabel={t.settings.pageTitle}
      />
    </div>
  );
}
