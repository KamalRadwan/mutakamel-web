import type {
  TemplateDocumentV1,
  TemplateDynamicTableColumn,
  TemplateFormulaExpression,
  TemplateNode,
  TemplateNodeLayout,
  TemplateNodeStyle,
  TemplateNodeType,
  TemplatePageConfig,
  TemplateTableBand,
} from '../templates.model';
import {
  type RectMm,
  boundingRectMm,
  clamp,
  clampFrameMm,
  printableRectMm,
  roundMm,
} from './geometry';

export type NewTemplateNode = TemplateNode extends infer N
  ? N extends TemplateNode
    ? Omit<N, 'id' | 'parentId' | 'childIds' | 'locked' | 'hidden' | 'layout' | 'style'> & {
        name?: string;
        locked?: boolean;
        hidden?: boolean;
        layout?: TemplateNodeLayout;
        style?: TemplateNodeStyle;
      }
    : never
  : never;

export function newDesignerUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const now = Date.now();
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function currentPageConfig(doc: TemplateDocumentV1, pageIndex: number): TemplatePageConfig | null {
  if (doc.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 0) {
    const safeIdx = Math.max(0, Math.min(pageIndex, doc.canvasPages.length - 1));
    return doc.canvasPages[safeIdx].page;
  }
  return doc.page ?? null;
}

export function currentPageRootNodeIds(doc: TemplateDocumentV1, pageIndex: number): string[] {
  if (doc.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 0) {
    const safeIdx = Math.max(0, Math.min(pageIndex, doc.canvasPages.length - 1));
    return doc.canvasPages[safeIdx].rootNodeIds;
  }
  return doc.rootNodeIds;
}

export function syncCanvasPagesRootIds(doc: TemplateDocumentV1): void {
  if (doc.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 0) {
    doc.rootNodeIds = doc.canvasPages.flatMap((page) => page.rootNodeIds);
  }
}

export function collectSubtreeIds(doc: TemplateDocumentV1, rootId: string, out: string[] = []): string[] {
  const node = doc.nodes[rootId];
  if (!node) return out;
  out.push(rootId);
  for (const childId of node.childIds) {
    if (!out.includes(childId)) {
      collectSubtreeIds(doc, childId, out);
    }
  }
  return out;
}

export function collectPageNodes(doc: TemplateDocumentV1, pageIndex: number): TemplateNode[] {
  const roots = currentPageRootNodeIds(doc, pageIndex);
  const result: TemplateNode[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    const node = doc.nodes[id];
    if (!node) return;
    seen.add(id);
    result.push(node);
    for (const childId of node.childIds) {
      visit(childId);
    }
  };
  for (const rootId of roots) {
    visit(rootId);
  }
  return result;
}

export function normalizeFlowOrders(doc: TemplateDocumentV1): void {
  let rootFlowOrder = 0;
  for (const id of doc.rootNodeIds) {
    const node = doc.nodes[id];
    if (node && node.layout.kind === 'FLOW') {
      node.layout.order = rootFlowOrder++;
    }
  }
  for (const node of Object.values(doc.nodes)) {
    let childFlowOrder = 0;
    for (const childId of node.childIds) {
      const child = doc.nodes[childId];
      if (child && child.layout.kind === 'FLOW') {
        child.layout.order = childFlowOrder++;
      }
    }
  }
}

