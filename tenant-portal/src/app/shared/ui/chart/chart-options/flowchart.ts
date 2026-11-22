import type { EChartsOption } from 'echarts';
import type {
  GraphEdgeItemOption,
  GraphNodeItemOption,
  SankeyEdgeItemOption,
  SankeyNodeItemOption,
} from './echarts-items';
import type { ChartContext, WidgetExecution, WidgetPoint } from '../chart.model';
import { baseOption, seriesColor } from '../chart-theme';
import { type ChartBuilder, escapeHtml, formatMetricValue } from './gauge';

interface ParsedEdge {
  source: string;
  target: string;
  value: number;
  key: string;
}

interface SankeyNodePoint extends SankeyNodeItemOption {
  key: string;
  seriesKey: string;
}

interface SankeyEdgePoint extends SankeyEdgeItemOption {
  key: string;
  seriesKey: string;
}

interface GraphNodePoint extends GraphNodeItemOption {
  key: string;
  seriesKey: string;
}

interface GraphEdgePoint extends GraphEdgeItemOption {
  key: string;
  seriesKey: string;
}

function parseEdgeEndpoint(p: WidgetPoint): { source: string; target: string } | null {
  const metaSource = p.meta?.['source'];
  const metaTarget = p.meta?.['target'];
  if (
    typeof metaSource === 'string' &&
    metaSource.trim() &&
    typeof metaTarget === 'string' &&
    metaTarget.trim()
  ) {
    return { source: metaSource.trim(), target: metaTarget.trim() };
  }

  const labelArrow = p.label.includes('->')
    ? p.label.split('->')
    : p.label.includes('→')
      ? p.label.split('→')
      : null;
  if (labelArrow && labelArrow.length >= 2) {
    const source = labelArrow[0].trim();
    const target = labelArrow[1].trim();
    if (source && target) {
      return { source, target };
    }
  }

  const keyColon = p.key.split(':');
  if (keyColon.length >= 2) {
    const source = keyColon[0].trim();
    const target = keyColon[1].trim();
    if (source && target) {
      return { source, target };
    }
  }

  return null;
}

function hasCycle(nodes: readonly string[], edges: readonly ParsedEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const name of nodes) {
    adj.set(name, []);
  }
  for (const edge of edges) {
    if (edge.source === edge.target) {
      return true;
    }
    adj.get(edge.source)?.push(edge.target);
  }

  const state = new Map<string, 0 | 1 | 2>();
  for (const name of nodes) {
    state.set(name, 0);
  }

  const dfs = (node: string): boolean => {
    state.set(node, 1);
    const neighbors = adj.get(node) ?? [];
    for (const next of neighbors) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        return true;
      }
      if (nextState === 0 && dfs(next)) {
        return true;
      }
    }
    state.set(node, 2);
    return false;
  };

  for (const name of nodes) {
    if (state.get(name) === 0 && dfs(name)) {
      return true;
    }
  }
  return false;
}

export const flowchartOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const series = exec.series[0];

  if (!series || series.points.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const nodeSet = new Set<string>();
  const edgeMap = new Map<string, ParsedEdge>();

  for (const p of series.points) {
    if (p.value === null || !Number.isFinite(p.value) || p.value <= 0) {
      continue;
    }
    const endpoints = parseEdgeEndpoint(p);
    if (!endpoints) {
      continue;
    }
    nodeSet.add(endpoints.source);
    nodeSet.add(endpoints.target);
    const pairKey = `${endpoints.source}\0${endpoints.target}`;
    const existing = edgeMap.get(pairKey);
    if (existing) {
      existing.value += p.value;
    } else {
      edgeMap.set(pairKey, {
        source: endpoints.source,
        target: endpoints.target,
        value: p.value,
        key: p.key,
      });
    }
  }

  const edges = Array.from(edgeMap.values());
  const nodeNames = Array.from(nodeSet);

  if (edges.length === 0 || nodeNames.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const isRtl = ctx.dir === 'rtl';
  const cyclic = hasCycle(nodeNames, edges);

  const tooltip: EChartsOption['tooltip'] = {
    ...baseTooltip,
    trigger: 'item',
    formatter: (params) => {
      const p = Array.isArray(params) ? params[0] : params;
      if (!p) return '';
      const rawVal = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
      const valText = formatMetricValue(rawVal, series.unit, series.currency, ctx);
      if (p.dataType === 'edge') {
        const edge = p.data as { source?: string; target?: string } | undefined;
        const src = escapeHtml(String(edge?.source ?? ''));
        const dst = escapeHtml(String(edge?.target ?? ''));
        return `<div dir="${ctx.dir}"><div><bdi>${src}</bdi> → <bdi>${dst}</bdi></div><div><bdi dir="ltr">${escapeHtml(valText)}</bdi></div></div>`;
      }
      const nodeLabel = escapeHtml(p.name ?? '');
      if (rawVal === null) {
        return `<div dir="${ctx.dir}"><div>${nodeLabel}</div></div>`;
      }
      return `<div dir="${ctx.dir}"><div>${nodeLabel}</div><div><bdi dir="ltr">${escapeHtml(valText)}</bdi></div></div>`;
    },
  };

  if (cyclic) {
    const graphNodes: GraphNodePoint[] = nodeNames.map((name, idx) => ({
      name,
      key: name,
      seriesKey: series.key,
      itemStyle: { color: seriesColor(ctx, idx) },
    }));
    const graphEdges: GraphEdgePoint[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      value: e.value,
      key: e.key,
      seriesKey: series.key,
    }));

    return {
      ...base,
      legend: { show: false },
      tooltip,
      series: [
        {
          type: 'graph',
          layout: 'circular',
          roam: false,
          top: 24,
          bottom: 24,
          left: 24,
          right: 24,
          symbolSize: 22,
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: [0, 8],
          edgeLabel: { show: false },
          label: {
            show: true,
            position: isRtl ? 'left' : 'right',
            fontFamily: ctx.colors.fontUi,
            fontSize: 11,
            color: ctx.colors.text,
          },
          lineStyle: {
            color: 'source',
            curveness: 0.25,
            opacity: ctx.colors.linkOpacity,
            width: 2,
          },
          data: graphNodes,
          links: graphEdges,
        },
      ],
    };
  }

  const sankeyNodes: SankeyNodePoint[] = nodeNames.map((name, idx) => ({
    name,
    key: name,
    seriesKey: series.key,
    itemStyle: { color: seriesColor(ctx, idx) },
  }));
  const sankeyLinks: SankeyEdgePoint[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    value: e.value,
    key: e.key,
    seriesKey: series.key,
  }));

  return {
    ...base,
    legend: { show: false },
    tooltip,
    series: [
      {
        type: 'sankey',
        orient: 'horizontal',
        left: isRtl ? 70 : 4,
        right: isRtl ? 4 : 70,
        top: 6,
        bottom: 6,
        nodeWidth: 10,
        nodeGap: 8,
        label: {
          show: true,
          position: isRtl ? 'left' : 'right',
          fontFamily: ctx.colors.fontUi,
          fontSize: 11,
          color: ctx.colors.text,
        },
        lineStyle: {
          color: 'source',
          opacity: ctx.colors.linkOpacity,
          curveness: 0.5,
        },
        data: sankeyNodes,
        links: sankeyLinks,
      },
    ],
  };
};
