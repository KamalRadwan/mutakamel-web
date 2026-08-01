"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardWidgetResult, CrmDashboardWidget } from "../../models/dashboard-types";
import { formatDashboardValue } from "../../models/dashboard-utils";
import { exportToCSV } from "../../utils/export-utils";
import { Download } from "lucide-react";

interface TableRendererProps {
  widget: CrmDashboardWidget;
  result: DashboardWidgetResult;
}

function getStatusBadge(status?: string, severity?: string) {
  const val = (status || severity || "").toUpperCase();
  if (val === "WON" || val === "SUCCESS") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
  }
  if (val === "NEGOTIATION" || val === "WARNING" || val === "AT_RISK") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]";
  }
  if (val === "CRITICAL" || val === "OFF_TRACK") {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]";
  }
  return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 shadow-[0_0_10px_rgba(148,163,184,0.1)]";
}

export function TableRenderer({ widget, result }: TableRendererProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  if (result.result?.shape !== "ROWS") {
    return <div className="p-4 text-xs text-slate-400">Table data not available</div>;
  }

  const rows = result.result.rows;

  const handleExport = () => {
    exportToCSV(rows, widget.name || "Table Data");
  };

  return (
    <div className="flex flex-col w-full h-full overflow-hidden text-xs">
      <div className="flex justify-end px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Download className="w-3.5 h-3.5" />
          {isRtl ? "تصدير CSV" : "Export CSV"}
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-start text-slate-700 dark:text-slate-300 relative border-collapse">
          <thead className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/90 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 backdrop-blur-md">
            <tr>
              <th className="px-4 py-2.5 text-start font-bold">{isRtl ? "الاسم" : "Name"}</th>
              <th className="px-4 py-2.5 text-start font-bold">{isRtl ? "القيمة" : "Value"}</th>
              <th className="px-4 py-2.5 text-start font-bold">{isRtl ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
            {rows.map((row: any, i) => (
              <tr
                key={row.id || i}
                className="group hover:bg-white dark:hover:bg-slate-800/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,0,0,0.03)] h-12 relative"
              >
                <td className="px-4 py-2 font-bold text-[13px] text-slate-800 dark:text-slate-200 max-w-[180px] sm:max-w-[240px] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {row.label || row.title}
                </td>
                <td
                  className="px-4 py-2 font-extrabold text-[13px] text-slate-700 dark:text-slate-300"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {row.primaryMeasure
                    ? formatDashboardValue(row.primaryMeasure.value, { compact: true })
                    : row.amount ?? row.reasonCode ?? "-"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md uppercase tracking-wider ${getStatusBadge(
                      row.status,
                      row.severity
                    )}`}
                  >
                    {row.status || row.severity || "Active"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