export function checkGraph(doc: TemplateDocumentV1): boolean {
  const allIds = Object.keys(doc.nodes);
  const visited = new Set<string>();

  if (new Set(doc.rootNodeIds).size !== doc.rootNodeIds.length) {
    return false;
  }

  if (doc.layoutMode === 'FIXED_CANVAS' && doc.canvasPages && doc.canvasPages.length > 0) {
    const flatPages = doc.canvasPages.flatMap((p) => p.rootNodeIds);
    if (flatPages.length !== doc.rootNodeIds.length) return false;
    for (let i = 0; i < flatPages.length; i++) {
      if (flatPages[i] !== doc.rootNodeIds[i]) return false;
    }
  }

  const visit = (id: string, expectedParent: string | null, ancestry: Set<string>): boolean => {
    const node = doc.nodes[id];
    if (!node || node.id !== id) return false;
    if (node.parentId !== expectedParent) return false;
    if (ancestry.has(id) || visited.has(id)) return false;

    visited.add(id);
    if (new Set(node.childIds).size !== node.childIds.length) return false;

    ancestry.add(id);
    let expectedFlowOrder = 0;
    for (const childId of node.childIds) {
      const child = doc.nodes[childId];
      if (!child) return false;
      if (child.layout.kind === 'FLOW') {
        if (child.layout.order !== expectedFlowOrder) return false;
        expectedFlowOrder++;
      }
      if (!visit(childId, id, ancestry)) return false;
    }
    ancestry.delete(id);
    return true;
  };

  let expectedRootOrder = 0;
  for (const rootId of doc.rootNodeIds) {
    const rootNode = doc.nodes[rootId];
    if (!rootNode) return false;
    if (rootNode.layout.kind === 'FLOW') {
      if (rootNode.layout.order !== expectedRootOrder) return false;
      expectedRootOrder++;
    }
    if (!visit(rootId, null, new Set())) return false;
  }

  return visited.size === allIds.length;
}

export function findBodyContainerId(doc: TemplateDocumentV1): string | null {
  for (const rootId of doc.rootNodeIds) {
    const node = doc.nodes[rootId];
    if (node?.type === 'container' && node.props.semanticRole === 'BODY') {
      return node.id;
    }
  }
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'container' && node.props.semanticRole === 'BODY') {
      return node.id;
    }
  }
  return null;
}

export function isInHeaderOrFooterZone(doc: TemplateDocumentV1, nodeId: string): boolean {
  let cursor: TemplateNode | undefined = doc.nodes[nodeId];
  while (cursor) {
    if (cursor.type === 'header' || cursor.type === 'footer') return true;
    cursor = cursor.parentId ? doc.nodes[cursor.parentId] : undefined;
  }
  return false;
}

function defaultAbsoluteSizeMm(type: TemplateNodeType, printableWidthMm: number): { width: number; height: number } {
  switch (type) {
    case 'text':
      return { width: 60, height: 8 };
    case 'richText':
      return { width: 80, height: 16 };
    case 'dataField':
      return { width: 50, height: 6 };
    case 'image':
      return { width: 40, height: 20 };
    case 'divider':
      return { width: 80, height: 0.5 };
    case 'staticTable':
      return { width: 120, height: 30 };
    case 'dynamicTable':
      return { width: Math.max(20, roundMm(printableWidthMm)), height: 60 };
    case 'formula':
      return { width: 30, height: 6 };
    case 'totals':
      return { width: 74, height: 30 };
    default:
      return { width: 60, height: 20 };
  }
}

function maxZIndexOnPage(doc: TemplateDocumentV1, pageIndex: number): number {
  let maxZ = 0;
  for (const node of collectPageNodes(doc, pageIndex)) {
    if (node.layout.kind === 'ABSOLUTE') {
      maxZ = Math.max(maxZ, node.layout.zIndex);
    }
  }
  return maxZ;
}

