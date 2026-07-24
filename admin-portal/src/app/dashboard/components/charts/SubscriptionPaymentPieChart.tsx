"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

interface Props {
  success: number;
  failed: number;
  recovered: number;
  height?: number;
}

export function SubscriptionPaymentPieChart({ success, failed, recovered, height = 250 }: Props) {
  const { lang } = useI18n();

  const data = [
    { name: lang === "ar" ? "مدفوعات ناجحة" : "Successful Payments", value: success, color: "#10b981" },
    { name: lang === "ar" ? "مدفوعات فاشلة" : "Failed Payments", value: failed, color: "#ef4444" },
    { name: lang === "ar" ? "تم استردادها" : "Recovered (Retries)", value: recovered, color: "#f59e0b" },
  ];

  const total = success + failed + recovered;

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
            Count: <span className="font-mono font-bold">{data.value}</span> ({ratio}%)
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
            innerRadius="60%"
            outerRadius="80%"
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
        <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter">
          {((success / (total || 1)) * 100).toFixed(1)}%
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
          {lang === "ar" ? "معدل النجاح" : "Success Rate"}
        </span>
      </div>
    </div>
  );
}
