import { Component, computed, input } from '@angular/core';

export interface SparklineSpec {
  shape: 'line' | 'smooth' | 'area' | 'bars' | 'half-gauge' | 'progress' | 'segmented';
  values?: (number | null)[];
  ratio?: number;
  segments?: number[];
}

interface SvgPoint {
  x: number;
  y: number;
}

interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SegmentRect {
  x: number;
  width: number;
  alt: boolean;
}

interface LineGeometry {
  strokes: string[];
  fills: string[];
  dots: SvgPoint[];
  arrowPath: string | null;
}

const VIEW_WIDTH = 84;
const VIEW_HEIGHT = 38;
const GAUGE_ARC_PATH = 'M 16 33 A 26 26 0 0 1 68 33';
const GAUGE_ARC_LENGTH = Math.PI * 26;

@Component({
  selector: 'ui-sparkline',
  templateUrl: './sparkline.html',
  host: {
    class: 'inline-flex w-stat-chart-w h-stat-chart-h shrink-0 items-center justify-center text-accent',
    'aria-hidden': 'true',
    dir: 'ltr',
  },
})
export class Sparkline {
  readonly spec = input.required<SparklineSpec>();

  protected readonly lineGeometry = computed<LineGeometry | null>(() => {
    const spec = this.spec();
    if (spec.shape !== 'line' && spec.shape !== 'smooth' && spec.shape !== 'area') {
      return null;
    }
    return buildLineGeometry(spec.shape, spec.values ?? []);
  });

  protected readonly barRects = computed<BarRect[]>(() => {
    const spec = this.spec();
    if (spec.shape !== 'bars') return [];
    return buildBarRects(spec.values ?? []);
  });

  protected readonly gauge = computed<{ path: string; dashArray: string | null }>(() => {
    const ratio = clamp01(this.spec().ratio ?? 0);
    if (ratio <= 0) {
      return { path: GAUGE_ARC_PATH, dashArray: null };
    }
    const filled = Math.max(0.5, ratio * GAUGE_ARC_LENGTH);
    return {
      path: GAUGE_ARC_PATH,
      dashArray: `${round(filled)} ${round(GAUGE_ARC_LENGTH + 4)}`,
    };
  });

  protected readonly progressWidth = computed(() => {
    const ratio = clamp01(this.spec().ratio ?? 0);
    if (ratio <= 0) return 0;
    return round(Math.min(80, Math.max(2, ratio * 80)));
  });

  protected readonly segmentRects = computed<SegmentRect[]>(() => {
    const spec = this.spec();
    if (spec.shape !== 'segmented') return [];
    return buildSegments(spec.segments ?? []);
  });
}

function buildLineGeometry(shape: 'line' | 'smooth' | 'area', rawValues: (number | null)[]): LineGeometry {
  const values = rawValues.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const finite = values.filter((v): v is number => v !== null);
  if (finite.length === 0) {
    return { strokes: [], fills: [], dots: [], arrowPath: null };
  }

  const minVal = Math.min(...finite);
  const maxVal = Math.max(...finite);
  const span = maxVal - minVal;
  const isArea = shape === 'area';
  const minX = isArea ? 2 : 3;
  const maxX = isArea ? 82 : 76;
  const minY = isArea ? 4 : 5;
  const maxY = isArea ? 34 : 33;
  const baseline = 36;
  const midY = (minY + maxY) / 2;

  const mapY = (v: number): number => {
    if (span === 0) return midY;
    return maxY - ((v - minVal) / span) * (maxY - minY);
  };

  let runs: SvgPoint[][] = [];
  if (values.length === 1 && values[0] !== null) {
    const y = round(mapY(values[0]));
    runs = [[{ x: 12, y }, { x: 72, y }]];
  } else {
    const stepX = values.length > 1 ? (maxX - minX) / (values.length - 1) : 0;
    let current: SvgPoint[] = [];
    values.forEach((v, i) => {
      if (v === null) {
        if (current.length > 0) {
          runs.push(current);
          current = [];
        }
        return;
      }
      current.push({ x: round(minX + i * stepX), y: round(mapY(v)) });
    });
    if (current.length > 0) {
      runs.push(current);
    }
  }

  const strokes: string[] = [];
  const fills: string[] = [];
  const dots: SvgPoint[] = [];

  for (const run of runs) {
    if (run.length === 1) {
      dots.push(run[0]);
      continue;
    }
    const strokePath = shape === 'line' ? buildPolylinePath(run) : buildSmoothPath(run);
    strokes.push(strokePath);
    if (isArea) {
      const first = run[0];
      const last = run[run.length - 1];
      fills.push(`${strokePath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`);
    }
  }

  let arrowPath: string | null = null;
  if (!isArea && runs.length > 0) {
    const lastRun = runs[runs.length - 1];
    const end = lastRun[lastRun.length - 1];
    const prev = lastRun.length >= 2 ? lastRun[lastRun.length - 2] : { x: end.x - 1, y: end.y };
    arrowPath = buildArrowHead(prev, end);
  }

  return { strokes, fills, dots, arrowPath };
}