export function insertNodeInDocument(
  doc: TemplateDocumentV1,
  input: NewTemplateNode,
  pageIndex: number,
  selectedIds: readonly string[],
  at?: { parentId?: string | null; index?: number },
): string {
  const id = newDesignerUuid();
  const isFixedCanvas = doc.layoutMode === 'FIXED_CANVAS';

  let parentId: string | null = at?.parentId ?? null;
  let insertIndex = at?.index;

  if (isFixedCanvas) {
    const page = currentPageConfig(doc, pageIndex);
    const printable = page ? printableRectMm(page) : { x: 12, y: 12, width: 186, height: 273 };
    const defSize = defaultAbsoluteSizeMm(input.type, printable.width);
    const providedLayout = input.layout?.kind === 'ABSOLUTE' ? input.layout : null;
    const width = providedLayout ? providedLayout.width : defSize.width;
    const height = providedLayout ? providedLayout.height : defSize.height;
    const x = providedLayout
      ? providedLayout.x
      : clamp(roundMm(printable.x + (printable.width - width) / 2), 0, 500);
    const y = providedLayout
      ? providedLayout.y
      : clamp(roundMm(printable.y + (printable.height - height) / 2), 0, 1000);
    const zIndex = clamp(maxZIndexOnPage(doc, pageIndex) + 1, 0, 1000);

    const layout: TemplateNodeLayout = {
      kind: 'ABSOLUTE',
      unit: 'MM',
      x,
      y,
      width,
      height,
      rotationDeg: providedLayout?.rotationDeg ?? 0,
      zIndex,
    };

    if (at?.parentId === undefined) {
      if (doc.canvasPages && doc.canvasPages.length > 0) {
        parentId = null;
      } else {
        parentId = findBodyContainerId(doc);
      }
    }

    const node = {
      ...input,
      id,
      parentId,
      childIds: [],
      locked: input.locked ?? false,
      hidden: input.hidden ?? false,
      layout,
      style: input.style ?? {},
    } as TemplateNode;

    doc.nodes[id] = node;

    if (parentId !== null && doc.nodes[parentId]) {
      const children = doc.nodes[parentId].childIds;
      const idx = insertIndex !== undefined ? clamp(insertIndex, 0, children.length) : children.length;
      children.splice(idx, 0, id);
    } else if (doc.canvasPages && doc.canvasPages.length > 0) {
      const safePageIdx = Math.max(0, Math.min(pageIndex, doc.canvasPages.length - 1));
      const roots = doc.canvasPages[safePageIdx].rootNodeIds;
      const idx = insertIndex !== undefined ? clamp(insertIndex, 0, roots.length) : roots.length;
      roots.splice(idx, 0, id);
      syncCanvasPagesRootIds(doc);
    } else {
      const idx = insertIndex !== undefined ? clamp(insertIndex, 0, doc.rootNodeIds.length) : doc.rootNodeIds.length;
      doc.rootNodeIds.splice(idx, 0, id);
    }
    normalizeFlowOrders(doc);
    return id;
  }

  // FLOW / HYBRID / EMAIL -> FLOW layout
  if (at?.parentId === undefined) {
    const lastSelId = selectedIds[selectedIds.length - 1];
    const lastSel = lastSelId ? doc.nodes[lastSelId] : undefined;
    const bodyId = findBodyContainerId(doc);

    if (lastSel && lastSel.type === 'container' && lastSel.props.semanticRole === 'BODY') {
      parentId = lastSel.id;
    } else if (lastSel && lastSel.layout.kind === 'FLOW' && lastSel.parentId !== null) {
      const parent = doc.nodes[lastSel.parentId];
      if (parent && parent.type !== 'row') {
        const restrictedInZone =
          isInHeaderOrFooterZone(doc, parent.id) &&
          (input.type === 'dynamicTable' || input.type === 'totals' || input.type === 'pageBreak');
        if (!restrictedInZone) {
          parentId = parent.id;
          const pos = parent.childIds.indexOf(lastSel.id);
          if (pos >= 0) insertIndex = pos + 1;
        }
      }
    }

    if (parentId === null && bodyId && doc.nodes[bodyId]) {
      parentId = bodyId;
    }
  }

  const layout: TemplateNodeLayout =
    input.layout?.kind === 'FLOW' ? { ...input.layout } : { kind: 'FLOW', order: 0 };

  const node = {
    ...input,
    id,
    parentId,
    childIds: [],
    locked: input.locked ?? false,
    hidden: input.hidden ?? false,
    layout,
    style: input.style ?? {},
  } as TemplateNode;

  doc.nodes[id] = node;

  if (parentId !== null && doc.nodes[parentId]) {
    const children = doc.nodes[parentId].childIds;
    const idx = insertIndex !== undefined ? clamp(insertIndex, 0, children.length) : children.length;
    children.splice(idx, 0, id);
  } else {
    const idx = insertIndex !== undefined ? clamp(insertIndex, 0, doc.rootNodeIds.length) : doc.rootNodeIds.length;
    doc.rootNodeIds.splice(idx, 0, id);
  }

  normalizeFlowOrders(doc);
  return id;
}

