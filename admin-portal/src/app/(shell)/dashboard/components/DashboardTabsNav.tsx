"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  CircleDollarSign,
  Database,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Tabs, TabsList, TabsTrigger } from "@/design-system";
import type {
  DashboardSubjectKey,
  DashboardTabKey,
} from "../utils/dashboard-subjects";

interface DashboardTabsNavProps {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
  /** Subjects holding at least one report this actor may see. */
  subjects: DashboardSubjectKey[];
}

// Icons carry meaning through shape, not per-item hue - size-4, currentColor
// only (docs/design-system/shell-and-navigation.md's icon rule). The
// per-tab color map this replaced was one of the largest single sources of
// "14 competing hues" in the app's original census.
const SUBJECT_ICONS: Record<DashboardSubjectKey, LucideIcon> = {
  tenants: Building2,
  revenue: CircleDollarSign,
  infrastructure: Database,
  platform: BookOpen,
  trust: ShieldCheck,
};

export function DashboardTabsNav({
  activeTab,
  onTabChange,
  subjects,
}: DashboardTabsNavProps) {
  const { t } = useI18n();
  const tabs: Array<{ key: DashboardTabKey; label: string; icon: LucideIcon }> = [
    { key: "overview", label: t.dashboard.tabs.overview, icon: LayoutDashboard },
    ...subjects.map((key) => ({
      key,
      label: t.dashboard.subjects[key],
      icon: SUBJECT_ICONS[key],
    })),
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as DashboardTabKey)}
      className="sticky top-[61px] z-10 rounded-lg border border-border bg-card px-2"
    >
      <TabsList
        className="h-auto w-full flex-wrap justify-start gap-1.5 border-b-0 py-2"
        aria-label={t.dashboard.groupsAriaLabel}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} className="h-9 shrink-0 gap-2 rounded-md px-3 py-1.5 after:hidden data-[state=active]:bg-selected">
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
