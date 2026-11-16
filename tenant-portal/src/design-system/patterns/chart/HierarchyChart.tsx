"use client";
import { ResponsiveContainer, Treemap, type TreemapNode } from "recharts";
import { ChartFrame } from "./chart-common";
export interface HierarchyDatum { [key: string]: unknown; name: string; value: number; id: string; children?: HierarchyDatum[] }
export function HierarchyChart({ data, label, summary, formatValue }: { data: HierarchyDatum[]; label: string; summary: string; formatValue: (value: number) => string }) {
  return <ChartFrame label={label} summary={summary} height={260}>
    <ResponsiveContainer width="100%" height="100%"><Treemap data={data} dataKey="value" nameKey="name" type="flat" nodeGap={2}
      isAnimationActive={false} isUpdateAnimationActive={false} content={(node: TreemapNode) => {
        if (node.children?.length || node.width <= 0 || node.height <= 0) return <g />;
        return <g><title>{`${node.name}: ${formatValue(node.value)}`}</title>
          <rect x={node.x} y={node.y} width={node.width} height={node.height} fill="var(--primary)" fillOpacity={.4 + (node.depth % 3) * .2} stroke="var(--background)" />
          {node.width > 80 && node.height > 40 && <><text x={node.x + node.width / 2} y={node.y + node.height / 2 - 3} textAnchor="middle" fill="var(--foreground)" fontSize={11}>{String(node.name).slice(0, Math.floor(node.width / 8))}</text>
            <text x={node.x + node.width / 2} y={node.y + node.height / 2 + 14} textAnchor="middle" fill="var(--foreground)" fontSize={11}>{formatValue(node.value)}</text></>}
        </g>;
      }} /></ResponsiveContainer>
  </ChartFrame>;
}