export function removeNodesFromDocument(
  doc: TemplateDocumentV1,
  ids: readonly string[],
): { removedIds: string[]; skippedLocked: boolean } {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => Boolean(doc.nodes[id]));
  let skippedLocked = false;
  const removableRoots: string[] = [];

  for (const id of uniqueIds) {
    const node = doc.nodes[id];
    if (!node) continue;
    if (node.locked) {
      skippedLocked = true;
      continue;
    }
    removableRoots.push(id);
  }

  if (removableRoots.length === 0) {
    return { removedIds: [], skippedLocked };
  }

  const toDelete = new Set<string>();
  for (const rootId of removableRoots) {
    for (const subId of collectSubtreeIds(doc, rootId)) {
      toDelete.add(subId);
    }
  }

  for (const id of toDelete) {
    const node = doc.nodes[id];
    if (node?.parentId && !toDelete.has(node.parentId) && doc.nodes[node.parentId]) {
      doc.nodes[node.parentId].childIds = doc.nodes[node.parentId].childIds.filter((cid) => !toDelete.has(cid));
    }
  }

  doc.rootNodeIds = doc.rootNodeIds.filter((id) => !toDelete.has(id));
  if (doc.canvasPages) {
    for (const page of doc.canvasPages) {
      page.rootNodeIds = page.rootNodeIds.filter((id) => !toDelete.has(id));
    }
    syncCanvasPagesRootIds(doc);
  }

  for (const id of toDelete) {
    delete doc.nodes[id];
  }

  normalizeFlowOrders(doc);
  return { removedIds: Array.from(toDelete), skippedLocked };
}

function rewriteFormulaRefs(
  expr: TemplateFormulaExpression,
  formulaIdMap: ReadonlyMap<string, string>,
): TemplateFormulaExpression {
  switch (expr.kind) {
    case 'FORMULA_REF':
      return { ...expr, formulaId: formulaIdMap.get(expr.formulaId) ?? expr.formulaId };
    case 'FUNCTION_CALL':
      return {
        ...expr,
        arguments: expr.arguments.map((arg) => ({
          ...arg,
          expression: rewriteFormulaRefs(arg.expression, formulaIdMap),
        })),
      };
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'SUM':
    case 'MIN':
    case 'MAX':
    case 'COALESCE':
    case 'CONCAT':
      return {
        ...expr,
        operands: expr.operands.map((op) => rewriteFormulaRefs(op, formulaIdMap)),
      };
    case 'DIVIDE':
      return {
        ...expr,
        dividend: rewriteFormulaRefs(expr.dividend, formulaIdMap),
        divisor: rewriteFormulaRefs(expr.divisor, formulaIdMap),
      };
    case 'ROUND':
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
      return { ...expr, value: rewriteFormulaRefs(expr.value, formulaIdMap) };
    case 'DATE_ADD_DAYS':
      return {
        ...expr,
        date: rewriteFormulaRefs(expr.date, formulaIdMap),
        days: rewriteFormulaRefs(expr.days, formulaIdMap),
      };
    case 'DATE_DIFF_DAYS':
    case 'COMPARE':
      return {
        ...expr,
        left: rewriteFormulaRefs(expr.left, formulaIdMap),
        right: rewriteFormulaRefs(expr.right, formulaIdMap),
      };
    case 'IF':
      return {
        ...expr,
        condition: rewriteFormulaRefs(expr.condition, formulaIdMap),
        whenTrue: rewriteFormulaRefs(expr.whenTrue, formulaIdMap),
        whenFalse: rewriteFormulaRefs(expr.whenFalse, formulaIdMap),
      };
    case 'SUM_ROWS':
      return { ...expr, item: rewriteFormulaRefs(expr.item, formulaIdMap) };
    default:
      return expr;
  }
}

