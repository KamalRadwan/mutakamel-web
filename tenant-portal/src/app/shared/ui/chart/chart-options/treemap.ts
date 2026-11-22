import type { EChartsOption } from 'echarts';
import type { TreemapSeriesNodeItemOption } from './echarts-items';
import type { ChartContext, SeriesUnit, WidgetExecution } from '../chart.model';
import { baseOption, seriesColor } from '../chart-theme';
import { type ChartBuilder, escapeHtml, formatMetricValue } from './gauge';

interface TreemapPointNode extends TreemapSeriesNodeItemOption {
  key: string;
  seriesKey: string;
}

interface RawHierarchyNode {
  id: string;
  parentId?: string;
  label: string;
  value: number;
  depth: number;
}

export const treemapOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const firstSeries = exec.series[0];
  const seriesKey = firstSeries?.key ?? exec.widgetId;

  const hierarchy = exec.result?.shape === 'HIERARCHY' ? exec.result : null;
  const unit: SeriesUnit = hierarchy?.unit ?? firstSeries?.unit ?? 'COUNT';
  const currency = hierarchy?.currencyCode ?? firstSeries?.currency ?? exec.meta.currency;

  let treeData: TreemapPointNode[] = [];

  if (hierarchy && hierarchy.nodes.length > 0) {
    const validNodes: RawHierarchyNode[] = hierarchy.nodes.filter(
      (n) => Number.isFinite(n.value) && n.value >= 0,
    );
    const byId = new Map<string, RawHierarchyNode>();
    for (const node of validNodes) {
      byId.set(node.id, node);
    }

    const childrenByParent = new Map<string, RawHierarchyNode[]>();
    const roots: RawHierarchyNode[] = [];

    for (const node of validNodes) {
      if (!node.parentId || !byId.has(node.parentId) || node.parentId === node.id) {
        roots.push(node);
      } else {
        const list = childrenByParent.get(node.parentId);
        if (list) {
          list.push(node);
        } else {
          childrenByParent.set(node.parentId, [node]);
        }
      }
    }

    const buildNode = (
      node: RawHierarchyNode,
      color: string,
      visited: Set<string>,
    ): TreemapPointNode => {
      visited.add(node.id);
      const rawChildren = childrenByParent.get(node.id) ?? [];
      const children: TreemapPointNode[] = [];
      for (const child of rawChildren) {
        if (!visited.has(child.id)) {
          children.push(buildNode(child, color, visited));
        }
      }
      const item: TreemapPointNode = {
        id: node.id,
        name: node.label,
        value: node.value,
        key: node.id,
        seriesKey,
        itemStyle: { color },
      };
      if (children.length > 0) {
        item.children = children;
      }
      return item;
    };

    const visited = new Set<string>();
    treeData = roots.map((root, rootIdx) => {
      const color = seriesColor(ctx, rootIdx);
      return buildNode(root, color, visited);
    });
  } else if (firstSeries && firstSeries.points.length > 0) {
    treeData = firstSeries.points
      .filter(
        (p): p is typeof p & { value: number } =>
          p.value !== null && Number.isFinite(p.value) && p.value >= 0,
      )
      .map((p, idx) => ({
        id: p.key,
        name: p.label,
        value: p.value,
        key: p.key,
        seriesKey,
        itemStyle: { color: seriesColor(ctx, idx) },
      }));
  }

  if (treeData.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  return {
    ...base,
    legend: { show: false },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return '';
        const rawVal = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
        const valText = formatMetricValue(rawVal, unit, currency, ctx);
        return `<div dir="${ctx.dir}"><div>${escapeHtml(p.name ?? '')}</div><div><bdi dir="ltr">${escapeHtml(valText)}</bdi></div></div>`;
      },
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        label: {
          show: true,
          fontFamily: ctx.colors.fontUi,
          fontSize: 11,
          color: ctx.colors.text,
        },
        upperLabel: { show: false },
        itemStyle: {
          borderColor: ctx.colors.surface,
          borderWidth: 2,
          gapWidth: 2,
        },
        data: treeData,
      },
    ],
  };
};
