"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/i18n/I18nContext";

export interface ForecastDataPoint {
  month: string;
  actual?: number;
  forecast?: number;
}

interface Props {
  data: ForecastDataPoint[];
  height?: number;
}

export function BillingForecastSplineChart({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "currentColor", fontSize: 11 }}
            tickFormatter={(val) => `$${val/1000}k`}
            className="text-slate-500 dark:text-slate-400"
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }} />

          <ReferenceLine x="Today" stroke="#94a3b8" strokeDasharray="3 3" />

          <Area
            type="monotone"
            dataKey="actual"
            name={lang === "ar" ? "الإيرادات الفعلية" : "Actual Revenue"}
            stroke="#10b981"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorActual)"
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name={lang === "ar" ? "الإيرادات المتوقعة" : "Forecast"}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorForecast)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