function rewriteTableBands(
  bands: TemplateTableBand[] | undefined,
  colMap: ReadonlyMap<string, string>,
  formulaIdMap: ReadonlyMap<string, string>,
): TemplateTableBand[] | undefined {
  if (!bands) return undefined;
  return bands.map((band) => ({
    ...band,
    id: newDesignerUuid(),
    rows: band.rows.map((row) => ({
      ...row,
      id: newDesignerUuid(),
      cells: row.cells.map((cell) => ({
        ...cell,
        id: newDesignerUuid(),
        columnId: colMap.get(cell.columnId) ?? cell.columnId,
        value:
          cell.value.kind === 'FORMULA'
            ? { ...cell.value, expression: rewriteFormulaRefs(cell.value.expression, formulaIdMap) }
            : cell.value,
      })),
    })),
  }));
}

export function duplicateNodesInDocument(
  doc: TemplateDocumentV1,
  ids: readonly string[],
  pageIndex: number,
): string[] {
  const selectedSet = new Set(ids.filter((id) => Boolean(doc.nodes[id])));
  const topIds = ids.filter((id) => {
    let cursor = doc.nodes[id]?.parentId ?? null;
    while (cursor) {
      if (selectedSet.has(cursor)) return false;
      cursor = doc.nodes[cursor]?.parentId ?? null;
    }
    return Boolean(doc.nodes[id]);
  });

  if (topIds.length === 0) return [];

  const subtreeIds: string[] = [];
  for (const id of topIds) {
    collectSubtreeIds(doc, id, subtreeIds);
  }

  const idMap = new Map<string, string>();
  const formulaIdMap = new Map<string, string>();
  for (const oldId of subtreeIds) {
    idMap.set(oldId, newDesignerUuid());
    const oldNode = doc.nodes[oldId];
    if (oldNode?.type === 'formula') {
      formulaIdMap.set(oldNode.props.formulaId, newDesignerUuid());
    }
  }

  let nextZ = maxZIndexOnPage(doc, pageIndex) + 1;
  const newTopIds: string[] = [];

  for (const oldId of subtreeIds) {
    const source = doc.nodes[oldId];
    const copy = structuredClone(source);
    const newId = idMap.get(oldId)!;
    copy.id = newId;
    copy.parentId = source.parentId && idMap.has(source.parentId) ? idMap.get(source.parentId)! : source.parentId;
    copy.childIds = source.childIds.map((cid) => idMap.get(cid) ?? cid);

    if (copy.layout.kind === 'ABSOLUTE') {
      copy.layout.x = clamp(roundMm(copy.layout.x + 5), 0, 500);
      copy.layout.y = clamp(roundMm(copy.layout.y + 5), 0, 1000);
      copy.layout.zIndex = clamp(nextZ++, 0, 1000);
    }

    if (copy.type === 'staticTable') {
      const colMap = new Map<string, string>();
      copy.props.columns = copy.props.columns.map((col) => {
        const nextColId = newDesignerUuid();
        colMap.set(col.id, nextColId);
        return { ...col, id: nextColId };
      });
      copy.props.rows = copy.props.rows.map((row) => ({
        ...row,
        id: newDesignerUuid(),
        cells: row.cells.map((cell) => ({
          ...cell,
          id: newDesignerUuid(),
          columnId: colMap.get(cell.columnId) ?? cell.columnId,
          value:
            cell.value.kind === 'FORMULA'
              ? { ...cell.value, expression: rewriteFormulaRefs(cell.value.expression, formulaIdMap) }
              : cell.value,
        })),
      }));
    } else if (copy.type === 'dynamicTable') {
      const colMap = new Map<string, string>();
      copy.props.columns = copy.props.columns.map((col): TemplateDynamicTableColumn => {
        const nextColId = newDesignerUuid();
        colMap.set(col.id, nextColId);
        const header =
          col.header.kind === 'FORMULA'
            ? { ...col.header, expression: rewriteFormulaRefs(col.header.expression, formulaIdMap) }
            : col.header;
        if ('value' in col) {
          const value =
            col.value.kind === 'FORMULA'
              ? { ...col.value, expression: rewriteFormulaRefs(col.value.expression, formulaIdMap) }
              : col.value;
          return { ...col, id: nextColId, header, value };
        }
        return { ...col, id: nextColId, header };
      });
      copy.props.headerBands = rewriteTableBands(copy.props.headerBands, colMap, formulaIdMap);
      copy.props.footerBands = rewriteTableBands(copy.props.footerBands, colMap, formulaIdMap);
    } else if (copy.type === 'totals') {
      copy.props.rows = copy.props.rows.map((row) => ({ ...row, id: newDesignerUuid() }));
    } else if (copy.type === 'formula') {
      copy.props.formulaId = formulaIdMap.get(copy.props.formulaId) ?? newDesignerUuid();
      copy.props.expression = rewriteFormulaRefs(copy.props.expression, formulaIdMap);
    }

    doc.nodes[newId] = copy;
  }

  for (const oldTopId of topIds) {
    const newTopId = idMap.get(oldTopId)!;
    newTopIds.push(newTopId);
    const source = doc.nodes[oldTopId];
    const copy = doc.nodes[newTopId];
    if (!source || !copy) continue;

    if (source.parentId !== null && doc.nodes[source.parentId]) {
      const siblings = doc.nodes[source.parentId].childIds;
      const idx = siblings.indexOf(oldTopId);
      if (copy.layout.kind === 'FLOW' && idx >= 0) {
        siblings.splice(idx + 1, 0, newTopId);
      } else {
        siblings.push(newTopId);
      }
    } else if (doc.canvasPages && doc.canvasPages.length > 0) {
      const targetPage =
        doc.canvasPages.find((p) => p.rootNodeIds.includes(oldTopId)) ??
        doc.canvasPages[Math.max(0, Math.min(pageIndex, doc.canvasPages.length - 1))];
      targetPage.rootNodeIds.push(newTopId);
      syncCanvasPagesRootIds(doc);
    } else {
      const idx = doc.rootNodeIds.indexOf(oldTopId);
      if (copy.layout.kind === 'FLOW' && idx >= 0) {
        doc.rootNodeIds.splice(idx + 1, 0, newTopId);
      } else {
        doc.rootNodeIds.push(newTopId);
      }
    }
  }

  normalizeFlowOrders(doc);
  return newTopIds;
}

