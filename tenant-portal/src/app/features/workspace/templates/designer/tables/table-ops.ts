import type {
  TemplateBinding,
  TemplateCompareOperator,
  TemplateDataSourceSchemaDto,
  TemplateDocumentV1,
  TemplateFieldDataType,
  TemplateFormulaDimension,
  TemplateFormulaExpression,
  TemplateFormulaNode,
  TemplatePageConfig,
  TemplateSchemaField,
  TemplateStaticTableColumn,
  TemplateTableCell,
  TemplateTableCellStyle,
  TemplateTableCellValue,
  TemplateTableRow,
  TemplateTotalsRow,
} from '../../templates.model';
import { type NewTemplateNode, newDesignerUuid } from '../document-ops';
import { printableRectMm, roundMm } from '../geometry';

export interface FieldPickCallOptions {
  purpose: 'DATA_FIELD' | 'BINDING' | 'PATH';
  accept: 'SCALAR' | 'ARRAY' | 'ROW_SCALAR' | 'URL' | 'ANY';
  rowArrayPath?: string;
  dataTypes?: readonly TemplateFieldDataType[];
  initial?: TemplateBinding | { path: string };
  titleKey?: string;
}

export interface FieldPickCallResult {
  path: string;
  field: TemplateSchemaField;
  binding?: TemplateBinding;
}

export type OpenFieldPickerFn = (options: FieldPickCallOptions) => Promise<FieldPickCallResult | null>;

export interface OtherFormulaOption {
  formulaId: string;
  name: string;
}

export const MAX_TABLE_COLUMNS = 30;
export const MAX_STATIC_TABLE_ROWS = 100;
export const MAX_DYNAMIC_EMPTY_ROWS = 100;
export const MAX_DYNAMIC_ROW_BUDGET = 2000;
export const MAX_TOTALS_ROWS = 20;
export const MAX_FORMULA_STEPS = 100;
export const WIDTH_FIT_TOLERANCE = 0.001;
export const DEFAULT_STATIC_TABLE_WIDTH_MM = 120;
export const DEFAULT_STATIC_TABLE_HEIGHT_MM = 30;

const SAFE_COLOR_RE = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

export function isValidSafeColor(value: string): boolean {
  const trimmed = value.trim();
  return SAFE_COLOR_RE.test(trimmed);
}

export function normalizeSafeColor(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return SAFE_COLOR_RE.test(trimmed) ? trimmed.toUpperCase() : undefined;
}

export function defaultDocumentHeaderText(locale: string, kind: 'ITEM' | 'PRODUCT_IMAGE'): string {
  const isAr = locale.toLowerCase().startsWith('ar');
  if (kind === 'PRODUCT_IMAGE') {
    return isAr ? 'صورة المنتج' : 'Product image';
  }
  return isAr ? 'البند' : 'Item';
}

export function roundToDecimals(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function scaleNumbersToTarget(values: readonly number[], target: number, decimals = 3): number[] {
  if (values.length === 0) return [];
  if (target <= 0) return values.map((v) => v);

  const positive = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 1));
  const sum = positive.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) {
    const equal = roundToDecimals(target / values.length, decimals);
    const out = values.map(() => equal);
    const used = equal * (values.length - 1);
    out[out.length - 1] = roundToDecimals(Math.max(0.001, target - used), decimals);
    return out;
  }

  const out: number[] = [];
  let running = 0;
  for (let i = 0; i < positive.length; i++) {
    if (i === positive.length - 1) {
      out.push(roundToDecimals(Math.max(0.001, target - running), decimals));
    } else {
      const scaled = roundToDecimals(Math.max(0.001, (positive[i] / sum) * target), decimals);
      out.push(scaled);
      running = roundToDecimals(running + scaled, decimals);
    }
  }
  return out;
}

export function createEmptyTextCell(columnId: string, text = ''): TemplateTableCell {
  return {
    id: newDesignerUuid(),
    columnId,
    value: { kind: 'TEXT', value: text },
  };
}

