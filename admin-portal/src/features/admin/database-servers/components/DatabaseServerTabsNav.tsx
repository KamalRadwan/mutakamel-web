import { LayoutDashboard, ShieldCheck, Database, Lock, History } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { DatabaseServerTab } from "../hooks/useDatabaseServerDetailPage";

interface DatabaseServerTabsNavProps {
  activeTab: DatabaseServerTab;
  onTabChange: (tab: DatabaseServerTab) => void;
  bindingsCount: number;
  historyCount: number;
  bootstrapStatus: string;
}

export function DatabaseServerTabsNav({
  activeTab,
  onTabChange,
  bindingsCount,
  historyCount,
  bootstrapStatus,
}: DatabaseServerTabsNavProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.tabs;

  const tabs: {
    id: DatabaseServerTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: "overview",
      label: d.overview,
      icon: LayoutDashboard,
    },
    {
      id: "readiness",
      label: d.readiness,
      icon: ShieldCheck,
      badge: bootstrapStatus,
      badgeColor:
        bootstrapStatus === "READY"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : bootstrapStatus === "DEGRADED"
            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    {
      id: "bindings",
      label: d.bindings,
      icon: Database,
      badge: bindingsCount,
      badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    {
      id: "security",
      label: d.security,
      icon: Lock,
    },
    {
      id: "history",
      label: d.history,
      icon: History,
      badge: historyCount,
      badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Database Server Details Tabs"
      className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-200/60 dark:bg-slate-850 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner no-scrollbar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              isActive
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-slate-200/80 dark:border-slate-700 scale-[1.01]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/40"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                  tab.badgeColor || "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
