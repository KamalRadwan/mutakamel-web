import type { TemplateNode, TemplatePageConfig } from '../templates.model';

export const MM_TO_PX = 96 / 25.4;

export interface RectMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameMm extends RectMm {
  rotationDeg: number;
}

export interface RectPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'NW' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W';

export interface SnapTarget {
  axis: 'X' | 'Y';
  posMm: number;
  reason: 'margin' | 'pageCentre' | 'node';
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
}

export interface SnapGuide {
  axis: 'X' | 'Y';
  posMm: number;
  reason: 'margin' | 'pageCentre' | 'node';
  nodeName?: string;
  nodeType?: string;
}

export interface SnapMoveResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

export interface SnapResizeResult {
  rect: RectMm;
  guides: SnapGuide[];
}

export function mmToPx(mm: number, zoom = 1): number {
  return mm * MM_TO_PX * zoom;
}

export function pxToMm(px: number, zoom = 1): number {
  const factor = MM_TO_PX * (zoom > 0 ? zoom : 1);
  return px / factor;
}

export function roundMm(value: number, step = 0.1): number {
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampFrameMm(frame: FrameMm): FrameMm {
  return {
    x: clamp(roundMm(frame.x), 0, 500),
    y: clamp(roundMm(frame.y), 0, 1000),
    width: clamp(roundMm(frame.width), 0.001, 500),
    height: clamp(roundMm(frame.height), 0.001, 1000),
    rotationDeg: clamp(roundMm(frame.rotationDeg), -180, 180),
  };
}

export function printableRectMm(page: TemplatePageConfig): RectMm {
  const x = page.marginMm.start;
  const y = page.marginMm.top;
  const width = Math.max(0, page.widthMm - page.marginMm.start - page.marginMm.end);
  const height = Math.max(0, page.heightMm - page.marginMm.top - page.marginMm.bottom);
  return { x, y, width, height };
}

/**
 * Origin (0,0) sits at the paper's top-left corner so frame coordinates match the mm rulers directly.
 * Fixtures (e.g. Corporate quotation topBand x=12, width=186 on 210 mm paper) place frames relative to the paper edge.
 */
export function frameToPx(frame: RectMm, _page: TemplatePageConfig | null, zoom: number): RectPx {
  return {
    left: mmToPx(frame.x, zoom),
    top: mmToPx(frame.y, zoom),
    width: mmToPx(frame.width, zoom),
    height: mmToPx(frame.height, zoom),
  };
}

export function isInsidePrintableArea(frame: RectMm, page: TemplatePageConfig, toleranceMm = 0.05): boolean {
  const printable = printableRectMm(page);
  return (
    frame.x >= printable.x - toleranceMm &&
    frame.y >= printable.y - toleranceMm &&
    frame.x + frame.width <= printable.x + printable.width + toleranceMm &&
    frame.y + frame.height <= printable.y + printable.height + toleranceMm
  );
}

export function rectsIntersect(a: RectMm, b: RectMm): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function boundingRectMm(frames: readonly RectMm[]): RectMm | null {
  if (frames.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of frames) {
    minX = Math.min(minX, f.x);
    minY = Math.min(minY, f.y);
    maxX = Math.max(maxX, f.x + f.width);
    maxY = Math.max(maxY, f.y + f.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function resizeFrameMm(
  start: RectMm,
  handle: ResizeHandle,
  dxMm: number,
  dyMm: number,
  keepRatio: boolean,
  minSizeMm = 1,
): RectMm {
  const startRight = start.x + start.width;
  const startBottom = start.y + start.height;

  const hasW = handle.includes('W');
  const hasE = handle.includes('E');
  const hasN = handle.includes('N');
  const hasS = handle.includes('S');

  let left = start.x;
  let right = startRight;
  let top = start.y;
  let bottom = startBottom;

  if (hasW) {
    left = Math.min(startRight - minSizeMm, start.x + dxMm);
  } else if (hasE) {
    right = Math.max(start.x + minSizeMm, startRight + dxMm);
  }

  if (hasN) {
    top = Math.min(startBottom - minSizeMm, start.y + dyMm);
  } else if (hasS) {
    bottom = Math.max(start.y + minSizeMm, startBottom + dyMm);
  }

  let width = right - left;
  let height = bottom - top;

  if (keepRatio && start.height > 0 && start.width > 0) {
    const ratio = start.width / start.height;
    const isCorner = (hasW || hasE) && (hasN || hasS);
    if (isCorner) {
      if (width / height > ratio) {
        height = Math.max(minSizeMm, width / ratio);
        width = height * ratio;
      } else {
        width = Math.max(minSizeMm, height * ratio);
        height = width / ratio;
      }
    } else if (hasW || hasE) {
      height = Math.max(minSizeMm, width / ratio);
      width = height * ratio;
    } else if (hasN || hasS) {
      width = Math.max(minSizeMm, height * ratio);
      height = width / ratio;
    }

    if (hasW) {
      left = startRight - width;
    } else if (!hasE) {
      left = start.x + (start.width - width) / 2;
    }
    if (hasN) {
      top = startBottom - height;
    } else if (!hasS) {
      top = start.y + (start.height - height) / 2;
    }
  }

  return {
    x: clamp(roundMm(left), 0, 500),
    y: clamp(roundMm(top), 0, 1000),
    width: clamp(roundMm(width), minSizeMm, 500),
    height: clamp(roundMm(height), minSizeMm, 1000),
  };
}

export function buildSnapTargets(
  page: TemplatePageConfig,
  otherNodes: readonly TemplateNode[],
): SnapTarget[] {
  const targets: SnapTarget[] = [];
  const printable = printableRectMm(page);

  // Page edges & printable margins
  targets.push(
    { axis: 'X', posMm: 0, reason: 'margin' },
    { axis: 'X', posMm: page.widthMm, reason: 'margin' },
    { axis: 'Y', posMm: 0, reason: 'margin' },
    { axis: 'Y', posMm: page.heightMm, reason: 'margin' },
    { axis: 'X', posMm: printable.x, reason: 'margin' },
    { axis: 'X', posMm: printable.x + printable.width, reason: 'margin' },
    { axis: 'Y', posMm: printable.y, reason: 'margin' },
    { axis: 'Y', posMm: printable.y + printable.height, reason: 'margin' },
  );

  // Page and printable centre lines
  targets.push(
    { axis: 'X', posMm: page.widthMm / 2, reason: 'pageCentre' },
    { axis: 'Y', posMm: page.heightMm / 2, reason: 'pageCentre' },
    { axis: 'X', posMm: printable.x + printable.width / 2, reason: 'pageCentre' },
    { axis: 'Y', posMm: printable.y + printable.height / 2, reason: 'pageCentre' },
  );

  for (const node of otherNodes) {
    if (node.layout.kind !== 'ABSOLUTE' || node.hidden) continue;
    const { x, y, width, height } = node.layout;
    const meta = { reason: 'node' as const, nodeId: node.id, nodeName: node.name, nodeType: node.type };
    targets.push(
      { axis: 'X', posMm: x, ...meta },
      { axis: 'X', posMm: x + width / 2, ...meta },
      { axis: 'X', posMm: x + width, ...meta },
      { axis: 'Y', posMm: y, ...meta },
      { axis: 'Y', posMm: y + height / 2, ...meta },
      { axis: 'Y', posMm: y + height, ...meta },
    );
  }

  return targets;
}

const REASON_PRIORITY: Record<SnapTarget['reason'], number> = {
  pageCentre: 0,
  margin: 1,
  node: 2,
};

function findBestAxisSnap(
  points: readonly number[],
  targets: readonly SnapTarget[],
  axis: 'X' | 'Y',
  thresholdMm: number,
): { delta: number; guide: SnapGuide } | null {
  let bestDist = thresholdMm + 1e-6;
  let bestDelta = 0;
  let bestTarget: SnapTarget | null = null;

  for (const t of targets) {
    if (t.axis !== axis) continue;
    for (const p of points) {
      const delta = t.posMm - p;
      const dist = Math.abs(delta);
      if (
        dist < bestDist - 1e-6 ||
        (Math.abs(dist - bestDist) <= 1e-6 &&
          bestTarget !== null &&
          REASON_PRIORITY[t.reason] < REASON_PRIORITY[bestTarget.reason])
      ) {
        bestDist = dist;
        bestDelta = delta;
        bestTarget = t;
      }
    }
  }

  if (!bestTarget) return null;
  return {
    delta: bestDelta,
    guide: {
      axis,
      posMm: bestTarget.posMm,
      reason: bestTarget.reason,
      nodeName: bestTarget.nodeName,
      nodeType: bestTarget.nodeType,
    },
  };
}

export function snapMoveMm(
  proposed: RectMm,
  targets: readonly SnapTarget[],
  thresholdMm: number,
): SnapMoveResult {
  const xPoints = [proposed.x, proposed.x + proposed.width / 2, proposed.x + proposed.width];
  const yPoints = [proposed.y, proposed.y + proposed.height / 2, proposed.y + proposed.height];

  const xMatch = findBestAxisSnap(xPoints, targets, 'X', thresholdMm);
  const yMatch = findBestAxisSnap(yPoints, targets, 'Y', thresholdMm);

  const guides: SnapGuide[] = [];
  if (xMatch) guides.push(xMatch.guide);
  if (yMatch) guides.push(yMatch.guide);

  return {
    x: roundMm(clamp(proposed.x + (xMatch?.delta ?? 0), 0, 500)),
    y: roundMm(clamp(proposed.y + (yMatch?.delta ?? 0), 0, 1000)),
    guides,
  };
}

export function snapResizeMm(
  proposed: RectMm,
  handle: ResizeHandle,
  targets: readonly SnapTarget[],
  thresholdMm: number,
  minSizeMm = 1,
): SnapResizeResult {
  let { x, y, width, height } = proposed;
  const guides: SnapGuide[] = [];

  const hasW = handle.includes('W');
  const hasE = handle.includes('E');
  const hasN = handle.includes('N');
  const hasS = handle.includes('S');

  if (hasW) {
    const match = findBestAxisSnap([x], targets, 'X', thresholdMm);
    if (match) {
      const nextX = clamp(x + match.delta, 0, x + width - minSizeMm);
      width = x + width - nextX;
      x = nextX;
      guides.push(match.guide);
    }
  } else if (hasE) {
    const right = x + width;
    const match = findBestAxisSnap([right], targets, 'X', thresholdMm);
    if (match) {
      const nextRight = Math.max(x + minSizeMm, right + match.delta);
      width = nextRight - x;
      guides.push(match.guide);
    }
  }

  if (hasN) {
    const match = findBestAxisSnap([y], targets, 'Y', thresholdMm);
    if (match) {
      const nextY = clamp(y + match.delta, 0, y + height - minSizeMm);
      height = y + height - nextY;
      y = nextY;
      guides.push(match.guide);
    }
  } else if (hasS) {
    const bottom = y + height;
    const match = findBestAxisSnap([bottom], targets, 'Y', thresholdMm);
    if (match) {
      const nextBottom = Math.max(y + minSizeMm, bottom + match.delta);
      height = nextBottom - y;
      guides.push(match.guide);
    }
  }

  return {
    rect: {
      x: clamp(roundMm(x), 0, 500),
      y: clamp(roundMm(y), 0, 1000),
      width: clamp(roundMm(width), minSizeMm, 500),
      height: clamp(roundMm(height), minSizeMm, 1000),
    },
    guides,
  };
}
