"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { ChevronDown, Plus, LayoutDashboard, Check, Sparkles } from "lucide-react";
import type { CrmDashboard } from "../models/dashboard-types";

interface CrmDashboardNavbarProps {
  activeDashboard?: CrmDashboard;
  availableDashboards?: CrmDashboard[];
  onSelectDashboard?: (id: string) => void;
  onNewDashboardClick?: () => void;
}

export function CrmDashboardNavbar({
  activeDashboard,
  availableDashboards = [],
  onSelectDashboard,
  onNewDashboardClick,
}: CrmDashboardNavbarProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeTitle = activeDashboard?.name || (isRtl ? "لوحة التحليلات الشاملة" : "Mega CRM Analytics");

  return (
    <div
      className={`h-14 border-b dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between px-4 z-20 ${
        isRtl ? "rtl" : "ltr"
      }`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-4 relative" ref={menuRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 py-1.5 px-3 rounded-lg transition-all border dark:border-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 max-w-[280px] sm:max-w-[400px] truncate">
            {activeTitle}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div
            className={`absolute top-full mt-1.5 ${
              isRtl ? "right-0" : "left-0"
            } w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150`}
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isRtl ? "اختر لوحة المؤشرات" : "Select Dashboard"}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                {isRtl ? "لوحة وهمية متكاملة" : "Full Demo"}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto py-1">
              {availableDashboards.map((dash) => {
                const isSelected = activeDashboard?.id === dash.id;
                const widgetCount = dash.placements?.length || 0;
                return (
                  <button
                    key={dash.id}
                    onClick={() => {
                      onSelectDashboard?.(dash.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-start px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                      isSelected ? "bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 me-2">
                      <span className="text-sm font-medium truncate">{dash.name}</span>
                      {dash.description && (
                        <span className="text-xs text-slate-400 truncate">{dash.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {widgetCount} {isRtl ? "ودجت" : "widgets"}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <button
          onClick={onNewDashboardClick}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
        >
          <Plus className="w-3.5 h-3.5" />
          {isRtl ? "لوحة جديدة" : "New Dashboard"}
        </button>
      </div>
    </div>
  );
}
