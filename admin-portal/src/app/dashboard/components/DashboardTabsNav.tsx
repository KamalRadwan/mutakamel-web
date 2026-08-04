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
import type { DashboardGroupKey } from "@/types/dashboard";
import type { DashboardTabKey } from "../hooks/useDashboardData";
import { getDashboardGroupLabel } from "../utils/dashboard-groups";

interface DashboardTabsNavProps {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
  groups: DashboardGroupKey[];
}

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
    {
      key: "overview",
      label: t.dashboard.tabs.overview,
      icon: LayoutDashboard,
    },
    ...groups.map((key) => ({
      key,
      label: getDashboardGroupLabel(key, lang),
      icon: GROUP_ICONS[key],
    })),
  ];

  return (
    <nav
      className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 px-2 shadow-2xs backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      aria-label={lang === "ar" ? "مجموعات تقارير لوحة التحكم" : "Dashboard report groups"}
    >
      <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
