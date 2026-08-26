"use client";

import { Bar, Cell } from "recharts";
import { BaseBarChart } from "./BaseBarChart";

export interface FailureReasonData {
  reason: string;
  count: number;
}

interface Props {
  data: FailureReasonData[];
  height?: number;
}

export function BillingFailureReasonsBarChart({ data, height = 280 }: Props) {
  return (
    <BaseBarChart
      data={data}
      height={height}
      yDataKey="reason"
      yAxisWidth={100}
    >
      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={index === 0 ? "#ef4444" : "#f43f5e"} fillOpacity={1 - (index * 0.15)} />
        ))}
      </Bar>
    </BaseBarChart>
  );
}
