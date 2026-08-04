"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export interface PromoDataPoint {
  discountPercent: number;
  retentionMonths: number;
  subscribers: number;
}

interface Props {
  data: PromoDataPoint[];
  height?: number;
}

export function SubscriptionPromoImpactScatter({ data, height = 280 }: Props) {
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis
            type="number"
            dataKey="discountPercent"
            name="Discount"
            unit="%"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis
            type="number"
            dataKey="retentionMonths"
            name="Retention"
            unit="m"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "currentColor", fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <ZAxis type="number" dataKey="subscribers" range={[50, 400]} name="Subscribers" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={<ChartTooltip />}
          />
          <Scatter name="Promo Impact" data={data} fill="#3b82f6" fillOpacity={0.6}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.discountPercent > 20 ? "#f59e0b" : "#3b82f6"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
