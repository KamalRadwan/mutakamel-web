"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Database,
  Globe2,
  HardDrive,
  LayoutDashboard,
  LineChart,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Tabs, TabsList, TabsTrigger } from "@/design-system";
import type { DashboardGroupKey } from "@/types/dashboard";
import type { DashboardTabKey } from "../hooks/useDashboardData";
import { getDashboardGroupLabel } from "../utils/dashboard-groups";

interface DashboardTabsNavProps {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
  groups: DashboardGroupKey[];
}

// Icons carry meaning through shape, not per-item hue - size-4, currentColor
// only (docs/design-system/shell-and-navigation.md's icon rule). The
// per-tab color map this replaced was one of the largest single sources of
// "14 competing hues" in the app's original census.
const GROUP_ICONS: Record<DashboardGroupKey, LucideIcon> = {
  tenants: Building2,
  domains: Globe2,
  subscriptions: ReceiptText,
  billing: CircleDollarSign,
  payments: CreditCard,
  wallets: WalletCards,
  database: Database,
  storage: HardDrive,
  provisioning: LineChart,
  catalogue: BookOpen,
  notifications: Bell,
  usage: LayoutDashboard,
  security: ShieldCheck,
  audit: ClipboardCheck,
};

export function DashboardTabsNav({
  activeTab,
  onTabChange,
  groups,
}: DashboardTabsNavProps) {
  const { t, lang } = useI18n();
  const tabs: Array<{ key: DashboardTabKey; label: string; icon: LucideIcon }> = [
    { key: "overview", label: t.dashboard.tabs.overview, icon: LayoutDashboard },
    ...groups.map((key) => ({
      key,
      label: getDashboardGroupLabel(key, lang),
      icon: GROUP_ICONS[key],
    })),
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as DashboardTabKey)}
      className="sticky top-[61px] z-10 rounded-lg border border-border bg-card px-2 shadow-xs"
    >
      <TabsList
        className="h-auto w-full justify-start gap-1.5 overflow-x-auto border-b-0 py-2 scrollbar-none"
        aria-label={lang === "ar" ? "مجموعات تقارير لوحة التحكم" : "Dashboard report groups"}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} className="h-9 shrink-0 gap-2 rounded-md px-3 py-1.5 after:hidden data-[state=active]:bg-ink-100 dark:data-[state=active]:bg-ink-800">
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
