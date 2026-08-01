"use client";

import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export interface CostBreakdownData {
  [key: string]: string | number | undefined;
  name: string;
  size: number;
  fill?: string;
}

interface Props {
  data: CostBreakdownData[];
  height?: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

interface CostTreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
}

const CostTreemapContent = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = "",
  fill = "#64748b",
}: CostTreemapContentProps) => (
  <g>
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      style={{
        fill,
        stroke: "#fff",
        strokeWidth: 2,
        strokeOpacity: 0.2,
      }}
    />
    {width > 50 && height > 30 && (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        fill="#fff"
        fontSize={12}
        fontWeight="bold"
      >
        {name}
      </text>
    )}
  </g>
);

export function BillingCostBreakdownTreemap({ data, height = 280 }: Props) {
  const formattedData = data.map((d, i) => ({
    ...d,
    fill: d.fill || COLORS[i % COLORS.length]
  }));

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={formattedData}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill="#8884d8"
          content={<CostTreemapContent />}
        >
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(value) =>
                  `$${Number(value ?? 0).toLocaleString()}`
                }
              />
            }
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
