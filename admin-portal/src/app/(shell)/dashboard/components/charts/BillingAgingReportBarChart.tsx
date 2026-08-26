"use client";

import { Bar, Cell } from "recharts";
import { BaseBarChart } from "./BaseBarChart";

export interface AgingDataPoint {
  bucket: string;
  amount: number;
}

interface Props {
  data: AgingDataPoint[];
  height?: number;
}

export function BillingAgingReportBarChart({ data, height = 280 }: Props) {
  return (
    <BaseBarChart
      data={data}
      height={height}
      yDataKey="bucket"
      xTickFormatter={(val) => `$${val / 1000}k`}
      tooltipValueFormatter={(value) => `$${Number(value ?? 0).toLocaleString()}`}
    >
      <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
        {data.map((entry, index) => {
          let color = "#10b981"; // default green
          if (index === 1) color = "#f59e0b"; // 31-60
          if (index === 2) color = "#f97316"; // 61-90
          if (index >= 3) color = "#ef4444"; // 90+
          return <Cell key={`cell-${index}`} fill={color} />;
        })}
      </Bar>
    </BaseBarChart>
  );
}
