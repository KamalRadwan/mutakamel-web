"use client";

import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";

export interface RevenueRadarDataPoint {
  product: string;
  revenue: number;
}

interface Props {
  data: RevenueRadarDataPoint[];
  height?: number;
}

export function BillingRevenueByProductRadar({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }} className="flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <PolarAngleAxis 
            dataKey="product" 
            tick={{ fill: "currentColor", fontSize: 11 }} 
            className="text-slate-600 dark:text-slate-400"
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 'dataMax']} 
            tick={false} 
            axisLine={false} 
          />
          <Tooltip 
            wrapperStyle={{ fontSize: 12, borderRadius: 8 }}
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, lang === "ar" ? "الإيرادات" : "Revenue"]}
          />
          <Radar 
            name={lang === "ar" ? "الإيرادات" : "Revenue"} 
            dataKey="revenue" 
            stroke="#10b981" 
            fill="#10b981" 
            fillOpacity={0.6} 
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