export function buildNewStaticTableNode(doc: TemplateDocumentV1): NewTemplateNode {
  const isFixed = doc.layoutMode === 'FIXED_CANVAS';
  const unit: 'MM' | 'PERCENT' = isFixed ? 'MM' : 'PERCENT';
  const colWidths = isFixed ? [40, 40, 40] : [33.333, 33.333, 33.334];

  const columns: TemplateStaticTableColumn[] = colWidths.map((value) => ({
    id: newDesignerUuid(),
    width: { value, unit },
    align: 'START',
    verticalAlign: 'MIDDLE',
    wrap: true,
    visible: true,
  }));

  const rows: TemplateTableRow[] = [0, 1, 2].map(() => ({
    id: newDesignerUuid(),
    cells: columns.map((col) => createEmptyTextCell(col.id, '')),
  }));

  return {
    type: 'staticTable',
    props: {
      columns,
      rows,
      repeatHeader: 'EVERY_PAGE',
      keepRowsTogether: false,
      rowSplit: 'ALLOW',
      stripedRows: false,
      ...(isFixed
        ? {
            fixedCanvas: {
              rowHeightsMm: [8, 8, 8],
              overflow: 'REJECT' as const,
              wrapCells: true,
            },
          }
        : {}),
    },
  };
}

export function findFirstRowScalarField(
  schema: TemplateDataSourceSchemaDto | null,
  sourcePath: string,
): TemplateSchemaField | null {
  if (!schema) return null;
  const prefix = `${sourcePath}[].`;
  const rowFields = schema.fields.filter(
    (f) => f.path.startsWith(prefix) && f.dataType !== 'ARRAY' && f.dataType !== 'OBJECT' && f.dataType !== 'IMAGE',
  );
  return rowFields.find((f) => f.dataType === 'STRING') ?? rowFields[0] ?? null;
}

export function hasSourceProductImage(schema: TemplateDataSourceSchemaDto | null, sourcePath: string): boolean {
  if (!schema || !sourcePath) return false;
  const targetPath = `${sourcePath}[].itemImage`;
  return schema.fields.some((f) => f.path === targetPath && f.dataType === 'IMAGE');
}

export function buildNewDynamicTableNode(
  doc: TemplateDocumentV1,
  page: TemplatePageConfig | null,
  schema: TemplateDataSourceSchemaDto | null,
  sourcePath: string,
  defaultHeaderText = defaultDocumentHeaderText(doc.locale, 'ITEM'),
): NewTemplateNode {
  const isFixed = doc.layoutMode === 'FIXED_CANVAS';
  const frameWidth = page ? Math.max(20, roundMm(printableRectMm(page).width)) : 186;
  const firstField = findFirstRowScalarField(schema, sourcePath);

  const value: TemplateTableCellValue = firstField
    ? { kind: 'BINDING', binding: { path: firstField.path, nullBehavior: 'EMPTY' } }
    : { kind: 'TEXT', value: '' };

  return {
    type: 'dynamicTable',
    props: {
      sourcePath,
      columns: [
        {
          id: newDesignerUuid(),
          width: isFixed ? { value: frameWidth, unit: 'MM' } : { value: 100, unit: 'PERCENT' },
          align: 'START',
          verticalAlign: 'MIDDLE',
          wrap: true,
          visible: true,
          header: { kind: 'TEXT', value: defaultHeaderText },
          value,
        },
      ],
      repeatHeader: 'EVERY_PAGE',
      keepRowsTogether: false,
      rowSplit: 'ALLOW',
      minimumEmptyRows: 0,
      emptyBehavior: 'HEADER_ONLY',
      stripedRows: false,
      ...(isFixed
        ? {
            fixedCanvas: {
              maxRenderedRows: 20,
              overflow: 'REJECT' as const,
            },
          }
        : {}),
    },
  };
}

export function buildEmptyTotalsRow(): TemplateTotalsRow {
  return {
    id: newDesignerUuid(),
    label: '',
    binding: { path: '', nullBehavior: 'EMPTY' },
    emphasis: 'NORMAL',
    visible: true,
  };
}