function buildPolylinePath(points: SvgPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function buildSmoothPath(points: SvgPoint[]): string {
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const midX = round((a.x + b.x) / 2);
    parts.push(`C ${midX} ${a.y} ${midX} ${b.y} ${b.x} ${b.y}`);
  }
  return parts.join(' ');
}

function buildArrowHead(prev: SvgPoint, end: SvgPoint): string {
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const len = Math.hypot(dx, dy);
  const ux = len > 0.001 ? dx / len : 1;
  const uy = len > 0.001 ? dy / len : 0;

  const tipX = round(Math.min(VIEW_WIDTH - 1, Math.max(1, end.x + ux * 3)));
  const tipY = round(Math.min(VIEW_HEIGHT - 1, Math.max(1, end.y + uy * 3)));
  const baseX = tipX - ux * 6;
  const baseY = tipY - uy * 6;
  const perpX = -uy * 2.8;
  const perpY = ux * 2.8;

  const p1x = round(baseX + perpX);
  const p1y = round(baseY + perpY);
  const p2x = round(baseX - perpX);
  const p2y = round(baseY - perpY);
  return `M ${tipX} ${tipY} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`;
}

function buildBarRects(rawValues: (number | null)[]): BarRect[] {
  const count = rawValues.length;
  if (count === 0) return [];
  const finite = rawValues.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) return [];

  const low = Math.min(0, ...finite);
  const high = Math.max(0, ...finite);
  const span = high - low;
  const gap = count > 20 ? 1 : 2;
  const rawW = (80 - gap * Math.max(0, count - 1)) / count;
  const barW = Math.min(18, Math.max(1, rawW));
  const totalW = barW * count + gap * Math.max(0, count - 1);
  const startX = (VIEW_WIDTH - totalW) / 2;

  const rects: BarRect[] = [];
  rawValues.forEach((v, i) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const h = span === 0 ? (v === 0 ? 2 : 16) : Math.max(2, ((v - low) / span) * 32);
    rects.push({
      x: round(startX + i * (barW + gap)),
      y: round(36 - h),
      width: round(barW),
      height: round(h),
    });
  });
  return rects;
}

function buildSegments(rawSegments: number[]): SegmentRect[] {
  const positive = rawSegments.filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (positive.length === 0) return [];
  const total = positive.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return [];

  const gap = 2;
  const usableW = Math.max(0, 80 - gap * (positive.length - 1));
  const rects: SegmentRect[] = [];
  let cursor = 2;

  // Apply the 2-unit minimum, then shrink the wider segments so the row still fits the track.
  const minW = 2;
  const widths = positive.map((value) => Math.max(minW, (value / total) * usableW));
  const excess = widths.reduce((sum, w) => sum + w, 0) - usableW;
  if (excess > 0) {
    const free = widths.reduce((sum, w) => sum + (w - minW), 0);
    const factor = free > 0 ? Math.max(0, 1 - excess / free) : 1;
    widths.forEach((w, i) => {
      widths[i] = minW + (w - minW) * factor;
    });
  }

  positive.forEach((_value, idx) => {
    const w = widths[idx];
    rects.push({
      x: round(cursor),
      width: round(w),
      alt: idx % 2 === 1,
    });
    cursor += w + gap;
  });

  return rects;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
