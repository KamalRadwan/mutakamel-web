import type {
  TemplateCanvasPage,
  TemplateDocumentV1,
  TemplateDynamicTableColumn,
  TemplateFormulaExpression,
  TemplatePageConfig,
  TemplateTableBand,
} from '../../templates.model';
import {
  collectSubtreeIds,
  newDesignerUuid,
  normalizeFlowOrders,
  syncCanvasPagesRootIds,
} from '../document-ops';

export const MAX_CANVAS_PAGES = 100;

function defaultPageConfig(doc: TemplateDocumentV1): TemplatePageConfig {
  if (doc.page) return structuredClone(doc.page);
  return {
    unit: 'MM',
    preset: 'A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'PORTRAIT',
    marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
    bleedMm: 0,
  };
}

/** Materializes page 1 from legacy single-page fields when canvasPages is absent or empty. */
export function ensureCanvasPages(doc: TemplateDocumentV1, defaultPage1Name: string): TemplateCanvasPage[] {
  if (doc.canvasPages && doc.canvasPages.length > 0) {
    return doc.canvasPages;
  }
  const pageConfig = defaultPageConfig(doc);
  const pages: TemplateCanvasPage[] = [
    {
      id: newDesignerUuid(),
      name: defaultPage1Name,
      page: pageConfig,
      rootNodeIds: [...doc.rootNodeIds],
    },
  ];
  doc.canvasPages = pages;
  syncCanvasPagesRootIds(doc);
  return pages;
}

export function effectivePages(doc: TemplateDocumentV1, defaultPage1Name: string): readonly TemplateCanvasPage[] {
  if (doc.canvasPages && doc.canvasPages.length > 0) {
    return doc.canvasPages;
  }
  return [
    {
      id: 'legacy-page-1',
      name: defaultPage1Name,
      page: defaultPageConfig(doc),
      rootNodeIds: doc.rootNodeIds,
    },
  ];
}

export function addCanvasPage(
  doc: TemplateDocumentV1,
  currentIndex: number,
  newPageName: string,
  defaultPage1Name: string,
): number {
  const pages = ensureCanvasPages(doc, defaultPage1Name);
  if (pages.length >= MAX_CANVAS_PAGES) return -1;

  const safeIdx = Math.max(0, Math.min(currentIndex, pages.length - 1));
  const templatePage = structuredClone(pages[safeIdx].page);
  pages.push({
    id: newDesignerUuid(),
    name: newPageName,
    page: templatePage,
    rootNodeIds: [],
  });
  syncCanvasPagesRootIds(doc);
  return pages.length - 1;
}

export function renameCanvasPage(
  doc: TemplateDocumentV1,
  index: number,
  rawName: string,
  defaultPage1Name: string,
): boolean {
  const clean = rawName.replace(/[\r\n]+/g, ' ').trim();
  if (!clean || clean.length > 100) return false;
  const pages = ensureCanvasPages(doc, defaultPage1Name);
  const target = pages[index];
  if (!target) return false;
  target.name = clean;
  return true;
}

export function moveCanvasPage(doc: TemplateDocumentV1, index: number, delta: -1 | 1): number {
  const pages = doc.canvasPages;
  if (!pages || pages.length < 2) return index;
  const target = index + delta;
  if (index < 0 || index >= pages.length || target < 0 || target >= pages.length) return index;
  const [moved] = pages.splice(index, 1);
  pages.splice(target, 0, moved);
  syncCanvasPagesRootIds(doc);
  normalizeFlowOrders(doc);
  return target;
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

export function duplicateCanvasPage(
  doc: TemplateDocumentV1,
  index: number,
  copyName: string,
  defaultPage1Name: string,
): number {
  const pages = ensureCanvasPages(doc, defaultPage1Name);
  if (pages.length >= MAX_CANVAS_PAGES) return -1;
  const sourcePage = pages[index];
  if (!sourcePage) return -1;

  const subtreeIds: string[] = [];
  for (const rootId of sourcePage.rootNodeIds) {
    collectSubtreeIds(doc, rootId, subtreeIds);
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

  for (const oldId of subtreeIds) {
    const source = doc.nodes[oldId];
    if (!source) continue;
    const copy = structuredClone(source);
    const newId = idMap.get(oldId)!;
    copy.id = newId;
    copy.parentId = source.parentId ? (idMap.get(source.parentId) ?? null) : null;
    copy.childIds = source.childIds.map((cid) => idMap.get(cid) ?? cid);

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

  const newPage: TemplateCanvasPage = {
    id: newDesignerUuid(),
    name: copyName.slice(0, 100),
    page: structuredClone(sourcePage.page),
    rootNodeIds: sourcePage.rootNodeIds.map((rid) => idMap.get(rid) ?? rid),
  };

  pages.splice(index + 1, 0, newPage);
  syncCanvasPagesRootIds(doc);
  normalizeFlowOrders(doc);
  return index + 1;
}

export function deleteCanvasPage(doc: TemplateDocumentV1, index: number): number {
  const pages = doc.canvasPages;
  if (!pages || pages.length <= 1) return index;
  const target = pages[index];
  if (!target) return index;

  const toRemove = new Set<string>();
  for (const rootId of target.rootNodeIds) {
    for (const id of collectSubtreeIds(doc, rootId)) {
      toRemove.add(id);
    }
  }
  for (const id of toRemove) {
    delete doc.nodes[id];
  }

  pages.splice(index, 1);
  syncCanvasPagesRootIds(doc);
  normalizeFlowOrders(doc);
  return Math.max(0, Math.min(index, pages.length - 1));
}

export function countPageObjects(doc: TemplateDocumentV1, index: number, defaultPage1Name: string): number {
  const pages = effectivePages(doc, defaultPage1Name);
  const page = pages[index];
  if (!page) return 0;
  const seen = new Set<string>();
  for (const rootId of page.rootNodeIds) {
    for (const id of collectSubtreeIds(doc, rootId)) {
      seen.add(id);
    }
  }
  return seen.size;
}