export function collectOtherFormulas(
  doc: TemplateDocumentV1 | null,
  excludeFormulaId?: string,
  fallbackName?: (index: number) => string,
): OtherFormulaOption[] {
  if (!doc) return [];
  const formulaNodes = Object.values(doc.nodes).filter(
    (n): n is TemplateFormulaNode => n.type === 'formula',
  );
  const out: OtherFormulaOption[] = [];
  let counter = 0;
  for (const node of formulaNodes) {
    counter++;
    if (excludeFormulaId && node.props.formulaId === excludeFormulaId) continue;
    const trimmed = node.name?.trim();
    const name = trimmed || (fallbackName ? fallbackName(counter) : `Formula ${counter}`);
    out.push({ formulaId: node.props.formulaId, name });
  }
  return out;
}

export interface StaticGridCellCoverage {
  coveredBy: Map<string, { anchorRow: number; anchorCol: number }>;
}

export function computeStaticTableCoverage(
  columns: readonly TemplateStaticTableColumn[],
  rows: readonly TemplateTableRow[],
): StaticGridCellCoverage {
  const colIndexById = new Map(columns.map((c, idx) => [c.id, idx]));
  const coveredBy = new Map<string, { anchorRow: number; anchorCol: number }>();

  for (let r = 0; r < rows.length; r++) {
    for (const cell of rows[r].cells) {
      const c = colIndexById.get(cell.columnId);
      if (c === undefined) continue;
      const rowSpan = Math.max(1, cell.rowSpan ?? 1);
      const colSpan = Math.max(1, cell.colSpan ?? 1);
      if (rowSpan === 1 && colSpan === 1) continue;
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < rows.length && cc < columns.length) {
            const key = `${rr}:${cc}`;
            if (!coveredBy.has(key)) {
              coveredBy.set(key, { anchorRow: r, anchorCol: c });
            }
          }
        }
      }
    }
  }

  return { coveredBy };
}

export function isTableCellValueNonEmpty(value: TemplateTableCellValue | undefined): boolean {
  if (!value) return false;
  if (value.kind === 'TEXT') return value.value.trim().length > 0;
  if (value.kind === 'BINDING') return value.binding.path.trim().length > 0;
  return true;
}

export interface CellMergeValidationResult {
  valid: boolean;
  reason: 'OUT_OF_BOUNDS' | 'OVERLAP' | null;
  coveredWithContent: { rowIndex: number; colIndex: number }[];
  coveredAll: { rowIndex: number; colIndex: number }[];
}

export function validateStaticCellMerge(
  rows: readonly TemplateTableRow[],
  columns: readonly TemplateStaticTableColumn[],
  targetRow: number,
  targetCol: number,
  newRowSpan: number,
  newColSpan: number,
): CellMergeValidationResult {
  if (
    newRowSpan < 1 ||
    newColSpan < 1 ||
    targetRow + newRowSpan > rows.length ||
    targetCol + newColSpan > columns.length
  ) {
    return { valid: false, reason: 'OUT_OF_BOUNDS', coveredWithContent: [], coveredAll: [] };
  }

  const colIndexById = new Map(columns.map((c, idx) => [c.id, idx]));
  const targetR2 = targetRow + newRowSpan - 1;
  const targetC2 = targetCol + newColSpan - 1;

  for (let r = 0; r < rows.length; r++) {
    for (const cell of rows[r].cells) {
      const c = colIndexById.get(cell.columnId);
      if (c === undefined) continue;
      if (r === targetRow && c === targetCol) continue;

      const rSpan = Math.max(1, cell.rowSpan ?? 1);
      const cSpan = Math.max(1, cell.colSpan ?? 1);
      const r2 = r + rSpan - 1;
      const c2 = c + cSpan - 1;

      // Another cell overlaps our target rectangle if its own span rect intersects ours.
      // Single-cell targets inside our rectangle are allowed (they get covered/cleared unless already merged).
      const intersects = r <= targetR2 && r2 >= targetRow && c <= targetC2 && c2 >= targetCol;
      if (intersects && (rSpan > 1 || cSpan > 1)) {
        return { valid: false, reason: 'OVERLAP', coveredWithContent: [], coveredAll: [] };
      }
    }
  }

  const coveredWithContent: { rowIndex: number; colIndex: number }[] = [];
  const coveredAll: { rowIndex: number; colIndex: number }[] = [];
  for (let dr = 0; dr < newRowSpan; dr++) {
    for (let dc = 0; dc < newColSpan; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = targetRow + dr;
      const cc = targetCol + dc;
      coveredAll.push({ rowIndex: rr, colIndex: cc });
      const colId = columns[cc]?.id;
      const cell = colId ? rows[rr]?.cells.find((item) => item.columnId === colId) : undefined;
      if (cell && isTableCellValueNonEmpty(cell.value)) {
        coveredWithContent.push({ rowIndex: rr, colIndex: cc });
      }
    }
  }

  return { valid: true, reason: null, coveredWithContent, coveredAll };
}

