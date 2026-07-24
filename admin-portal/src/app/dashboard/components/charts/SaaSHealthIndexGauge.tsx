"use client";

import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

interface SaaSHealthIndexGaugeProps {
  score?: number; // 0..100
  height?: number;
}

export function SaaSHealthIndexGauge({
  score = 92,
  height = 180,
}: SaaSHealthIndexGaugeProps) {
  const { lang } = useI18n();
  const safeScore = Math.min(100, Math.max(0, score));

  const data = [
    { name: "Score", value: safeScore },
    { name: "Remaining", value: 100 - safeScore },
  ];

  const getColor = (s: number) => {
    if (s >= 85) return "#10b981"; // Emerald
    if (s >= 70) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const scoreColor = getColor(safeScore);

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
            <Cell key="cell-0" fill={scoreColor} />
            <Cell key="cell-1" fill="#334155" opacity={0.2} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute bottom-4 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-extrabold font-mono tracking-tight" style={{ color: scoreColor }}>
          {safeScore.toFixed(0)}/100
        </span>
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          {lang === "ar" ? "مؤشر صحة المنصة الإجمالي" : "SaaS Platform Health Index"}
        </span>
      </div>
    </div>
  );
}
