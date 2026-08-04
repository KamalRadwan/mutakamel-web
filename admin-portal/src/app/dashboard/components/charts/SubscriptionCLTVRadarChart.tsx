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

export interface RadarDataPoint {
  segment: string;
  cltv: number;
  cac: number;
}

interface Props {
  data: RadarDataPoint[];
  height?: number;
}

export function SubscriptionCLTVRadarChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }} className="flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <PolarAngleAxis
            dataKey="segment"
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-600 dark:text-slate-400"
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 'dataMax']}
            tick={false}
            axisLine={false}
          />
          <Tooltip
            wrapperStyle={{ fontSize: 12, borderRadius: 8 }}
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Radar
            name={lang === "ar" ? "القيمة الدائمة (CLTV)" : "CLTV"}
            dataKey="cltv"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.5}
          />
          <Radar
            name={lang === "ar" ? "تكلفة الاستحواذ (CAC)" : "CAC"}
            dataKey="cac"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
