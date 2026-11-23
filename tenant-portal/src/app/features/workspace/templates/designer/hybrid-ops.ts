import type { TemplateDocumentV1, TemplateNode } from '../templates.model';
import { findBodyContainerId, newDesignerUuid, normalizeFlowOrders } from './document-ops';
import { clamp, type RectMm, roundMm } from './geometry';

import { absoluteBounds, clampAbsoluteFrame, printableBox, type HybridZone } from './hybrid-geometry';
export {
  absoluteBounds,
  clampAbsoluteFrame,
  clampToBounds,
  printableBox,
  zoneBox,
  type HybridZone,
} from './hybrid-geometry';
export type PositionMode = 'FLOW' | 'header' | 'footer';

export function hybridZone(
  doc: TemplateDocumentV1,
  type: 'header' | 'footer',
): HybridZone | undefined {
  const node = doc.rootNodeIds.map((id) => doc.nodes[id]).find((entry) => entry?.type === type);
  return node?.type === 'header' || node?.type === 'footer' ? node : undefined;
}

/** No synthetic heights: the owner enters missing zone heights in Page setup. */
export function setZoneHeight(
  doc: TemplateDocumentV1,
  type: 'header' | 'footer',
  heightMm: number,
): boolean {
  if (
    doc.layoutMode !== 'HYBRID_DOCUMENT' ||
    !Number.isFinite(heightMm) ||
    heightMm < 1 ||
    heightMm > 80
  )
    return false;
  const other = hybridZone(doc, type === 'header' ? 'footer' : 'header');
  if (heightMm + (other?.props.heightMm ?? 0) >= printableBox(doc).height) return false;
  const existing = hybridZone(doc, type);
  if (existing) {
    existing.props.heightMm = heightMm;
    return true;
  }
  const id = newDesignerUuid();
  const base = {
    id,
    parentId: null,
    childIds: [],
    locked: false,
    hidden: false,
    layout: { kind: 'FLOW' as const, order: 0 },
    style: {},
  };
  doc.nodes[id] =
    type === 'header'
      ? { ...base, type: 'header', props: { zoneMode: 'FIXED', heightMm, repeat: 'EVERY_PAGE' } }
      : { ...base, type: 'footer', props: { zoneMode: 'FIXED', heightMm, repeat: 'EVERY_PAGE' } };
  if (type === 'header') doc.rootNodeIds.unshift(id);
  else doc.rootNodeIds.push(id);
  normalizeFlowOrders(doc);
  return true;
}

/** Flow zone children use measured local boxes, just as the server requires measuredLayout. */
export function enableFixedZone(
  doc: TemplateDocumentV1,
  type: 'header' | 'footer',
  measured: ReadonlyMap<string, RectMm>,
): boolean {
  const zone = hybridZone(doc, type);
  if (!zone || doc.layoutMode !== 'HYBRID_DOCUMENT') return false;
  if (zone.props.zoneMode === 'FIXED') return true;
  for (const id of zone.childIds) {
    const frame = measured.get(id);
    if (
      !frame ||
      ![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) ||
      frame.x < 0 ||
      frame.y < 0 ||
      frame.width <= 0 ||
      frame.height <= 0
    )
      return false;
  }
  zone.props.zoneMode = 'FIXED';
  zone.childIds.forEach((id, index) => {
    const node = doc.nodes[id],
      frame = measured.get(id);
    if (node && frame)
      node.layout = { kind: 'ABSOLUTE', unit: 'MM', ...frame, rotationDeg: 0, zIndex: index };
  });
  normalizeFlowOrders(doc);
  return true;
}

export function positionError(
  doc: TemplateDocumentV1,
  node: TemplateNode,
  mode: PositionMode,
): string | null {
  if (
    doc.layoutMode !== 'HYBRID_DOCUMENT' ||
    node.locked ||
    node.type === 'header' ||
    node.type === 'footer' ||
    node.type === 'column' ||
    (node.type === 'container' && node.props.semanticRole === 'BODY')
  )
    return 'positionUnavailable';
  if (mode === 'FLOW') {
    if (node.type === 'group') return 'groupInFlow';
    if (node.layout.kind === 'ABSOLUTE' && node.layout.rotationDeg !== 0) return 'rotationInFlow';
    const subtree: TemplateNode[] = [node];
    for (let i = 0; i < subtree.length; i++) {
      const entry = subtree[i];
      if (entry.type === 'dataField' && entry.binding.path.startsWith('page.'))
        return 'pageFieldInFlow';
      if (
        entry.type === 'richText' &&
        JSON.stringify(entry.props.document).includes('"path":"page.')
      )
        return 'pageFieldInFlow';
      if (entry.type === 'group') return 'groupInFlow';
      if (entry.layout.kind === 'ABSOLUTE' && entry.layout.rotationDeg !== 0)
        return 'rotationInFlow';
      for (const childId of entry.childIds) {
        const child = doc.nodes[childId];
        if (child) subtree.push(child);
      }
    }
    return null;
  }
  if (['button', 'dynamicTable', 'totals', 'pageBreak'].includes(node.type)) return 'typeInZone';
  const zone = hybridZone(doc, mode);
  if (!zone) return 'configureZone';
  if (zone.props.zoneMode !== 'FIXED') return 'flowZone';
  const pending: TemplateNode[] = [node];
  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    if (['button', 'dynamicTable', 'totals', 'pageBreak'].includes(entry.type)) return 'typeInZone';
    for (const childId of entry.childIds) {
      const child = doc.nodes[childId];
      if (child) pending.push(child);
    }
  }
  return null;
}

