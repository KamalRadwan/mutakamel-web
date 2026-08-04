"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

export interface TaxDataPoint {
  region: string;
  amount: number;
  color: string;
}

interface Props {
  data: TaxDataPoint[];
  height?: number;
}

export function BillingTaxDistributionPie({ data, height = 250 }: Props) {
  const { lang } = useI18n();
  const total = data.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div style={{ height, width: "100%" }} className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="amount"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              `$${Number(value ?? 0).toLocaleString()}`,
              lang === "ar" ? "الضريبة" : "Tax",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tighter">
          ${(total / 1000).toFixed(1)}k
        </span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mt-1">
          {lang === "ar" ? "إجمالي الضرائب" : "Total Tax"}
        </span>
      </div>
    </div>
  );
}
