"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

interface Props {
  paid: number;
  outstanding: number;
  overdue: number;
  height?: number;
}

export function BillingInvoiceStatusPieChart({ paid, outstanding, overdue, height = 250 }: Props) {
  const { lang } = useI18n();

  const data = [
    { name: lang === "ar" ? "مدفوعة" : "Paid", value: paid, color: "#10b981" },
    { name: lang === "ar" ? "معلقة" : "Outstanding", value: outstanding, color: "#3b82f6" },
    { name: lang === "ar" ? "متأخرة" : "Overdue", value: overdue, color: "#ef4444" },
  ];

  const total = paid + outstanding + overdue;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const ratio = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-lg text-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
            <p className="font-bold text-slate-800 dark:text-slate-200">{data.name}</p>
          </div>
          <p className="text-slate-600 dark:text-slate-400 pl-4">
            Total: <span className="font-mono font-bold">${data.value.toLocaleString()}</span> ({ratio}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height, width: "100%" }} className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="85%"
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tighter">
          ${(total / 1000).toFixed(1)}k
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
          {lang === "ar" ? "إجمالي الفواتير" : "Total Invoiced"}
        </span>
      </div>
    </div>
  );
}
