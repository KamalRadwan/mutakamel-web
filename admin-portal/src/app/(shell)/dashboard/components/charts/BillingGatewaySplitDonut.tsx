"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

export interface GatewayDataPoint {
  gateway: string;
  volume: number;
  color: string;
}

interface Props {
  data: GatewayDataPoint[];
  height?: number;
}

export function BillingGatewaySplitDonut({ data, height = 250 }: Props) {
  const { lang } = useI18n();
  const total = data.reduce((acc, curr) => acc + curr.volume, 0);

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
            dataKey="volume"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              Number(value ?? 0).toLocaleString(),
              lang === "ar" ? "العمليات" : "Transactions",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 font-mono tracking-tighter">
          {total.toLocaleString()}
        </span>
        <span className="text-2xs uppercase font-semibold tracking-wider text-slate-500 mt-1">
          {lang === "ar" ? "إجمالي العمليات" : "Transactions"}
        </span>
      </div>
    </div>
  );
}
