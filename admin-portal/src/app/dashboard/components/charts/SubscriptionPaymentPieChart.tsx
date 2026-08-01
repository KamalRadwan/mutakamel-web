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
          <Tooltip
            formatter={(value) => [
              Number(value ?? 0).toLocaleString(),
              lang === "ar" ? "العدد" : "Count",
            ]}
          />
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