export function canMoveStaticColumn(
  columns: readonly TemplateStaticTableColumn[],
  rows: readonly TemplateTableRow[],
  index: number,
  delta: -1 | 1,
): boolean {
  const target = index + delta;
  if (index < 0 || index >= columns.length || target < 0 || target >= columns.length) {
    return false;
  }
  const lo = Math.min(index, target);
  const hi = Math.max(index, target);
  const colIndexById = new Map(columns.map((c, idx) => [c.id, idx]));

  for (const row of rows) {
    for (const cell of row.cells) {
      const colSpan = Math.max(1, cell.colSpan ?? 1);
      if (colSpan <= 1) continue;
      const c = colIndexById.get(cell.columnId);
      if (c === undefined) continue;
      if (c <= hi && c + colSpan - 1 >= lo) {
        return false;
      }
    }
  }
  return true;
}

export function removeStaticColumnFromRows(
  columns: readonly TemplateStaticTableColumn[],
  rows: readonly TemplateTableRow[],
  removeIndex: number,
): TemplateTableRow[] {
  const removed = columns[removeIndex];
  if (!removed) return [...rows];

  const nextCols = columns.filter((_, i) => i !== removeIndex);
  const nextColId = columns[removeIndex + 1]?.id;
  const oldIndexById = new Map(columns.map((c, idx) => [c.id, idx]));
  const newIndexById = new Map(nextCols.map((c, idx) => [c.id, idx]));
  const totalRows = rows.length;

  return rows.map((row, rIdx) => {
    const removedCell = row.cells.find((c) => c.columnId === removed.id);
    const removedSpan = removedCell ? Math.max(1, removedCell.colSpan ?? 1) : 1;
    const shiftAnchor =
      removedCell && removedSpan > 1 && nextColId
        ? {
            value: structuredClone(removedCell.value),
            rowSpan: removedCell.rowSpan,
            colSpan: removedSpan - 1,
            style: removedCell.style ? structuredClone(removedCell.style) : undefined,
          }
        : null;

    const remaining = row.cells.filter((c) => c.columnId !== removed.id);
    let transferred = false;

    const nextCells = remaining.map((cell) => {
      const oldC = oldIndexById.get(cell.columnId) ?? 0;
      const newC = newIndexById.get(cell.columnId) ?? 0;
      let nextCell: TemplateTableCell = cell;

      if (shiftAnchor && cell.columnId === nextColId) {
        transferred = true;
        nextCell = {
          ...cell,
          value: shiftAnchor.value,
          rowSpan: shiftAnchor.rowSpan,
          colSpan: shiftAnchor.colSpan,
          ...(shiftAnchor.style ? { style: shiftAnchor.style } : {}),
        };
      } else {
        const oldSpan = Math.max(1, cell.colSpan ?? 1);
        if (oldC < removeIndex && oldC + oldSpan - 1 >= removeIndex) {
          nextCell = { ...cell, colSpan: oldSpan - 1 };
        }
      }

      const maxColSpan = Math.max(1, nextCols.length - newC);
      const maxRowSpan = Math.max(1, totalRows - rIdx);
      const rawColSpan = Math.max(1, nextCell.colSpan ?? 1);
      const rawRowSpan = Math.max(1, nextCell.rowSpan ?? 1);
      const clampedColSpan = Math.min(rawColSpan, maxColSpan);
      const clampedRowSpan = Math.min(rawRowSpan, maxRowSpan);

      return {
        ...nextCell,
        colSpan: clampedColSpan > 1 ? clampedColSpan : undefined,
        rowSpan: clampedRowSpan > 1 ? clampedRowSpan : undefined,
      };
    });

    if (shiftAnchor && nextColId && !transferred) {
      const newC = newIndexById.get(nextColId) ?? 0;
      const maxColSpan = Math.max(1, nextCols.length - newC);
      const maxRowSpan = Math.max(1, totalRows - rIdx);
      const clampedColSpan = Math.min(Math.max(1, shiftAnchor.colSpan), maxColSpan);
      const clampedRowSpan = Math.min(Math.max(1, shiftAnchor.rowSpan ?? 1), maxRowSpan);
      nextCells.push({
        id: newDesignerUuid(),
        columnId: nextColId,
        value: shiftAnchor.value,
        ...(shiftAnchor.style ? { style: shiftAnchor.style } : {}),
        colSpan: clampedColSpan > 1 ? clampedColSpan : undefined,
        rowSpan: clampedRowSpan > 1 ? clampedRowSpan : undefined,
      });
    }

    return { ...row, cells: nextCells };
  });
}

