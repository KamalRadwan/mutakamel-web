"use client";

import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { useI18n } from "@/i18n/I18nContext";

export interface CostBreakdownData {
  name: string;
  size: number;
  fill?: string;
}

interface Props {
  data: CostBreakdownData[];
  height?: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

export function BillingCostBreakdownTreemap({ data, height = 280 }: Props) {
  const { lang } = useI18n();

  const formattedData = data.map((d, i) => ({
    ...d,
    fill: d.fill || COLORS[i % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-lg text-xs">
          <p className="font-bold mb-1 text-slate-800 dark:text-slate-200">{data.name}</p>
          <p className="text-slate-600 dark:text-slate-400">
            {lang === "ar" ? "التكلفة" : "Cost"}: <span className="font-mono font-bold">${data.size.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomizedContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, size } = props;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: props.fill,
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
  };

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={formattedData}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill="#8884d8"
          content={<CustomizedContent />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
