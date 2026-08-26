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

const TAB_COLOR_CLASSES: Record<DashboardTabKey, string> = {
  overview: "text-indigo-500 dark:text-indigo-400",
  tenants: "text-cyan-500 dark:text-cyan-400",
  domains: "text-sky-500 dark:text-sky-400",
  subscriptions: "text-emerald-500 dark:text-emerald-400",
  billing: "text-emerald-600 dark:text-emerald-400",
  payments: "text-teal-500 dark:text-teal-400",
  wallets: "text-amber-500 dark:text-amber-400",
  database: "text-blue-500 dark:text-blue-400",
  storage: "text-purple-500 dark:text-purple-400",
  provisioning: "text-blue-400 dark:text-blue-300",
  catalogue: "text-purple-400 dark:text-purple-300",
  notifications: "text-amber-400 dark:text-amber-300",
  usage: "text-indigo-400 dark:text-indigo-300",
  security: "text-rose-500 dark:text-rose-400",
  audit: "text-violet-500 dark:text-violet-400",
};

export function DashboardTabsNav({
  activeTab,
  onTabChange,
  groups,
}: DashboardTabsNavProps) {
  const { t, lang } = useI18n();
  const tabs: Array<{ key: DashboardTabKey; label: string; icon: LucideIcon; color: string }> = [
    {
      key: "overview",
      label: t.dashboard.tabs.overview,
      icon: LayoutDashboard,
      color: TAB_COLOR_CLASSES.overview,
    },
    ...groups.map((key) => ({
      key,
      label: getDashboardGroupLabel(key, lang),
      icon: GROUP_ICONS[key],
      color: TAB_COLOR_CLASSES[key] || "text-blue-500",
    })),
  ];

  return (
    <nav
      className="sticky top-[61px] z-10 rounded-2xl border border-slate-200 bg-white/95 px-2 shadow-xs backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      aria-label={lang === "ar" ? "مجموعات تقارير لوحة التحكم" : "Dashboard report groups"}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <Icon
                className={`size-4 ${isActive ? "text-white" : tab.color} transition-colors`}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