export function formulaReferencesList(
  expr: TemplateFormulaExpression,
  listPath: string,
  insideOtherSumRows = false,
): boolean {
  const prefix = listPath ? `${listPath}[]` : '';
  switch (expr.kind) {
    case 'ROW_BINDING':
      return !insideOtherSumRows || (Boolean(prefix) && expr.path.startsWith(prefix));
    case 'BINDING':
      return (
        Boolean(prefix) &&
        (expr.path.startsWith(prefix) || Boolean(expr.currencyCodePath?.startsWith(prefix)))
      );
    case 'ROOT_BINDING':
      return Boolean(prefix) && expr.path.startsWith(prefix);
    case 'SUM_ROWS':
      return expr.sourcePath === listPath
        ? true
        : formulaReferencesList(expr.item, listPath, true);
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'SUM':
    case 'MIN':
    case 'MAX':
    case 'COALESCE':
    case 'CONCAT':
      return expr.operands.some((op) => formulaReferencesList(op, listPath, insideOtherSumRows));
    case 'DIVIDE':
      return (
        formulaReferencesList(expr.dividend, listPath, insideOtherSumRows) ||
        formulaReferencesList(expr.divisor, listPath, insideOtherSumRows)
      );
    case 'ROUND':
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
      return formulaReferencesList(expr.value, listPath, insideOtherSumRows);
    case 'DATE_ADD_DAYS':
      return (
        formulaReferencesList(expr.date, listPath, insideOtherSumRows) ||
        formulaReferencesList(expr.days, listPath, insideOtherSumRows)
      );
    case 'DATE_DIFF_DAYS':
    case 'COMPARE':
      return (
        formulaReferencesList(expr.left, listPath, insideOtherSumRows) ||
        formulaReferencesList(expr.right, listPath, insideOtherSumRows)
      );
    case 'IF':
      return (
        formulaReferencesList(expr.condition, listPath, insideOtherSumRows) ||
        formulaReferencesList(expr.whenTrue, listPath, insideOtherSumRows) ||
        formulaReferencesList(expr.whenFalse, listPath, insideOtherSumRows)
      );
    case 'FUNCTION_CALL':
      return expr.arguments.some((arg) =>
        formulaReferencesList(arg.expression, listPath, insideOtherSumRows),
      );
    default:
      return false;
  }
}

