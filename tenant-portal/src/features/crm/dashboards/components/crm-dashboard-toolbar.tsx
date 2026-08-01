"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Calendar, Filter, RefreshCw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDashboardStore } from "../models/useDashboardStore";

interface CrmDashboardToolbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function CrmDashboardToolbar({ onRefresh, isRefreshing }: CrmDashboardToolbarProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const { editMode } = useDashboardStore();

  return (
    <div className={`p-3.5 border-b dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="gap-2 text-slate-600 dark:text-slate-300 text-xs">
          <Calendar className="w-3.5 h-3.5" />
          {isRtl ? "This month" : "This Month"}
        </Button>
        <Button variant="secondary" className="gap-2 text-slate-600 dark:text-slate-300 text-xs">
          <Filter className="w-3.5 h-3.5" />
          {isRtl ? "Branches filtering" : "Branch Filter"}
        </Button>

        {editMode && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50 flex items-center gap-1.5 animate-pulse">
            <Pencil className="w-3 h-3" />
            {isRtl ? "Panel adjustment mode enabled (drag and resize)" : "Edit Mode Active (Drag & Resize)"}
          </span>
        )}
      </div>

      <div>
        <Button variant="secondary" onClick={onRefresh} disabled={isRefreshing} className="text-slate-600 dark:text-slate-300 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
