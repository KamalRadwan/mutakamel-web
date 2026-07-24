"use client";

import { useI18n } from "@/i18n/I18nContext";
import { DashboardTabKey } from "../hooks/useDashboardData";

import { Layout, Building, Server, CreditCard, Calendar } from "lucide-react";

interface DashboardTabsNavProps {
  activeTab: DashboardTabKey;
  onTabChange: (tab: DashboardTabKey) => void;
  sections?: Array<{ key: string; title: string }>;
}

export function DashboardTabsNav({ activeTab, onTabChange, sections = [] }: DashboardTabsNavProps) {
  const { t, lang } = useI18n();

  const sectionLabelMap: Record<string, string> = {
    overview: t.dashboard.tabs.overview,
    tenants: t.dashboard.tabs.tenants,
    databaseServers: t.dashboard.tabs.servers,
    servers: t.dashboard.tabs.servers,
    subscriptions: t.dashboard.tabs.subscriptions || (lang === "ar" ? "الاشتراكات" : "Subscriptions"),
    invoices: t.dashboard.tabs.billing || (lang === "ar" ? "الفواتير" : "Billing"),
  };

  const fallbackArMap: Record<string, string> = {
    Tenants: "المستأجرين",
    "Database Server": "سيرفرات قواعد البيانات",
    "Database Servers": "سيرفرات قواعد البيانات",
    Subscriptions: "الاشتراكات",
    Invoices: "الفواتير",
  };

  const IconMap: Record<string, any> = {
    overview: Layout,
    tenants: Building,
    databaseServers: Server,
    servers: Server,
    subscriptions: Calendar,
    invoices: CreditCard,
  };

  const IconColorMap: Record<string, string> = {
    overview: "text-blue-500 dark:text-blue-400",
    tenants: "text-indigo-500 dark:text-indigo-400",
    databaseServers: "text-emerald-500 dark:text-emerald-400",
    servers: "text-emerald-500 dark:text-emerald-400",
    subscriptions: "text-purple-500 dark:text-purple-400",
    invoices: "text-amber-500 dark:text-amber-400",
  };

  const tabs: Array<{ key: DashboardTabKey; label: string; icon: any; color: string }> = [
    { key: "overview", label: t.dashboard.tabs.overview || "نظرة عامة", icon: Layout, color: IconColorMap["overview"] },
    ...sections.map((sec) => {
      let label = sectionLabelMap[sec.key];
      if (!label && lang === "ar") {
        label = fallbackArMap[sec.title] || sec.title;
      }
      return { 
        key: sec.key, 
        label: label || sec.title, 
        icon: IconMap[sec.key] || Layout, 
        color: IconColorMap[sec.key] || "text-slate-500" 
      };
    }),
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto pb-px scrollbar-none px-2 sm:px-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-3.5 text-[13px] font-bold rounded-t-xl transition-all cursor-pointer whitespace-nowrap border-b-2 flex flex-col sm:flex-row items-center gap-2 ${
                isActive
                  ? "border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
              }`}
            >
              {Icon && (
                <div className={`rounded-md ${isActive ? "bg-white dark:bg-slate-800 shadow-sm p-1" : "bg-transparent"} ${tab.color}`}>
                  <Icon className="w-5 h-5 sm:w-4 sm:h-4 mb-1 sm:mb-0" strokeWidth={isActive ? 2.5 : 2} />
                </div>
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

