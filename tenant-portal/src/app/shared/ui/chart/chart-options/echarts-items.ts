import type {
  BarSeriesOption,
  FunnelSeriesOption,
  GaugeSeriesOption,
  GraphSeriesOption,
  HeatmapSeriesOption,
  PieSeriesOption,
  SankeySeriesOption,
  TreemapSeriesOption,
} from 'echarts';

/** ECharts 6 does not export its per-series data item types; derive them from the series options. */
type ItemOf<T> = Exclude<Extract<T, object>, readonly unknown[] | Date>;
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;

export type BarDataItemOption = ItemOf<ElementOf<BarSeriesOption['data']>>;
export type FunnelDataItemOption = ItemOf<ElementOf<FunnelSeriesOption['data']>>;
export type GaugeDataItemOption = ItemOf<ElementOf<GaugeSeriesOption['data']>>;
export type HeatmapDataItemOption = ItemOf<ElementOf<HeatmapSeriesOption['data']>>;
export type PieDataItemOption = ItemOf<ElementOf<PieSeriesOption['data']>>;
export type TreemapSeriesNodeItemOption = ItemOf<ElementOf<TreemapSeriesOption['data']>>;
export type SankeyNodeItemOption = ItemOf<ElementOf<SankeySeriesOption['data']>>;
export type SankeyEdgeItemOption = ItemOf<ElementOf<SankeySeriesOption['links']>>;
export type GraphNodeItemOption = ItemOf<ElementOf<GraphSeriesOption['data']>>;
export type GraphEdgeItemOption = ItemOf<ElementOf<GraphSeriesOption['links']>>;
