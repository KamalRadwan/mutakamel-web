"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Calendar, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CrmDashboardToolbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function CrmDashboardToolbar({ onRefresh, isRefreshing }: CrmDashboardToolbarProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  return (
    <div className={`p-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="gap-2 text-slate-600 dark:text-slate-300">
          <Calendar className="w-4 h-4" />
          {isRtl ? "هذا الشهر" : "This Month"}
        </Button>
        <Button variant="secondary" className="gap-2 text-slate-600 dark:text-slate-300">
          <Filter className="w-4 h-4" />
          {isRtl ? "تصفية الفروع" : "Branch Filter"}
        </Button>
      </div>
      <div>
        <Button variant="secondary" onClick={onRefresh} disabled={isRefreshing} className="text-slate-600 dark:text-slate-300">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
