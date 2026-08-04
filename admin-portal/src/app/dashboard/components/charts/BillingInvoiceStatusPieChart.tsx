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
          <Tooltip
            formatter={(value) => [
              Number(value ?? 0).toLocaleString(),
              lang === "ar" ? "العدد" : "Count",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tighter">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
          {lang === "ar" ? "إجمالي الفواتير" : "Total Invoices"}
        </span>
      </div>
    </div>
  );
}
