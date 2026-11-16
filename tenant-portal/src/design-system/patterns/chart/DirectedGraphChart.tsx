"use client";
import { useId } from "react";
import { ChartFrame } from "./chart-common";
export interface DirectedGraphNode { id: string; label: string }
export interface DirectedGraphEdge { key: string; source: string; target: string; value: number }
/** A bounded directed network supports return transitions and self-loops; no acyclic Sankey assumption. */
export function DirectedGraphChart({ nodes, edges, label, summary, formatValue }: { nodes: DirectedGraphNode[]; edges: DirectedGraphEdge[]; label: string; summary: string; formatValue: (value: number) => string }) {
  const marker = useId().replaceAll(":", ""); const width = Math.max(640, nodes.length * 70); const height = Math.max(380, nodes.length * 30);
  const positions = new Map(nodes.map((node, index) => { const angle = index / Math.max(1, nodes.length) * Math.PI * 2 - Math.PI / 2; return [node.id, { x: width / 2 + Math.cos(angle) * (width / 2 - 100), y: height / 2 + Math.sin(angle) * (height / 2 - 80) }]; }));
  const max = Math.max(1, ...edges.map((edge) => edge.value));
  return <ChartFrame label={label} summary={summary} height={Math.min(420, height + 8)}><div className="h-full overflow-auto" dir="ltr"><svg width={width} height={height} aria-hidden="true">
    <defs><marker id={marker} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8" fill="var(--chart-axis)" /></marker></defs>
    {edges.map((edge) => { const a = positions.get(edge.source); const b = positions.get(edge.target); if (!a || !b) return null;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const intersection = 1 / Math.max(Math.abs(dx) / 60, Math.abs(dy) / 20, 1e-9);
      const x1 = a.x + dx * intersection; const y1 = a.y + dy * intersection; const x2 = b.x - dx * intersection; const y2 = b.y - dy * intersection;
      const d = edge.source === edge.target ? `M${a.x - 20},${a.y - 19} C${a.x - 70},${a.y - 65} ${a.x + 70},${a.y - 65} ${a.x + 20},${a.y - 19}` : `M${x1},${y1} Q${(a.x + b.x) / 2 - dy * .14},${(a.y + b.y) / 2 + dx * .14} ${x2},${y2}`;
      return <path key={edge.key} data-edge={edge.key} d={d} fill="none" stroke="var(--chart-axis)" strokeWidth={1 + Math.sqrt(edge.value / max) * 6} opacity={.7} markerEnd={`url(#${marker})`}><title>{`${nodes.find((node) => node.id === edge.source)?.label} → ${nodes.find((node) => node.id === edge.target)?.label}: ${formatValue(edge.value)}`}</title></path>;
    })}
    {nodes.map((node) => { const position = positions.get(node.id)!; return <g key={node.id}><rect x={position.x - 58} y={position.y - 17} width={116} height={34} rx={6} fill="var(--card)" stroke="var(--primary)" />
      <title>{node.label}</title><text x={position.x} y={position.y + 4} textAnchor="middle" fontSize={11} fill="var(--foreground)">{node.label.length > 17 ? `${node.label.slice(0, 16)}…` : node.label}</text></g>; })}
  </svg></div></ChartFrame>;
}