export function cleanTableCellStyle(style: TemplateTableCellStyle): TemplateTableCellStyle | undefined {
  const out: TemplateTableCellStyle = {};
  if (style.fontFamilyToken) out.fontFamilyToken = style.fontFamilyToken;
  if (typeof style.fontSizePx === 'number' && Number.isFinite(style.fontSizePx)) {
    out.fontSizePx = style.fontSizePx;
  }
  if (style.fontWeight) out.fontWeight = style.fontWeight;
  if (style.color) {
    const norm = normalizeSafeColor(style.color);
    if (norm) out.color = norm;
  }
  if (style.backgroundColor) {
    const norm = normalizeSafeColor(style.backgroundColor);
    if (norm) out.backgroundColor = norm;
  }
  if (style.paddingPx) {
    const { top, end, bottom, start } = style.paddingPx;
    if ([top, end, bottom, start].some((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
      out.paddingPx = {
        top: Number.isFinite(top) ? top : 0,
        end: Number.isFinite(end) ? end : 0,
        bottom: Number.isFinite(bottom) ? bottom : 0,
        start: Number.isFinite(start) ? start : 0,
      };
    }
  }
  if (style.border && style.border.widthPx > 0) {
    const color = normalizeSafeColor(style.border.color);
    if (color) {
      out.border = {
        widthPx: style.border.widthPx,
        style: style.border.style,
        color,
      };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function countFormulaAstNodes(expr: TemplateFormulaExpression): number {
  switch (expr.kind) {
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'SUM':
    case 'MIN':
    case 'MAX':
    case 'COALESCE':
    case 'CONCAT':
      return 1 + expr.operands.reduce((acc, op) => acc + countFormulaAstNodes(op), 0);
    case 'DIVIDE':
      return 1 + countFormulaAstNodes(expr.dividend) + countFormulaAstNodes(expr.divisor);
    case 'ROUND':
    case 'ABS':
    case 'NEGATE':
    case 'IS_NULL':
    case 'TRIM':
      return 1 + countFormulaAstNodes(expr.value);
    case 'DATE_ADD_DAYS':
      return 1 + countFormulaAstNodes(expr.date) + countFormulaAstNodes(expr.days);
    case 'DATE_DIFF_DAYS':
    case 'COMPARE':
      return 1 + countFormulaAstNodes(expr.left) + countFormulaAstNodes(expr.right);
    case 'IF':
      return (
        1 +
        countFormulaAstNodes(expr.condition) +
        countFormulaAstNodes(expr.whenTrue) +
        countFormulaAstNodes(expr.whenFalse)
      );
    case 'SUM_ROWS':
      return 1 + countFormulaAstNodes(expr.item);
    case 'FUNCTION_CALL':
      return 1 + expr.arguments.reduce((acc, arg) => acc + countFormulaAstNodes(arg.expression), 0);
    default:
      return 1;
  }
}

export interface FormulaReadableLabels {
  yes: string;
  no: string;
  empty: string;
  fnGated: string;
  sumRows: string;
  ifWord: string;
  thenWord: string;
  elseWord: string;
  isEmptyWord: string;
  roundWord: string;
  sumWord: string;
  absWord: string;
  trimWord: string;
  minWord: string;
  maxWord: string;
  coalesceWord: string;
  concatWord: string;
  addDaysWord: string;
  diffDaysWord: string;
  unsetSlot: string;
}

const COMPARE_SYMBOLS: Record<TemplateCompareOperator, string> = {
  EQ: '=',
  NE: '≠',
  LT: '<',
  LTE: '≤',
  GT: '>',
  GTE: '≥',
};

function wrapIfOp(expr: TemplateFormulaExpression, text: string): string {
  switch (expr.kind) {
    case 'ADD':
    case 'SUBTRACT':
    case 'MULTIPLY':
    case 'DIVIDE':
    case 'COMPARE':
    case 'IF':
      return `(${text})`;
    default:
      return text;
  }
}

export function formatFormulaReadable(
  expr: TemplateFormulaExpression | null | undefined,
  resolveFieldLabel: (path: string) => string,
  resolveFormulaName: (id: string) => string,
  labels: FormulaReadableLabels,
): string {
  if (!expr) return labels.unsetSlot;
  const sub = (child: TemplateFormulaExpression) =>
    formatFormulaReadable(child, resolveFieldLabel, resolveFormulaName, labels);

  switch (expr.kind) {
    case 'DECIMAL_LITERAL':
      return expr.value || labels.unsetSlot;
    case 'STRING_LITERAL':
      return `"${expr.value}"`;
    case 'DATE_LITERAL':
      return expr.value || labels.unsetSlot;
    case 'BOOLEAN_LITERAL':
      return expr.value ? labels.yes : labels.no;
    case 'NULL_LITERAL':
      return labels.empty;
    case 'BINDING':
    case 'ROOT_BINDING':
    case 'ROW_BINDING':
      return expr.path ? resolveFieldLabel(expr.path) : labels.unsetSlot;
    case 'FORMULA_REF':
      return expr.formulaId ? resolveFormulaName(expr.formulaId) : labels.unsetSlot;
    case 'PARAMETER':
      return expr.name || labels.unsetSlot;
    case 'FUNCTION_CALL':
      return labels.fnGated;
    case 'ADD':
      return expr.operands.map((op) => sub(op)).join(' + ');
    case 'SUBTRACT':
      return expr.operands.map((op, i) => (i > 0 ? wrapIfOp(op, sub(op)) : sub(op))).join(' − ');
    case 'MULTIPLY':
      return expr.operands
        .map((op) => (op.kind === 'ADD' || op.kind === 'SUBTRACT' ? `(${sub(op)})` : sub(op)))
        .join(' × ');
    case 'DIVIDE': {
      const left =
        expr.dividend.kind === 'ADD' || expr.dividend.kind === 'SUBTRACT'
          ? `(${sub(expr.dividend)})`
          : sub(expr.dividend);
      const right = wrapIfOp(expr.divisor, sub(expr.divisor));
      return `${left} ÷ ${right}`;
    }
    case 'ROUND':
      return `${labels.roundWord}(${sub(expr.value)}, ${expr.scale})`;
    case 'SUM':
      return `${labels.sumWord}(${expr.operands.map(sub).join(', ')})`;
    case 'MIN':
      return `${labels.minWord}(${expr.operands.map(sub).join(', ')})`;
    case 'MAX':
      return `${labels.maxWord}(${expr.operands.map(sub).join(', ')})`;
    case 'COALESCE':
      return `${labels.coalesceWord}(${expr.operands.map(sub).join(', ')})`;
    case 'CONCAT':
      return `${labels.concatWord}(${expr.operands.map(sub).join(', ')})`;
    case 'ABS':
      return `${labels.absWord}(${sub(expr.value)})`;
    case 'NEGATE':
      return `−${wrapIfOp(expr.value, sub(expr.value))}`;
    case 'IS_NULL':
      return `${wrapIfOp(expr.value, sub(expr.value))} ${labels.isEmptyWord}`;
    case 'TRIM':
      return `${labels.trimWord}(${sub(expr.value)})`;
    case 'DATE_ADD_DAYS':
      return `${labels.addDaysWord}(${sub(expr.date)}, ${sub(expr.days)})`;
    case 'DATE_DIFF_DAYS':
      return `${labels.diffDaysWord}(${sub(expr.left)}, ${sub(expr.right)})`;
    case 'COMPARE':
      return `${sub(expr.left)} ${COMPARE_SYMBOLS[expr.operator]} ${sub(expr.right)}`;
    case 'IF':
      return `${labels.ifWord} ${sub(expr.condition)} ${labels.thenWord} ${sub(expr.whenTrue)} ${labels.elseWord} ${sub(expr.whenFalse)}`;
    case 'SUM_ROWS':
      return `${labels.sumRows}(${expr.sourcePath ? resolveFieldLabel(expr.sourcePath) : labels.unsetSlot}: ${sub(expr.item)})`;
  }
}

export function createDefaultDecimalLiteral(dimension: TemplateFormulaDimension = 'SCALAR'): TemplateFormulaExpression {
  return { kind: 'DECIMAL_LITERAL', value: '0', dimension };
}