export function moveNodeToPosition(
  doc: TemplateDocumentV1,
  id: string,
  mode: PositionMode,
  measured: RectMm,
): boolean {
  const node = doc.nodes[id];
  if (!node || positionError(doc, node, mode)) return false;
  if (!Object.values(measured).every(Number.isFinite) || measured.width <= 0 || measured.height <= 0) return false;
  const parentId = mode === 'FLOW' ? findBodyContainerId(doc) : hybridZone(doc, mode)?.id;
  const parent = parentId ? doc.nodes[parentId] : undefined;
  if (!parent || parent.id === node.id) return false;
  const oldParent = node.parentId ? doc.nodes[node.parentId] : undefined;
  if (oldParent) oldParent.childIds = oldParent.childIds.filter((childId) => childId !== id);
  else doc.rootNodeIds = doc.rootNodeIds.filter((rootId) => rootId !== id);
  const previous = node.layout;
  node.parentId = parent.id;
  parent.childIds.push(id);
  if (mode === 'FLOW') {
    const width = previous.kind === 'ABSOLUTE' ? previous.width : measured.width;
    const height = previous.kind === 'ABSOLUTE' ? previous.height : measured.height;
    node.layout = {
      kind: 'FLOW',
      order: 0,
      width: { value: Math.min(width, printableBox(doc).width), unit: 'MM' },
      minHeight: { value: height, unit: 'MM' },
      keepTogether: false,
      breakBefore: false,
      breakAfter: false,
    };
    const convertChildren = (parent: TemplateNode): void => {
      for (const childId of parent.childIds) {
        const child = doc.nodes[childId];
        if (!child) continue;
        if (child.layout.kind === 'ABSOLUTE') {
          const frame = child.layout;
          child.layout = {
            kind: 'FLOW',
            order: 0,
            ...(child.type === 'column'
              ? {}
              : {
                  width: { value: frame.width, unit: 'MM' as const },
                  minHeight: { value: frame.height, unit: 'MM' as const },
                }),
            keepTogether: false,
            breakBefore: false,
            breakAfter: false,
          };
        }
        convertChildren(child);
      }
    };
    convertChildren(node);
  } else {
    const bounds = absoluteBounds(doc, node);
    if (!bounds) return false;
    const rotationDeg = previous.kind === 'ABSOLUTE' ? previous.rotationDeg : 0;
    const size = previous.kind === 'ABSOLUTE' ? { width: previous.width, height: previous.height } : measured;
    const frame = clampAbsoluteFrame({ ...measured, width: size.width, height: size.height }, bounds, rotationDeg);
    node.layout = {
      kind: 'ABSOLUTE',
      unit: 'MM',
      ...frame,
      rotationDeg,
      zIndex: previous.kind === 'ABSOLUTE' ? previous.zIndex : parent.childIds.length,
    };
  }
  normalizeFlowOrders(doc);
  return true;
}

export function reorderFlow(doc: TemplateDocumentV1, id: string, beforeId: string | null): boolean {
  const node = doc.nodes[id];
  if (!node || node.locked || node.layout.kind !== 'FLOW' || !node.parentId || beforeId === id)
    return false;
  const parent = doc.nodes[node.parentId];
  if (!parent || parent.type === 'row' || (beforeId && doc.nodes[beforeId]?.parentId !== parent.id))
    return false;
  const siblings = parent.childIds.filter((childId) => childId !== id);
  const index = beforeId ? siblings.indexOf(beforeId) : siblings.length;
  if (index < 0) return false;
  siblings.splice(index, 0, id);
  parent.childIds = siblings;
  normalizeFlowOrders(doc);
  return true;
}

export function canResizeFlow(node: TemplateNode): boolean {
  return (
    node.layout.kind === 'FLOW' &&
    !node.locked &&
    !['header', 'footer', 'group', 'pageBreak'].includes(node.type) &&
    !(node.type === 'container' && node.props.semanticRole === 'BODY')
  );
}

export function resizeFlow(
  doc: TemplateDocumentV1,
  id: string,
  widthMm: number,
  minHeightMm: number,
  availableWidthMm: number,
): boolean {
  const node = doc.nodes[id];
  if (
    !node ||
    !canResizeFlow(node) ||
    node.layout.kind !== 'FLOW' ||
    ![widthMm, minHeightMm, availableWidthMm].every(Number.isFinite) || availableWidthMm <= 0
  )
    return false;
  const maxWidth = Math.min(availableWidthMm, printableBox(doc).width || availableWidthMm);
  const width = roundMm(clamp(widthMm, 0.001, maxWidth), 0.001);
  if (node.type === 'column') {
    node.layout = { ...node.layout, minHeight: { value: roundMm(clamp(minHeightMm, 0, 1000), 0.001), unit: 'MM' } };
    return true;
  }
  node.layout = {
    ...node.layout,
    width:
      node.layout.width?.unit === 'PERCENT'
        ? { value: roundMm((width / availableWidthMm) * 100, 0.001), unit: 'PERCENT' }
        : { value: width, unit: 'MM' },
    minHeight: { value: roundMm(clamp(minHeightMm, 0, 1000), 0.001), unit: 'MM' },
  };
  return true;
}
