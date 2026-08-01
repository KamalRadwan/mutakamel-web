"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FolderGit2, 
  UserCircle, 
  Kanban, 
  History, 
  Database, 
  Settings, 
  ChevronDown,
  GitCommit,
  Share2,
  Sliders,
  Layout,
  Code,
  Code2,
  FileText
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function CrmNavbarLinks() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mainNavItems = [
    { label: t.nav.crmDashboard || "Dashboard", href: "/crm/dashboard", icon: LayoutDashboard, color: "text-blue-500" },
    { label: t.nav.leads || "Leads", href: "/crm/leads", icon: FolderGit2, color: "text-amber-500" },
    { label: t.nav.customerProfiles || "Customers", href: "/crm/customer-profiles", icon: UserCircle, color: "text-emerald-500" },
    { label: t.nav.salesPipelineWorkspace || "Pipeline", href: "/crm/pipeline", icon: Kanban, color: "text-purple-500" },
    { label: t.nav.opportunitiesHistory || "Stage History", href: "/crm/opportunities-stage-history", icon: History, color: "text-cyan-500" },
    { label: t.nav.staticData || "Catalogue", href: "/crm/static-data-catalogue", icon: Database, color: "text-teal-500" },
  ];

  const settingsSubItems = [
    { label: t.nav.pipelines || "Pipeline Stages", href: "/crm/pipelines-boards-opportunity-stages", icon: Kanban, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/50" },
    { label: t.nav.leadStages || "Lead Stages", href: "/crm/lead-stages", icon: GitCommit, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/50" },
    { label: t.nav.acquisitionSources || "Acquisition Sources", href: "/crm/acquisition-sources", icon: Share2, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50" },
    { label: t.nav.customFields || "Custom Fields", href: "/crm/custom-fields", icon: Sliders, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/50" },
    { label: t.nav.crmDashboardBuilder || "Dashboard Builder", href: "/crm/dashboard-builder-widgets", icon: Layout, color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/50" },
    { label: t.nav.presetDashboards || "Preset Dashboards", href: "/crm/preset-dashboards", icon: LayoutDashboard, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" },
    { label: t.nav.browserContracts || "Common Browser Contracts", href: "/crm/common-browser-contract", icon: Code2, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/50" },
    { label: t.nav.browserExamples || "Browser Examples", href: "/crm/browser-examples", icon: Code, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/50" },
    { label: t.nav.apiDocs || "API Documentation", href: "/crm/api-documentation", icon: FileText, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/50" },
    { label: t.nav.crmSettings || "CRM Settings", href: "/crm/settings", icon: Settings, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  ];

  const isSettingsActive = settingsSubItems.some((sub) => pathname.startsWith(sub.href));

  return (
    <nav className="flex items-center gap-1">
      {mainNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/crm/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-600 dark:text-blue-400" : item.color}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* CRM Settings Dropdown */}
      <div className="relative" ref={settingsRef}>
        <button
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            isSettingsActive
              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-rose-500" />
          <span>{t.nav.crmSettings || "CRM Settings"}</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isSettingsOpen ? "rotate-180" : ""}`} />
        </button>

        {isSettingsOpen && (
          <div className="absolute top-full mt-1.5 start-0 z-50 w-60 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t.nav.crmSettings || "CRM Settings"}
            </div>
            {settingsSubItems.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = pathname === sub.href;
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => setIsSettingsOpen(false)}
                  className={`flex items-center gap-2.5 p-1.5 rounded-xl text-xs transition-colors ${
                    isSubActive
                      ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                  }`}
                >
                  <div className={`p-1 rounded-lg shrink-0 ${sub.color}`}>
                    <SubIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