export function updateFrameInDocument(
  doc: TemplateDocumentV1,
  ids: readonly string[],
  change: {
    dx?: number;
    dy?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotationDeg?: number;
  },
): boolean {
  let changed = false;
  for (const id of ids) {
    const node = doc.nodes[id];
    if (!node || node.locked || node.layout.kind !== 'ABSOLUTE') continue;

    const next = clampFrameMm({
      x: change.x !== undefined ? change.x : node.layout.x + (change.dx ?? 0),
      y: change.y !== undefined ? change.y : node.layout.y + (change.dy ?? 0),
      width: change.width !== undefined ? change.width : node.layout.width,
      height: change.height !== undefined ? change.height : node.layout.height,
      rotationDeg: change.rotationDeg !== undefined ? change.rotationDeg : node.layout.rotationDeg,
    });

    node.layout = {
      ...node.layout,
      ...next,
    };
    changed = true;
  }
  return changed;
}

export function moveInFlowInDocument(doc: TemplateDocumentV1, id: string, delta: -1 | 1): boolean {
  const node = doc.nodes[id];
  if (!node || node.locked || node.layout.kind !== 'FLOW') return false;

  const list = node.parentId ? doc.nodes[node.parentId]?.childIds : doc.rootNodeIds;
  if (!list) return false;

  const index = list.indexOf(id);
  const targetIndex = index + delta;
  if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return false;

  const [item] = list.splice(index, 1);
  list.splice(targetIndex, 0, item);
  normalizeFlowOrders(doc);
  return true;
}

