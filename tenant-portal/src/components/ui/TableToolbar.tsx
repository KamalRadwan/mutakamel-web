"use client";

import { Search, Filter, Download } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExport?: () => void;
  onFilter?: () => void;
  placeholder?: string;
}

export function TableToolbar({
  searchQuery,
  onSearchChange,
  onExport,
  onFilter,
  placeholder,
}: TableToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
      <div className="relative w-full sm:w-72">
        <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder || t.common.search}
          className="w-full ps-9 pe-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {onFilter && (
          <button
            onClick={onFilter}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{t.common.filter}</span>
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.common.export}</span>
          </button>
        )}
      </div>
    </div>
  );
}
