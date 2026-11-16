"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { isCrmAnalyticsPath, isCrmSettingsPath } from "./crm-settings-navigation";
import type { NavSection } from "./nav-config";

export function useCrmSettingsNavigation(sections: NavSection[]) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState({ pathname, open: false });
  if (sheet.pathname !== pathname) setSheet({ pathname, open: false });
  return {
    isSettings: isCrmSettingsPath(pathname),
    isAnalytics: isCrmAnalyticsPath(pathname),
    section: sections.find((section) => section.id === "crmSetup"),
    open: sheet.pathname === pathname && sheet.open,
    onOpenChange: (open: boolean) => setSheet({ pathname, open }),
  };
}
