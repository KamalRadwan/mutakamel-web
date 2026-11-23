import type { TemplateDocumentV1, TemplateNode } from '../templates.model';
import { clamp, type RectMm, roundMm } from './geometry';

export type HybridZone = Extract<TemplateNode, { type: 'header' | 'footer' }>;

export function nodeZone(doc: TemplateDocumentV1, nodeId: string): HybridZone | undefined {
  let node: TemplateNode | undefined = doc.nodes[nodeId];
  while (node) {
    if (node.type === 'header' || node.type === 'footer') return node;
    node = node.parentId ? doc.nodes[node.parentId] : undefined;
  }
  return undefined;
}

export function printableBox(doc: TemplateDocumentV1): RectMm {
  const page = doc.page;
  if (!page) return { x: 0, y: 0, width: 0, height: 0 };
  const rtl = doc.direction === 'RTL' || (doc.direction === 'AUTO' && doc.locale.startsWith('ar'));
  return {
    x: rtl ? page.marginMm.end : page.marginMm.start,
    y: page.marginMm.top,
    width: page.widthMm - page.marginMm.start - page.marginMm.end,
    height: page.heightMm - page.marginMm.top - page.marginMm.bottom,
  };
}

export function zoneBox(doc: TemplateDocumentV1, zone: HybridZone): RectMm {
  const box = printableBox(doc);
  return {
    ...box,
    y: box.y + (zone.type === 'footer' ? box.height - zone.props.heightMm : 0),
    height: zone.props.heightMm,
  };
}

/** Coordinates of ABSOLUTE children are physical, local to their zone/group. */
export function absoluteBounds(doc: TemplateDocumentV1, node: TemplateNode): RectMm | null {
  const parent = node.parentId ? doc.nodes[node.parentId] : undefined;
  if (parent?.layout.kind === 'ABSOLUTE') {
    return { x: 0, y: 0, width: parent.layout.width, height: parent.layout.height };
  }
  if (parent?.type === 'header' || parent?.type === 'footer') {
    return { x: 0, y: 0, width: printableBox(doc).width, height: parent.props.heightMm };
  }
  return null;
}

export function clampToBounds(rect: RectMm, bounds: RectMm): RectMm {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  return {
    x: roundMm(clamp(rect.x, bounds.x, bounds.x + bounds.width - width), 0.001),
    y: roundMm(clamp(rect.y, bounds.y, bounds.y + bounds.height - height), 0.001),
    width: roundMm(width, 0.001),
    height: roundMm(height, 0.001),
  };
}

export function clampAbsoluteFrame(rect: RectMm, bounds: RectMm, rotationDeg: number): RectMm {
  if (rotationDeg === 0) return clampToBounds(rect, bounds);
  const angle = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle)),
    sin = Math.abs(Math.sin(angle));
  const projectedWidth = rect.width * cos + rect.height * sin;
  const projectedHeight = rect.width * sin + rect.height * cos;
  const scale = Math.min(
    1,
    bounds.width / projectedWidth,
    bounds.height / projectedHeight,
    bounds.width / rect.width,
    bounds.height / rect.height,
  );
  const width = Math.floor(rect.width * scale * 1000) / 1000;
  const height = Math.floor(rect.height * scale * 1000) / 1000;
  const halfWidth = (width * cos + height * sin) / 2;
  const halfHeight = (width * sin + height * cos) / 2;
  const cx = clamp(
    rect.x + rect.width / 2,
    bounds.x + Math.max(halfWidth, width / 2),
    bounds.x + bounds.width - Math.max(halfWidth, width / 2),
  );
  const cy = clamp(
    rect.y + rect.height / 2,
    bounds.y + Math.max(halfHeight, height / 2),
    bounds.y + bounds.height - Math.max(halfHeight, height / 2),
  );
  return { x: roundMm(cx - width / 2, 0.001), y: roundMm(cy - height / 2, 0.001), width, height };
}
