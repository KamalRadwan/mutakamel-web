"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Filter, Search } from "lucide-react";
import type { CrmDashboard } from "../models/dashboard-types";
import { useDashboardStore } from "../models/useDashboardStore";

interface DashboardFiltersProps {
  dashboard: CrmDashboard;
}

export function DashboardFilters({ dashboard }: DashboardFiltersProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const { filters, setFilters } = useDashboardStore();

  // If no default filters are defined, we don't show the filter bar.
  if (!dashboard.defaultFilters || Object.keys(dashboard.defaultFilters).length === 0) {
    return null;
  }

  return (
    <div className={`w-full p-4 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-wrap items-center gap-4 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <Filter className="w-4 h-4" />
        {isRtl ? "التصنيفات:" : "Filters:"}
      </div>

      {Object.entries(dashboard.defaultFilters).map(([key, filterSpec]: [string, any]) => (
        <div key={key} className="flex items-center gap-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg px-3 py-1.5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium">
            {filterSpec.label || key}:
          </span>
          {filterSpec.type === "SELECT" ? (
            <select 
              className="text-sm border-none bg-transparent focus:ring-0 cursor-pointer p-0 font-medium text-gray-900 dark:text-gray-100"
              value={filters[key] || ""}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            >
              <option value="">{isRtl ? "الكل" : "All"}</option>
              {filterSpec.options?.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : filterSpec.type === "SEARCH" ? (
            <div className="flex items-center gap-1">
              <Search className="w-3 h-3 text-gray-400" />
              <input 
                type="text" 
                className="text-sm border-none bg-transparent focus:ring-0 p-0 w-24 placeholder-gray-400 font-medium text-gray-900 dark:text-gray-100"
                placeholder={isRtl ? "بحث..." : "Search..."}
                value={filters[key] || ""}
                onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
              />
            </div>
          ) : null}
        </div>
      ))}
      
      {Object.keys(filters).length > 0 && (
        <button 
          onClick={() => setFilters({})}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {isRtl ? "مسح التصنيفات" : "Clear filters"}
        </button>
      )}
    </div>
  );
}
