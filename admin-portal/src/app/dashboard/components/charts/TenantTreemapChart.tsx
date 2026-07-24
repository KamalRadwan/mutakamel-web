"use client";

import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export interface TreemapNode {
  name: string;
  size: number;
  color: string;
}

interface TenantTreemapChartProps {
  data?: TreemapNode[];
  height?: number;
}

const defaultTreemapData: TreemapNode[] = [
  { name: "نشط (Active)", size: 38, color: "#10b981" },
  { name: "معلق (Suspended)", size: 4, color: "#f59e0b" },
  { name: "تجهيز (Provisioning)", size: 2, color: "#3b82f6" },
  { name: "فشل (Failed)", size: 1, color: "#ef4444" },
];

const CustomizedContent = (props: any) => {
  const { x, y, width, height, name, color } = props;
  if (width < 25 || height < 15) return null;

  return (
    <g>
      <rect
        x={x + 2}
        y={y + 2}
        width={Math.max(0, width - 4)}
        height={Math.max(0, height - 4)}
        style={{
          fill: color || "#3b82f6",
          stroke: "rgba(255, 255, 255, 0.4)",
          strokeWidth: 1.5,
          rx: 8,
          ry: 8,
        }}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={11}
        fontWeight="bold"
      >
        {name}
      </text>
    </g>
  );
};

export function TenantTreemapChart({
  data = defaultTreemapData,
  height = 200,
}: TenantTreemapChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          stroke="#090d16"
          content={<CustomizedContent />}
        >
          <Tooltip content={<ChartTooltip valueFormatter={(val) => `${val} شركة`} />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