export function arrangeNodesInDocument(
  doc: TemplateDocumentV1,
  ids: readonly string[],
  op: 'FRONT' | 'BACK' | 'FORWARD' | 'BACKWARD',
  pageIndex: number,
): boolean {
  const selectedSet = new Set(ids);
  const absNodes = collectPageNodes(doc, pageIndex)
    .filter((node) => node.layout.kind === 'ABSOLUTE')
    .sort((a, b) => {
      if (a.layout.kind !== 'ABSOLUTE' || b.layout.kind !== 'ABSOLUTE') return 0;
      return a.layout.zIndex - b.layout.zIndex;
    });

  if (absNodes.length === 0) return false;
  const anyUnlockedSelected = absNodes.some((n) => selectedSet.has(n.id) && !n.locked);
  if (!anyUnlockedSelected) return false;

  let ordered = absNodes.map((n) => n.id);
  const isMovable = (id: string) => selectedSet.has(id) && !doc.nodes[id]?.locked;

  if (op === 'FRONT') {
    ordered = [
      ...ordered.filter((id) => !isMovable(id)),
      ...ordered.filter((id) => isMovable(id)),
    ];
  } else if (op === 'BACK') {
    ordered = [
      ...ordered.filter((id) => isMovable(id)),
      ...ordered.filter((id) => !isMovable(id)),
    ];
  } else if (op === 'FORWARD') {
    for (let i = ordered.length - 2; i >= 0; i--) {
      if (isMovable(ordered[i]) && !isMovable(ordered[i + 1])) {
        [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
      }
    }
  } else if (op === 'BACKWARD') {
    for (let i = 1; i < ordered.length; i++) {
      if (isMovable(ordered[i]) && !isMovable(ordered[i - 1])) {
        [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
      }
    }
  }

  ordered.forEach((id, idx) => {
    const node = doc.nodes[id];
    if (node && node.layout.kind === 'ABSOLUTE') {
      node.layout.zIndex = clamp(idx + 1, 0, 1000);
    }
  });
  return true;
}

export function alignNodesInDocument(
  doc: TemplateDocumentV1,
  ids: readonly string[],
  edge: 'START' | 'CENTER_H' | 'END' | 'TOP' | 'CENTER_V' | 'BOTTOM',
  page: TemplatePageConfig,
): boolean {
  const targets = ids
    .map((id) => doc.nodes[id])
    .filter((node): node is TemplateNode => Boolean(node && !node.locked && node.layout.kind === 'ABSOLUTE'));

  if (targets.length === 0) return false;

  const frames: RectMm[] = targets.map((node) => {
    const l = node.layout as Extract<TemplateNodeLayout, { kind: 'ABSOLUTE' }>;
    return { x: l.x, y: l.y, width: l.width, height: l.height };
  });

  const reference = targets.length === 1 ? printableRectMm(page) : boundingRectMm(frames);
  if (!reference) return false;

  for (const node of targets) {
    if (node.layout.kind !== 'ABSOLUTE') continue;
    let nextX = node.layout.x;
    let nextY = node.layout.y;
    switch (edge) {
      case 'START':
        nextX = reference.x;
        break;
      case 'CENTER_H':
        nextX = reference.x + (reference.width - node.layout.width) / 2;
        break;
      case 'END':
        nextX = reference.x + reference.width - node.layout.width;
        break;
      case 'TOP':
        nextY = reference.y;
        break;
      case 'CENTER_V':
        nextY = reference.y + (reference.height - node.layout.height) / 2;
        break;
      case 'BOTTOM':
        nextY = reference.y + reference.height - node.layout.height;
        break;
    }
    node.layout.x = clamp(roundMm(nextX), 0, 500);
    node.layout.y = clamp(roundMm(nextY), 0, 1000);
  }

  return true;
}
