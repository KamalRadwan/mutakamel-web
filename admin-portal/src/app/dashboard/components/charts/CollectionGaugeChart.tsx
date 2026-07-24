"use client";

import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

interface CollectionGaugeChartProps {
  collectedRatio: number; // 0..1
  height?: number;
}

export function CollectionGaugeChart({
  collectedRatio,
  height = 180,
}: CollectionGaugeChartProps) {
  const { t } = useI18n();
  const percentage = Math.min(100, Math.max(0, collectedRatio * 100));

  const data = [
    { name: "المحصل", value: percentage, color: "#10b981" },
    { name: "المتبقي", value: 100 - percentage, color: "#334155" },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Pie
            data={data}
            cx="50%"
            cy="75%"
            startAngle={180}
            endAngle={0}
            innerRadius={65}
            outerRadius={90}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="cell-0" fill="#10b981" />
            <Cell key="cell-1" fill="#334155" opacity={0.2} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute bottom-4 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
          {percentage.toFixed(1)}%
        </span>
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {t.dashboard.billingTab.actualCollectedRatio}
        </span>
      </div>
    </div>
  );
}
